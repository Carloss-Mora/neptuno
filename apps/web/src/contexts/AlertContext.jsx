
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import pb from '@/lib/pocketbaseClient';
import { isSet } from '@/utils/optionalNumber';

export const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { selectedCrop } = useCrop();
  const [alerts, setAlerts] = useState([]);
  const dismissedAlertsRef = useRef(new Set());
  const seenIrrigationLogIdsRef = useRef(new Set());
  const previousIrrigationStatusRef = useRef(null);
  const irrigationLogsInitializedRef = useRef(false);
  const notificationUserIdRef = useRef(null);
  const notificationCropIdRef = useRef(null);

  const addAlert = useCallback((id, type, message, dismissible = true) => {
    setAlerts((prev) => {
      if (prev.find((a) => a.id === id)) return prev;
      return [...prev, { id, type, message, timestamp: new Date(), dismissible }];
    });
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dismissAlert = useCallback((id) => {
    removeAlert(id);
    dismissedAlertsRef.current.add(id);
  }, [removeAlert]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setAlerts([]);
      dismissedAlertsRef.current.clear();
      seenIrrigationLogIdsRef.current.clear();
      previousIrrigationStatusRef.current = null;
      irrigationLogsInitializedRef.current = false;
      notificationUserIdRef.current = null;
      notificationCropIdRef.current = null;
      return;
    }

    if (!selectedCrop) {
      setAlerts([]);
      notificationCropIdRef.current = null;
      return;
    }
    if (notificationUserIdRef.current !== currentUser.id || notificationCropIdRef.current !== selectedCrop.id) {
      setAlerts([]);
      dismissedAlertsRef.current.clear();
      seenIrrigationLogIdsRef.current.clear();
      previousIrrigationStatusRef.current = null;
      irrigationLogsInitializedRef.current = false;
      notificationUserIdRef.current = currentUser.id;
      notificationCropIdRef.current = selectedCrop.id;
    }

    let active = true;
    let offlineTimer = null;
    let devices = [];
    const unsubscribers = [];

    const applySensorAlert = (data) => {
      const humidityId = `alert-soil-${selectedCrop.id}`;
      if (isSet(selectedCrop.humidity_min) && Number(data.soil_humidity) < Number(selectedCrop.humidity_min)) {
        if (!dismissedAlertsRef.current.has(humidityId)) {
          addAlert(humidityId, 'warning', `Humedad bajo el mínimo configurado (${selectedCrop.humidity_min}%)`);
        }
      } else {
        removeAlert(humidityId);
        dismissedAlertsRef.current.delete(humidityId);
      }

      const waterId = `alert-water-${selectedCrop.id}`;
      if (isSet(selectedCrop.alert_water_min) && Number(data.water_level) < Number(selectedCrop.alert_water_min)) {
        if (!dismissedAlertsRef.current.has(waterId)) addAlert(waterId, 'warning', 'Nivel de agua bajo');
      } else {
        removeAlert(waterId);
        dismissedAlertsRef.current.delete(waterId);
      }

      const temperatureId = `alert-temperature-${selectedCrop.id}`;
      if (isSet(selectedCrop.alert_temp_max) && Number(data.temperature) > Number(selectedCrop.alert_temp_max)) {
        if (!dismissedAlertsRef.current.has(temperatureId)) {
          addAlert(temperatureId, 'warning', `Temperatura por encima del máximo configurado (${selectedCrop.alert_temp_max} °C)`);
        }
      } else {
        removeAlert(temperatureId);
        dismissedAlertsRef.current.delete(temperatureId);
      }
    };

    const handleLog = (log) => {
      if (!log?.id || seenIrrigationLogIdsRef.current.has(log.id)) return;
      seenIrrigationLogIdsRef.current.add(log.id);
      if (irrigationLogsInitializedRef.current) {
        if (log.status === 'ON' && previousIrrigationStatusRef.current !== 'ON') {
          addAlert(`irrigation-start-${log.id}`, 'info', 'Nuevo riego iniciado');
        } else if (log.status === 'OFF' && previousIrrigationStatusRef.current === 'ON') {
          addAlert(`irrigation-finish-${log.id}`, 'info', 'El riego ha finalizado');
        }
      }
      previousIrrigationStatusRef.current = log.status;
    };

    const refreshOfflineAlerts = () => {
      if (!active) return;
      let nextTransitionMs = Number.POSITIVE_INFINITY;
      devices.forEach((device) => {
        const alertId = `device-offline-${device.id}`;
        const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
        const offlineAt = lastSeen + Math.max(2 * Number(device.interval_seconds || 15), 60) * 1000;
        const offline = !lastSeen || Date.now() >= offlineAt;
        if (offline && !dismissedAlertsRef.current.has(alertId)) {
          addAlert(alertId, 'warning', `Dispositivo sin conexión: ${device.name}`);
        } else if (!offline) {
          removeAlert(alertId);
          dismissedAlertsRef.current.delete(alertId);
          nextTransitionMs = Math.min(nextTransitionMs, offlineAt);
        }
      });
      if (offlineTimer) window.clearTimeout(offlineTimer);
      if (Number.isFinite(nextTransitionMs)) {
        offlineTimer = window.setTimeout(refreshOfflineAlerts, Math.max(1000, nextTransitionMs - Date.now()));
      }
    };

    const loadInitialState = async () => {
      const results = await Promise.allSettled([
        pb.collection('sensor_readings').getList(1, 1, {
          filter: `cropId = "${selectedCrop.id}"`,
          sort: '-created',
          $autoCancel: false,
        }),
        pb.collection('irrigation_logs').getList(1, 10, {
          filter: `cropId = "${selectedCrop.id}" && zoneId = ""`,
          sort: '-created',
          $autoCancel: false,
        }),
        pb.collection('devices').getFullList({
          filter: `cropId = "${selectedCrop.id}" && is_simulated != true`,
          $autoCancel: false,
        }),
      ]);
      if (!active) return;
      if (results[0].status === 'fulfilled' && results[0].value.items[0]) {
        applySensorAlert(results[0].value.items[0]);
      } else if (results[0].status === 'rejected') {
        console.error('Error loading sensor alerts:', results[0].reason);
      }
      if (results[1].status === 'fulfilled') {
        const logs = results[1].value.items;
        logs.forEach((log) => seenIrrigationLogIdsRef.current.add(log.id));
        previousIrrigationStatusRef.current = logs[0]?.status || null;
        irrigationLogsInitializedRef.current = true;
      } else {
        console.error('Error loading irrigation alerts:', results[1].reason);
        irrigationLogsInitializedRef.current = true;
      }
      if (results[2].status === 'fulfilled') {
        devices = results[2].value;
        refreshOfflineAlerts();
      } else {
        console.error('Error loading device statuses for alerts:', results[2].reason);
      }
    };

    loadInitialState().catch((error) => {
      console.error('Could not initialize realtime alerts:', error);
    });

    const subscribe = async (collectionName, handleEvent) => {
      try {
        const unsubscribe = await pb.collection(collectionName).subscribe('*', (event) => {
          if (!active || !event.record || event.record.cropId !== selectedCrop.id) return;
          handleEvent(event);
        });
        const stop = () => {
          const result = unsubscribe();
          if (result?.catch) result.catch((error) => console.error(`Could not unsubscribe from ${collectionName} alerts:`, error));
        };
        if (active) unsubscribers.push(stop);
        else stop();
      } catch (subscribeError) {
        console.error(`Could not subscribe to ${collectionName} alerts:`, subscribeError);
      }
    };

    subscribe('sensor_readings', (event) => {
      if (event.action !== 'delete') applySensorAlert(event.record);
    });
    subscribe('irrigation_logs', (event) => {
      if (event.action !== 'delete' && !event.record.zoneId) handleLog(event.record);
    });
    subscribe('devices', (event) => {
      if (event.record.is_simulated) return;
      devices = event.action === 'delete'
        ? devices.filter((device) => device.id !== event.record.id)
        : [...devices.filter((device) => device.id !== event.record.id), event.record];
      refreshOfflineAlerts();
    });

    return () => {
      active = false;
      if (offlineTimer) window.clearTimeout(offlineTimer);
      unsubscribers.forEach((stop) => stop());
    };
  }, [isAuthenticated, currentUser, selectedCrop, addAlert, removeAlert]);

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert, dismissAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
