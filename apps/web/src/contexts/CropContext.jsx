import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { getPocketBaseErrorDetails } from '@/lib/pocketbaseError';
import { useAuth } from '@/contexts/AuthContext';
import { isProvided, isSet, toNumberOrNull } from '@/utils/optionalNumber';

const defaultContext = {
  crops: [],
  selectedCrop: null,
  selectedCropId: '',
  loading: false,
  error: '',
  selectCrop: () => {},
  refreshCrops: async () => [],
  createCrop: async () => { throw new Error('El proveedor de cultivos no está disponible.'); },
  updateCrop: async () => { throw new Error('El proveedor de cultivos no está disponible.'); },
  deleteCrop: async () => { throw new Error('El proveedor de cultivos no está disponible.'); },
};

const CropContext = createContext(defaultContext);

const getStorageKey = (userId) => `neptuno:selected-crop:${userId}`;

// 0 equivale a "sin configurar" (PocketBase devuelve 0 en los campos vacíos);
// solo se rechazan los valores negativos o que no sean un número.
const requirePositive = (value, message) => {
  if (isProvided(value) && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error(message);
};

const requireInteger = (value, minimum, maximum, message) => {
  if (!isProvided(value)) return;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(message);
};

const validateThresholds = (data) => {
  requirePositive(data.humidity_min, 'La humedad mínima debe ser mayor que 0 y no superar 100%.');
  requirePositive(data.humidity_max, 'La humedad máxima debe ser mayor que 0 y no superar 100%.');
  const hasMinimum = isSet(data.humidity_min);
  const hasMaximum = isSet(data.humidity_max);
  if (hasMinimum !== hasMaximum) {
    throw new Error('Configura ambos umbrales de humedad o deja los dos vacíos.');
  }
  if (hasMinimum && Number(data.humidity_min) > 100) {
    throw new Error('La humedad mínima debe ser mayor que 0 y no superar 100%.');
  }
  if (hasMaximum && Number(data.humidity_max) > 100) {
    throw new Error('La humedad máxima debe ser mayor que 0 y no superar 100%.');
  }
  if (hasMinimum && Number(data.humidity_min) >= Number(data.humidity_max)) {
    throw new Error('La humedad mínima debe ser inferior a la máxima.');
  }
  if (data.control_mode === 'AUTO' && (!hasMinimum || !hasMaximum || !isSet(data.max_irrigation_minutes))) {
    throw new Error('Para activar AUTO configura ambos umbrales y el máximo de riego continuo. Valida los valores con AGROSAVIA (2022).');
  }
};

// Ubicación y lluvia: solo se envían si vienen en los datos, para no borrarlos al editar otros campos.
const rainFields = (data) => {
  const out = {};
  const hasLatitude = isProvided(data.latitude);
  const hasLongitude = isProvided(data.longitude);
  if (hasLatitude !== hasLongitude) throw new Error('Para usar la ubicación indica latitud y longitud.');
  if (hasLatitude) {
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('La latitud debe estar entre -90 y 90.');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('La longitud debe estar entre -180 y 180.');
    out.latitude = latitude;
    out.longitude = longitude;
  } else if ('latitude' in data) {
    out.latitude = 0;
    out.longitude = 0;
  }
  if ('rain_skip' in data) {
    out.rain_skip = Boolean(data.rain_skip);
    if (out.rain_skip && !hasLatitude) throw new Error('Para no regar con lluvia primero indica la ubicación del cultivo.');
  }
  if (isProvided(data.rain_threshold_mm)) {
    const mm = Number(data.rain_threshold_mm);
    if (!Number.isFinite(mm) || mm <= 0 || mm > 200) throw new Error('La lluvia esperada debe estar entre 0 y 200 mm.');
    out.rain_threshold_mm = mm;
  }
  return out;
};

const normalizeCrop = (data) => {
  validateThresholds(data);
  requirePositive(data.area_m2, 'El área debe ser un número mayor que cero.');
  requirePositive(data.flow_lpm, 'El caudal debe ser un número mayor que cero.');
  requirePositive(data.max_irrigation_minutes, 'El tiempo máximo de riego debe ser de 1 a 1440 minutos.');
  if (isSet(data.max_irrigation_minutes)) {
    requireInteger(data.max_irrigation_minutes, 1, 1440, 'El tiempo máximo de riego debe ser de 1 a 1440 minutos.');
  }
  requireInteger(data.min_rest_minutes, 0, 10080, 'El tiempo mínimo de descanso debe ser de 0 a 10080 minutos (0 = sin descanso).');
  requirePositive(data.alert_water_min, 'El mínimo de alerta del nivel de agua debe ser mayor que 0 y no superar 100%.');
  requirePositive(data.alert_temp_max, 'La temperatura máxima de alerta debe ser mayor que 0 y no superar 60 °C.');
  const alertWaterMinimum = toNumberOrNull(data.alert_water_min);
  const alertTemperatureMaximum = toNumberOrNull(data.alert_temp_max);
  if (alertWaterMinimum !== null && alertWaterMinimum > 100) {
    throw new Error('El mínimo de alerta del nivel de agua debe ser mayor que 0 y no superar 100%.');
  }
  if (alertTemperatureMaximum !== null && alertTemperatureMaximum > 60) {
    throw new Error('La temperatura máxima de alerta debe ser mayor que 0 y no superar 60 °C.');
  }
  const manualOverrideMinutes = isProvided(data.manual_override_minutes)
    ? Number(data.manual_override_minutes)
    : 30;
  if (!Number.isInteger(manualOverrideMinutes) || manualOverrideMinutes < 1 || manualOverrideMinutes > 1440) {
    throw new Error('La anulación manual debe durar de 1 a 1440 minutos.');
  }
  return {
    name: String(data.name || '').trim(),
    variety: String(data.variety || '').trim(),
    area_m2: toNumberOrNull(data.area_m2),
    flow_lpm: toNumberOrNull(data.flow_lpm),
    phenological_stage: data.phenological_stage || '',
    humidity_min: toNumberOrNull(data.humidity_min),
    humidity_max: toNumberOrNull(data.humidity_max),
    max_irrigation_minutes: toNumberOrNull(data.max_irrigation_minutes),
    min_rest_minutes: isProvided(data.min_rest_minutes) ? Number(data.min_rest_minutes) : null,
    manual_override_minutes: manualOverrideMinutes,
    alert_water_min: alertWaterMinimum,
    alert_temp_max: alertTemperatureMaximum,
    control_mode: data.control_mode || 'MANUAL',
    ...rainFields(data),
  };
};

export const CropProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [crops, setCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshCrops = useCallback(async () => {
    if (!currentUser) {
      setCrops([]);
      setSelectedCropId('');
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError('');
    try {
      const records = await pb.collection('crops').getFullList({
        sort: 'name',
        $autoCancel: false,
      });
      setCrops(records);
      setSelectedCropId((currentId) => {
        if (records.some((crop) => crop.id === currentId)) return currentId;
        let storedId = '';
        try {
          storedId = localStorage.getItem(getStorageKey(currentUser.id)) || '';
        } catch (storageError) {
          console.error('Could not read selected crop preference:', storageError);
        }
        return records.some((crop) => crop.id === storedId) ? storedId : records[0]?.id || '';
      });
      return records;
    } catch (loadError) {
      console.error('Error loading crops from PocketBase:', {
        url: `${pb.baseURL}/api/collections/crops/records`,
        status: loadError?.status || loadError?.response?.status || 0,
        response: loadError?.response,
        error: loadError,
      });
      setError(import.meta.env.DEV
        ? `No se pudieron cargar los cultivos: ${getPocketBaseErrorDetails(loadError)}`
        : 'No se pudieron cargar los cultivos. Intenta actualizar la página.');
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshCrops().catch((refreshError) => {
      console.error('Could not initialize crops:', refreshError);
    });
  }, [refreshCrops]);

  const selectCrop = useCallback((cropId) => {
    setSelectedCropId(cropId);
    if (!currentUser) return;
    try {
      localStorage.setItem(getStorageKey(currentUser.id), cropId);
    } catch (storageError) {
      console.error('Could not save selected crop preference:', storageError);
    }
  }, [currentUser]);

  const createCrop = useCallback(async (data) => {
    if (!currentUser) throw new Error('Debes iniciar sesión para crear un cultivo.');
    const cropData = normalizeCrop(data);
    if (!cropData.name) throw new Error('Escribe el nombre del cultivo.');
    const crop = await pb.collection('crops').create({
      ...cropData,
      userId: currentUser.id,
    }, { $autoCancel: false });
    setCrops((existing) => [...existing, crop]);
    selectCrop(crop.id);
    return crop;
  }, [currentUser, selectCrop]);

  const updateCrop = useCallback(async (cropId, data) => {
    const cropData = normalizeCrop(data);
    if (!cropData.name) throw new Error('Escribe el nombre del cultivo.');
    const crop = await pb.collection('crops').update(cropId, cropData, { $autoCancel: false });
    setCrops((existing) => existing.map((item) => item.id === cropId ? crop : item));
    return crop;
  }, []);

  const deleteCrop = useCallback(async (cropId) => {
    await pb.collection('crops').delete(cropId, { $autoCancel: false });
    setCrops((existing) => {
      const remaining = existing.filter((crop) => crop.id !== cropId);
      setSelectedCropId((selectedId) => {
        if (selectedId !== cropId) return selectedId;
        const nextId = remaining[0]?.id || '';
        if (currentUser) {
          try {
            if (nextId) localStorage.setItem(getStorageKey(currentUser.id), nextId);
            else localStorage.removeItem(getStorageKey(currentUser.id));
          } catch (storageError) {
            console.error('Could not update selected crop preference:', storageError);
          }
        }
        return nextId;
      });
      return remaining;
    });
  }, [currentUser]);

  const selectedCrop = crops.find((crop) => crop.id === selectedCropId) || null;
  const value = useMemo(() => ({
    crops,
    selectedCrop,
    selectedCropId,
    loading,
    error,
    selectCrop,
    refreshCrops,
    createCrop,
    updateCrop,
    deleteCrop,
  }), [crops, selectedCrop, selectedCropId, loading, error, selectCrop, refreshCrops, createCrop, updateCrop, deleteCrop]);

  return <CropContext.Provider value={value}>{children}</CropContext.Provider>;
};

export const useCrop = () => useContext(CropContext);
