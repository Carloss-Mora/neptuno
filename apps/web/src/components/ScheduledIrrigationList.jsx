
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Edit2, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { getScheduleState } from '@/utils/irrigationMetrics';

const ScheduledIrrigationList = ({ schedules, loading, error, onEdit, onDelete, referenceDate = new Date() }) => {
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
      <Card className="border-dashed border-2 border-teal-200 bg-gradient-to-br from-teal-50/80 via-white to-cyan-50/70">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-teal-600 shadow-md shadow-teal-900/5 ring-1 ring-teal-100">
            <Calendar className="h-8 w-8" />
          </span>
          <p className="font-semibold text-slate-800">Aún no hay riegos programados</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">Crea un horario para automatizar el riego y verlo aparecer aquí.</p>
        </CardContent>
      </Card>
    );
  }

  const formatTimeLabel = (timeValue) => {
    if (!timeValue) return '00:00';
    const [hours, minutes] = String(timeValue).split(':');
    const hour = Number.parseInt(hours, 10);
    const minute = Number.parseInt(minutes, 10) || 0;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour + 11) % 12) + 1;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const formatSchedule = (schedule) => {
    if (schedule.recurrence === 'DAILY') return 'Todos los días';
    if (schedule.recurrence === 'WEEKLY') {
      const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const days = Array.isArray(schedule.days) ? schedule.days : [];
      return days.map((day) => names[Number(day)]).filter(Boolean).join(', ') || 'Sin días seleccionados';
    }
    const date = schedule.date || schedule.startDate || 'Sin fecha';
    if (date === 'Sin fecha') return 'Completa la duración del horario migrado';
    const parsedDate = new Date(`${date}T00:00:00`);
    const dateLabel = Number.isNaN(parsedDate.getTime())
      ? date
      : parsedDate.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
    return dateLabel;
  };

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => {
        const hasPassed = getScheduleState(schedule, referenceDate) === 'past';
        return (
        <Card key={schedule.id} className={`group overflow-hidden border-slate-200/80 bg-white transition-all duration-200 ${hasPassed ? 'opacity-80' : 'hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-950/5'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-600/20 transition-transform group-hover:scale-105">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{formatTimeLabel(schedule.startTime || schedule.time)}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  {schedule.endTime ? `Hasta ${formatTimeLabel(schedule.endTime)}` : 'Horario de riego'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium capitalize text-teal-700">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatSchedule(schedule)}
                </p>
                {hasPassed && (
                  <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Ya pasó
                  </p>
                )}
                {!schedule.endTime && (
                  <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Falta completar la hora de fin
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
              <Button
                variant="outline"
                size="sm"
                disabled={hasPassed}
                onClick={() => onEdit(schedule)}
                className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                title={hasPassed ? 'No se pueden editar horarios que ya pasaron' : undefined}
              >
                <Edit2 className="mr-1.5 h-4 w-4" />
                {hasPassed ? 'No editable' : 'Editar'}
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
        );
      })}
    </div>
  );
};

export default ScheduledIrrigationList;
