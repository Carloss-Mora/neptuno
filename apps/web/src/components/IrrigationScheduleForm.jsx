
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const getDefaultDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatHourTo12 = (hourValue) => {
  const hour = Number.parseInt(hourValue, 10);
  if (Number.isNaN(hour)) return '12';
  const normalized = ((hour + 11) % 12) + 1;
  return String(normalized);
};

const getPeriodForHour = (hourValue) => {
  const hour = Number.parseInt(hourValue, 10);
  if (Number.isNaN(hour)) return 'AM';
  return hour >= 12 ? 'PM' : 'AM';
};

const to24Hour = (hourValue, period) => {
  const hour = Number.parseInt(hourValue, 10);
  if (Number.isNaN(hour)) return 0;

  let normalized = hour % 12;
  if (period === 'PM') normalized += 12;
  if (period === 'AM' && hour === 12) normalized = 0;
  return normalized;
};

const IrrigationScheduleForm = ({ onSave, initialData = null, onCancel }) => {
  const { toast } = useToast();
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('09');
  const [endMinute, setEndMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState('AM');
  const [endPeriod, setEndPeriod] = useState('AM');
  const [scheduleDate, setScheduleDate] = useState(getDefaultDate());
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      const dateValue = initialData.date || initialData.startDate || initialData.endDate || getDefaultDate();
      setScheduleDate(dateValue);

      const startTime = initialData.startTime || initialData.time || '08:00';
      const endTime = initialData.endTime || '09:00';

      const [startH, startM] = startTime.split(':');
      const [endH, endM] = endTime.split(':');

      setStartHour(formatHourTo12(startH || '08'));
      setStartMinute(startM || '00');
      setEndHour(formatHourTo12(endH || '09'));
      setEndMinute(endM || '00');
      setStartPeriod(getPeriodForHour(startH || '08'));
      setEndPeriod(getPeriodForHour(endH || '09'));
    } else {
      setStartHour('08');
      setStartMinute('00');
      setEndHour('09');
      setEndMinute('00');
      setStartPeriod('AM');
      setEndPeriod('AM');
      setScheduleDate(getDefaultDate());
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!scheduleDate) {
      setFormError('Selecciona una fecha para el horario.');
      return;
    }

    if (!initialData && scheduleDate < getDefaultDate()) {
      setFormError('La fecha del horario no puede ser anterior a hoy.');
      return;
    }

    const startH = Number.parseInt(startHour, 10);
    const startM = Number.parseInt(startMinute, 10);
    const endH = Number.parseInt(endHour, 10);
    const endM = Number.parseInt(endMinute, 10);

    if (Number.isNaN(startH) || startH < 1 || startH > 12 || Number.isNaN(startM) || startM < 0 || startM > 59) {
      setFormError('Introduce una hora de inicio válida.');
      return;
    }

    if (Number.isNaN(endH) || endH < 1 || endH > 12 || Number.isNaN(endM) || endM < 0 || endM > 59) {
      setFormError('Introduce una hora de finalización válida.');
      return;
    }

    const normalizedStartHour = to24Hour(startHour, startPeriod);
    const normalizedEndHour = to24Hour(endHour, endPeriod);

    const startDateTime = new Date(`${scheduleDate}T${String(normalizedStartHour).padStart(2, '0')}:${String(startM).padStart(2, '0')}`);
    const endDateTime = new Date(`${scheduleDate}T${String(normalizedEndHour).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    const now = new Date();

    if (startDateTime >= endDateTime) {
      setFormError('La hora de finalización debe ser posterior a la de inicio.');
      return;
    }

    if (!initialData && scheduleDate === getDefaultDate() && startDateTime <= now) {
      setFormError('La hora de inicio debe ser posterior a la hora actual.');
      return;
    }

    setIsSubmitting(true);
    const formattedStartTime = `${String(normalizedStartHour).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const formattedEndTime = `${String(normalizedEndHour).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    try {
      const result = await onSave(formattedStartTime, formattedEndTime, scheduleDate);

      if (result && result.success) {
        toast({
          title: 'Éxito',
          description: 'Horario guardado exitosamente',
        });

        if (!initialData) {
          setStartHour('08');
          setStartMinute('00');
          setEndHour('09');
          setEndMinute('00');
          setStartPeriod('AM');
          setEndPeriod('AM');
          setScheduleDate(getDefaultDate());
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
          <div className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="start-time" className="text-gray-700 font-semibold">Hora de inicio</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Clock className="w-5 h-5 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <Input
                    id="start-time"
                    type="number"
                    min="1"
                    max="12"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-20 text-center text-lg font-medium text-gray-900"
                    placeholder="HH"
                    aria-label="Hora de inicio"
                  />
                  <span className="text-xl font-bold text-gray-500">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-20 text-center text-lg font-medium text-gray-900"
                    placeholder="MM"
                    aria-label="Minutos de inicio"
                  />
                </div>
                <div className="flex rounded-md border border-gray-300 overflow-hidden bg-white">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setStartPeriod(period)}
                      className={`px-3 py-2 text-sm font-medium transition ${
                        startPeriod === period
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                      aria-label={`Periodo de inicio ${period}`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="end-time" className="text-gray-700 font-semibold">Hora de finalización</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Clock className="w-5 h-5 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <Input
                    id="end-time"
                    type="number"
                    min="1"
                    max="12"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-20 text-center text-lg font-medium text-gray-900"
                    placeholder="HH"
                    aria-label="Hora de finalización"
                  />
                  <span className="text-xl font-bold text-gray-500">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-20 text-center text-lg font-medium text-gray-900"
                    placeholder="MM"
                    aria-label="Minutos de finalización"
                  />
                </div>
                <div className="flex rounded-md border border-gray-300 overflow-hidden bg-white">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setEndPeriod(period)}
                      className={`px-3 py-2 text-sm font-medium transition ${
                        endPeriod === period
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                      aria-label={`Periodo de finalización ${period}`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-date" className="text-gray-700 font-semibold">Fecha</Label>
            <Input
              id="schedule-date"
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={initialData ? undefined : getDefaultDate()}
              className="text-gray-900"
              aria-label="Fecha"
            />
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
