import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PREFERENCES, formatDateTime, formatTemperature, formatVolume } from '@/utils/units';

export const SETTINGS_DEFAULTS = {
  ...DEFAULT_PREFERENCES,
  notify_irrigation_events: false,
  notify_alerts: true,
  whatsapp_enabled: false,
  whatsapp_phone: '',
  whatsapp_apikey: '',
  default_humidity_min: '',
  default_humidity_max: '',
  default_max_irrigation_minutes: '',
  default_min_rest_minutes: '',
  default_flow_lpm: '',
  retention_days: 30,
};

const NUMERIC_KEYS = ['default_humidity_min', 'default_humidity_max', 'default_max_irrigation_minutes', 'default_min_rest_minutes', 'default_flow_lpm'];

// PocketBase devuelve 0 en los números vacíos: en el formulario eso se muestra como "sin configurar".
export const fromRecord = (record) => {
  if (!record) return { ...SETTINGS_DEFAULTS };
  const settings = { ...SETTINGS_DEFAULTS };
  settings.timezone = record.timezone || '';
  settings.unit_volume = record.unit_volume || 'L';
  settings.unit_temp = record.unit_temp || 'C';
  settings.notify_irrigation_events = record.notify_irrigation_events ?? false;
  settings.notify_alerts = record.notify_alerts ?? true;
  settings.whatsapp_enabled = record.whatsapp_enabled ?? false;
  settings.whatsapp_phone = record.whatsapp_phone || '';
  settings.whatsapp_apikey = record.whatsapp_apikey || '';
  settings.retention_days = Number(record.retention_days) > 0 ? Number(record.retention_days) : 30;
  NUMERIC_KEYS.forEach((key) => {
    settings[key] = Number(record[key]) > 0 ? Number(record[key]) : '';
  });
  return settings;
};

export const toPayload = (settings) => {
  const payload = { ...settings };
  NUMERIC_KEYS.forEach((key) => {
    payload[key] = payload[key] === '' || payload[key] === null || payload[key] === undefined ? 0 : Number(payload[key]);
  });
  return payload;
};

const UserSettingsContext = createContext({
  settings: SETTINGS_DEFAULTS,
  recordId: '',
  loading: false,
  error: '',
  reload: async () => {},
  save: async () => { throw new Error('El proveedor de ajustes no está disponible.'); },
  formatVolume: (liters) => formatVolume(liters, 'L'),
  formatTemperature: (celsius) => formatTemperature(celsius, 'C'),
  formatDateTime: (value) => formatDateTime(value, ''),
});

export const UserSettingsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || '';
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [recordId, setRecordId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) {
      setSettings(SETTINGS_DEFAULTS);
      setRecordId('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await pb.collection('user_settings').getList(1, 1, {
        filter: `userId = "${userId}"`,
        sort: '-updated',
        $autoCancel: false,
      });
      setRecordId(result.items[0]?.id || '');
      setSettings(fromRecord(result.items[0]));
    } catch (loadError) {
      console.error('Could not load user settings:', loadError);
      setError('No se pudieron cargar tus ajustes.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (next) => {
    if (!userId) throw new Error('Inicia sesión para guardar tus ajustes.');
    const payload = { userId, ...toPayload(next) };
    const saved = recordId
      ? await pb.collection('user_settings').update(recordId, payload, { $autoCancel: false })
      : await pb.collection('user_settings').create(payload, { $autoCancel: false });
    setRecordId(saved.id);
    setSettings(fromRecord(saved));
    return saved;
  }, [userId, recordId]);

  const value = useMemo(() => ({
    settings,
    recordId,
    loading,
    error,
    reload,
    save,
    formatVolume: (liters, digits) => formatVolume(liters, settings.unit_volume, digits),
    formatTemperature: (celsius, digits) => formatTemperature(celsius, settings.unit_temp, digits),
    formatDateTime: (date) => formatDateTime(date, settings.timezone),
  }), [settings, recordId, loading, error, reload, save]);

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
};

export const useUserSettings = () => useContext(UserSettingsContext);
