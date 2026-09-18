
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbaseClient';

export const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const dismissedAlertsRef = useRef(new Set());

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
      return;
    }

    const checkSensors = async () => {
      try {
        const readings = await pb.collection('sensor_readings').getList(1, 1, {
          filter: `userId = "${currentUser.id}"`,
          sort: '-created',
          $autoCancel: false,
        });

        if (readings.items.length > 0) {
          const data = readings.items[0];

          // Check Soil Humidity
          if (data.soil_humidity < 30) {
            if (!dismissedAlertsRef.current.has('alert-soil')) {
              addAlert('alert-soil', 'warning', 'Humedad baja - Riego recomendado');
            }
          } else {
            removeAlert('alert-soil');
            dismissedAlertsRef.current.delete('alert-soil');
          }

          // Check Temperature
          if (data.temperature > 35) {
            if (!dismissedAlertsRef.current.has('alert-temp')) {
              addAlert('alert-temp', 'critical', 'Temperatura alta');
            }
          } else {
            removeAlert('alert-temp');
            dismissedAlertsRef.current.delete('alert-temp');
          }

          // Check Water Level
          if (data.water_level < 20) {
            if (!dismissedAlertsRef.current.has('alert-water')) {
              addAlert('alert-water', 'warning', 'Nivel de agua bajo');
            }
          } else {
            removeAlert('alert-water');
            dismissedAlertsRef.current.delete('alert-water');
          }
        }
      } catch (error) {
        console.error('Error checking sensors for alerts:', error);
      }
    };

    checkSensors();
    const interval = setInterval(checkSensors, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser, addAlert, removeAlert]);

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
