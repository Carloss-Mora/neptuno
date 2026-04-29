
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Edit2, Trash2, Calendar, AlertCircle } from 'lucide-react';

const ScheduledIrrigationList = ({ schedules, loading, error, onEdit, onDelete }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center space-x-3 py-6 text-red-700">
          <AlertCircle className="w-6 h-6" />
          <p className="font-medium">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No hay horarios programados</p>
          <p className="text-sm text-gray-400 mt-1">Añade un horario para automatizar el riego</p>
        </CardContent>
      </Card>
    );
  }

  // Helper to format days nicely
  const formatDays = (days) => {
    if (!days || days.length === 0) return '';
    if (days.length === 7) return 'Todos los días';
    
    const workDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const weekend = ['Sábado', 'Domingo'];
    
    const isWorkDays = workDays.every(d => days.includes(d)) && days.length === 5;
    if (isWorkDays) return 'Lunes a Viernes';
    
    const isWeekend = weekend.every(d => days.includes(d)) && days.length === 2;
    if (isWeekend) return 'Fines de semana';

    return days.join(', ');
  };

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <Card key={schedule.id} className="overflow-hidden border-gray-200 hover:border-teal-300 transition-colors shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
            <div className="flex items-center space-x-4">
              <div className="bg-teal-50 p-3 rounded-full text-teal-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{schedule.time}</p>
                <p className="text-sm font-medium text-gray-600 mt-0.5">
                  {formatDays(schedule.days)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(schedule)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (window.confirm('¿Estás seguro de que deseas eliminar este horario?')) {
                    onDelete(schedule.id);
                  }
                }}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ScheduledIrrigationList;
