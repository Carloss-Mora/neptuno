
import React, { useEffect } from 'react';
import { useAlert } from '@/contexts/AlertContext';
import { AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const AlertNotifications = () => {
  const { alerts, dismissAlert } = useAlert();

  // Auto-dismiss info alerts
  useEffect(() => {
    const infoAlerts = alerts.filter(a => a.type === 'info');
    infoAlerts.forEach(alert => {
      const timer = setTimeout(() => {
        dismissAlert(alert.id);
      }, 5000);
      return () => clearTimeout(timer);
    });
  }, [alerts, dismissAlert]);

  const getAlertStyles = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-500 text-red-900';
      case 'warning':
        return 'bg-amber-50 border-amber-500 text-amber-900';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-500 text-blue-900';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start p-4 border-l-4 rounded-r-lg shadow-lg ${getAlertStyles(alert.type)}`}
          >
            <div className="flex-shrink-0 mr-3 mt-0.5">
              {getAlertIcon(alert.type)}
            </div>
            <div className="flex-1 mr-2">
              <p className="text-sm font-medium">{alert.message}</p>
              <p className="text-xs opacity-70 mt-1">
                {alert.timestamp.toLocaleTimeString('es-ES')}
              </p>
            </div>
            {alert.dismissible && (
              <button
                onClick={() => dismissAlert(alert.id)}
                className="flex-shrink-0 ml-auto text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AlertNotifications;
