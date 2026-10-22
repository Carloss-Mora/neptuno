
import React from 'react';
import { useAlert } from '@/contexts/AlertContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationBell = () => {
  const { alerts, dismissAlert } = useAlert();

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

  const getAlertStyles = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificaciones${alerts.length > 0 ? ` (${alerts.length})` : ''}`}
          className="relative w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Bell className="w-5 h-5 text-gray-600" />
          {alerts.length > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white">
              {alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">Notificaciones</h3>
        </div>
        <ScrollArea className="max-h-[400px]">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
              <Bell className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-sm">No hay notificaciones en este momento</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start p-3 rounded-lg border ${getAlertStyles(alert.type)}`}
                >
                  <div className="flex-shrink-0 mr-3 mt-0.5">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 mr-2">
                    <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {alert.timestamp.toLocaleTimeString('es-ES')}
                    </p>
                  </div>
                  {alert.dismissible && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAlert(alert.id);
                      }}
                      className="flex-shrink-0 ml-auto text-gray-400 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-black/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
