
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, CalendarDays, AlertCircle, Droplets, LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getScheduleState } from '@/utils/irrigationMetrics';

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
  const [recurrence, setRecurrence] = useState('ONCE');
  const [days, setDays] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPastSchedule = Boolean(initialData && getScheduleState(initialData) === 'past');

  useEffect(() => {
    if (initialData) {
      const dateValue = initialData.date || initialData.startDate || initialData.endDate || getDefaultDate();
      setScheduleDate(dateValue);
      setRecurrence(initialData.recurrence || 'ONCE');
      setDays(Array.isArray(initialData.days) ? initialData.days.map(Number) : []);

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
      setRecurrence('ONCE');
      setDays([]);
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isPastSchedule) {
      setFormError('Este horario ya pasó y no se puede editar.');
      return;
    }

    if (recurrence === 'ONCE' && !scheduleDate) {
      setFormError('Selecciona una fecha para el horario.');
      return;
    }

    if (recurrence === 'WEEKLY' && days.length === 0) {
      setFormError('Selecciona al menos un día de la semana.');
      return;
    }

    if (recurrence === 'ONCE' && !initialData && scheduleDate < getDefaultDate()) {
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

    const scheduleDateForValidation = scheduleDate || getDefaultDate();
    const startDateTime = new Date(`${scheduleDateForValidation}T${String(normalizedStartHour).padStart(2, '0')}:${String(startM).padStart(2, '0')}`);
    const endDateTime = new Date(`${scheduleDateForValidation}T${String(normalizedEndHour).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    const now = new Date();

    if (startDateTime >= endDateTime) {
      setFormError('La hora de finalización debe ser posterior a la de inicio.');
      return;
    }

    if (!initialData && recurrence === 'ONCE' && scheduleDate === getDefaultDate() && startDateTime <= now) {
      setFormError('La hora de inicio debe ser posterior a la hora actual.');
      return;
    }
    setIsSubmitting(true);
    const formattedStartTime = `${String(normalizedStartHour).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const formattedEndTime = `${String(normalizedEndHour).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    try {
      const result = await onSave(formattedStartTime, formattedEndTime, scheduleDate, recurrence, days);

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
          setRecurrence('ONCE');
          setDays([]);
        }
      } else {
        toast({
          title: 'Error',
          description: result?.error || 'No se pudo guardar el horario.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error submitting irrigation schedule:', err);
      const errorMessage = err?.message || 'Ocurrió un error inesperado al guardar.';
      setFormError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-teal-100/80 bg-white shadow-xl shadow-teal-950/5">
      <CardHeader className="border-b border-teal-100 pb-5 bg-teal-50/70">
        <CardTitle className="flex items-center gap-3 text-xl text-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-teal-600/20 bg-teal-700">
            <Droplets className="h-5 w-5" />
          </span>
          <span>{initialData ? 'Editar horario' : 'Programar un riego'}</span>
        </CardTitle>
        <p className="pl-14 text-sm text-slate-600">Elige cuándo comienza y termina el riego.</p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isPastSchedule && (
            <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Este horario ya pasó y no se puede editar.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100" />
                <Label htmlFor="start-time" className="font-semibold text-slate-800">Hora de inicio</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Input
                    id="start-time"
                    type="number"
                    min="1"
                    max="12"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="h-12 w-20 flex-1 border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm focus-visible:ring-teal-500 sm:flex-none"
                    placeholder="HH"
                    aria-label="Hora de inicio"
                  />
                  <span className="text-xl font-bold text-slate-400">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="h-12 w-20 flex-1 border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm focus-visible:ring-teal-500 sm:flex-none"
                    placeholder="MM"
                    aria-label="Minutos de inicio"
                  />
                </div>
                <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setStartPeriod(period)}
                      aria-pressed={startPeriod === period}
                      className={`min-h-11 w-full px-3 py-3 text-sm font-bold transition ${
                        startPeriod === period
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-teal-50'
                      }`}
                      aria-label={`Periodo de inicio ${period}`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 ring-4 ring-cyan-100" />
                <Label htmlFor="end-time" className="font-semibold text-slate-800">Hora de finalización</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Input
                    id="end-time"
                    type="number"
                    min="1"
                    max="12"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="h-12 w-20 flex-1 border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm focus-visible:ring-cyan-500 sm:flex-none"
                    placeholder="HH"
                    aria-label="Hora de finalización"
                  />
                  <span className="text-xl font-bold text-slate-400">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="h-12 w-20 flex-1 border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm focus-visible:ring-cyan-500 sm:flex-none"
                    placeholder="MM"
                    aria-label="Minutos de finalización"
                  />
                </div>
                <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setEndPeriod(period)}
                      aria-pressed={endPeriod === period}
                      className={`min-h-11 w-full px-3 py-3 text-sm font-bold transition ${
                        endPeriod === period
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-cyan-50'
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
            <Label htmlFor="schedule-recurrence" className="flex items-center gap-2 font-semibold text-slate-800">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              Repetición
            </Label>
            <select
              id="schedule-recurrence"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
              className="h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
            >
              <option value="ONCE">Una fecha</option>
              <option value="DAILY">Todos los días</option>
              <option value="WEEKLY">Días de la semana</option>
            </select>
          </div>

          {recurrence === 'ONCE' ? (
            <div className="space-y-2">
              <Label htmlFor="schedule-date" className="flex items-center gap-2 font-semibold text-slate-800">
                <CalendarDays className="h-4 w-4 text-teal-600" />
                Fecha del riego
              </Label>
            <Input
              id="schedule-date"
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={initialData ? undefined : getDefaultDate()}
              className="h-12 border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-teal-500"
              aria-label="Fecha"
            />
            </div>
          ) : recurrence === 'WEEKLY' && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-800">Días de riego</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((label, day) => (
                  <label key={day} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-100 bg-teal-50/50 px-2 text-sm">
                    <input
                      type="checkbox"
                      checked={days.includes(day)}
                      onChange={() => setDays((current) => current.includes(day)
                        ? current.filter((selectedDay) => selectedDay !== day)
                        : [...current, day])}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex space-x-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || isPastSchedule}
              className="h-12 flex-1 font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 bg-teal-700 hover:bg-teal-800"
            >
              {isSubmitting ? (
                <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />{initialData ? 'Guardar cambios' : 'Guardar horario'}</>
              )}
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
