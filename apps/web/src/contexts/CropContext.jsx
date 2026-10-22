import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

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

const validateThresholds = (data) => {
  const min = data.humidity_min;
  const max = data.humidity_max;
  const hasMinimum = min != null && min !== '';
  const hasMaximum = max != null && max !== '';
  if (hasMinimum !== hasMaximum) {
    throw new Error('Configura ambos umbrales de humedad o deja los dos vacíos.');
  }
  if (hasMinimum && (!Number.isFinite(Number(min)) || Number(min) < 0 || Number(min) > 100)) {
    throw new Error('La humedad mínima debe estar entre 0 y 100%.');
  }
  if (hasMaximum && (!Number.isFinite(Number(max)) || Number(max) < 0 || Number(max) > 100)) {
    throw new Error('La humedad máxima debe estar entre 0 y 100%.');
  }
  if (hasMinimum && Number(min) >= Number(max)) {
    throw new Error('La humedad mínima debe ser inferior a la máxima.');
  }
  if (data.control_mode === 'AUTO' && (
    !hasMinimum || !hasMaximum
    || data.max_irrigation_minutes === '' || data.max_irrigation_minutes == null
    || data.min_rest_minutes === '' || data.min_rest_minutes == null
  )) {
    throw new Error('Para activar AUTO configura ambos umbrales y los límites de duración y descanso. Valida los valores con AGROSAVIA (2022).');
  }
};

const normalizeCrop = (data) => {
  validateThresholds(data);
  const area = data.area_m2 === '' || data.area_m2 == null ? null : Number(data.area_m2);
  if (area !== null && (!Number.isFinite(area) || area <= 0)) {
    throw new Error('El área debe ser un número mayor que cero.');
  }
  const flowRate = data.flow_lpm === '' || data.flow_lpm == null ? null : Number(data.flow_lpm);
  if (flowRate !== null && (!Number.isFinite(flowRate) || flowRate <= 0)) {
    throw new Error('El caudal debe ser un número mayor que cero.');
  }
  const maxIrrigationMinutes = data.max_irrigation_minutes === '' || data.max_irrigation_minutes == null
    ? null
    : Number(data.max_irrigation_minutes);
  const minRestMinutes = data.min_rest_minutes === '' || data.min_rest_minutes == null
    ? null
    : Number(data.min_rest_minutes);
  if (maxIrrigationMinutes !== null && (!Number.isInteger(maxIrrigationMinutes) || maxIrrigationMinutes < 1 || maxIrrigationMinutes > 1440)) {
    throw new Error('El tiempo máximo de riego debe ser de 1 a 1440 minutos.');
  }
  if (minRestMinutes !== null && (!Number.isInteger(minRestMinutes) || minRestMinutes < 0 || minRestMinutes > 10080)) {
    throw new Error('El tiempo mínimo de descanso debe ser de 0 a 10080 minutos.');
  }
  return {
    name: String(data.name || '').trim(),
    variety: String(data.variety || '').trim(),
    area_m2: area,
    flow_lpm: flowRate,
    phenological_stage: data.phenological_stage || '',
    humidity_min: data.humidity_min === '' || data.humidity_min == null ? null : Number(data.humidity_min),
    humidity_max: data.humidity_max === '' || data.humidity_max == null ? null : Number(data.humidity_max),
    max_irrigation_minutes: maxIrrigationMinutes,
    min_rest_minutes: minRestMinutes,
    control_mode: data.control_mode || 'MANUAL',
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
        filter: `userId = "${currentUser.id}"`,
        sort: 'created',
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
      console.error('Error loading crops:', loadError);
      setError('No se pudieron cargar los cultivos. Intenta actualizar la página.');
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
