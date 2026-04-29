
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const IrrigationScheduleForm = ({ onSave, initialData = null, onCancel }) => {
  const { toast } = useToast();
  const [selectedDays, setSelectedDays] = useState([]);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setSelectedDays(initialData.days || []);
      if (initialData.time) {
        const [h, m] = initialData.time.split(':');
        setHour(h || '08');
        setMinute(m || '00');
      }
    }
  }, [initialData]);

  const handleDayToggle = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (selectedDays.length === 0) {
      setFormError('Por favor, selecciona al menos un día.');
      return;
    }

    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);

    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      setFormError('Por favor, introduce una hora válida (00-23) y minutos (00-59).');
      return;
    }

    setIsSubmitting(true);
    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    try {
      const result = await onSave(selectedDays, formattedTime);
      
      if (result && result.success) {
        toast({
          title: 'Éxito',
          description: 'Horario guardado exitosamente',
        });
        
        if (!initialData) {
          // Reset form if it's a new schedule
          setSelectedDays([]);
          setHour('08');
          setMinute('00');
        }
      } else {
        toast({
          title: 'Error',
          description: result?.error || 'No se pudo guardar el horario.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado al guardar.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-teal-100 shadow-md">
      <CardHeader className="bg-teal-50/50 border-b border-teal-100 pb-4">
        <CardTitle className="text-lg flex items-center text-teal-800">
          <CalendarDays className="w-5 h-5 mr-2" />
          {initialData ? 'Editar Horario' : 'Nuevo Horario de Riego'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Days Selection */}
          <div className="space-y-3">
            <Label className="text-gray-700 font-semibold">Días de la semana</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md border border-gray-100">
                  <Checkbox 
                    id={`day-${day}`} 
                    checked={selectedDays.includes(day)}
                    onCheckedChange={() => handleDayToggle(day)}
                    className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                  />
                  <label 
                    htmlFor={`day-${day}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-gray-700"
                  >
                    {day}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <Label className="text-gray-700 font-semibold">Hora de inicio</Label>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-20 text-center text-lg font-medium text-gray-900"
                  placeholder="HH"
                />
                <span className="text-xl font-bold text-gray-500">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className="w-20 text-center text-lg font-medium text-gray-900"
                  placeholder="MM"
                />
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">{formError}</p>
          )}

          <div className="flex space-x-3 pt-2">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar Horario' : 'Añadir Horario')}
            </Button>
            {initialData && onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default IrrigationScheduleForm;
