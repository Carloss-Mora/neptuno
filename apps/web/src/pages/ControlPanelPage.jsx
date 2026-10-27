
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import Header from '@/components/Header';
import IrrigationScheduleForm from '@/components/IrrigationScheduleForm';
import ScheduledIrrigationList from '@/components/ScheduledIrrigationList';
import { useIrrigationSchedule } from '@/hooks/useIrrigationSchedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Power, Clock, CalendarClock, Droplets, CalendarDays, Sparkles } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { getDisplayedIrrigationStatus, getScheduleState } from '@/utils/irrigationMetrics';

const ControlPanelPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop } = useCrop();
  const cropId = selectedCrop?.id || '';
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState('OFF');
  const [lastLog, setLastLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [manualOverrideUntil, setManualOverrideUntil] = useState(null);
  
  // Schedule Hook
  const { 
    schedules, 
    loading: schedulesLoading, 
    error: schedulesError,
    addSchedule, 
    updateSchedule, 
    deleteSchedule, 
    getNextScheduledTime,
    getScheduleStatus,
  } = useIrrigationSchedule();

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleClock, setScheduleClock] = useState(() => new Date());

  useEffect(() => {
    setManualOverrideUntil(selectedCrop?.manual_override_until || null);
  }, [selectedCrop?.id, selectedCrop?.manual_override_until]);

  const fetchCurrentStatus = useCallback(async () => {
    if (!currentUser || !cropId) {
      setCurrentStatus('OFF');
      setLastLog(null);
      setLoading(false);
      return;
    }
    try {
      const logs = await pb.collection('irrigation_logs').getList(1, 1, {
        filter: `cropId = "${cropId}"`,
        sort: '-created',
        $autoCancel: false,
      });

      if (logs.items.length > 0) {
        setCurrentStatus(logs.items[0].status);
        setLastLog(logs.items[0]);
      } else {
        setCurrentStatus('OFF');
        setLastLog(null);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching status:', err);
      setLoading(false);
    }
  }, [currentUser, cropId]);

  useEffect(() => {
    let active = true;
    let unsubscribe = null;
    setLoading(true);
    fetchCurrentStatus();
    if (!currentUser || !cropId) return () => { active = false; };
    pb.collection('irrigation_logs').subscribe('*', (event) => {
      if (!active || event.record?.cropId !== cropId) return;
      setCurrentStatus(event.record.status);
      setLastLog(event.record);
      setLoading(false);
    }).then((stop) => {
      const stopSafely = () => {
        const result = stop();
        if (result?.catch) result.catch((error) => console.error('Could not unsubscribe from irrigation status:', error));
      };
      if (active) unsubscribe = stopSafely;
      else stopSafely();
    }).catch((subscribeError) => {
      console.error('Could not subscribe to irrigation status:', subscribeError);
    });
    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, cropId, fetchCurrentStatus]);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setScheduleClock(new Date()), 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const handleToggleClick = () => {
    const newStatus = displayedStatus === 'ON' ? 'OFF' : 'ON';
    setPendingStatus(newStatus);
    setShowConfirmDialog(true);
  };

  const handleConfirmToggle = async () => {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      if (!currentUser || !selectedCrop) {
        throw new Error('Selecciona un cultivo antes de cambiar el riego.');
      }
      const response = await pb.send('/api/neptuno/irrigation/manual', {
        method: 'POST',
        body: { cropId: selectedCrop.id, status: pendingStatus },
      });

      setCurrentStatus(response.log.status);
      setLastLog(response.log);
      setManualOverrideUntil(response.manual_override_until || null);

      toast({
        title: 'Éxito',
        description: `Sistema de riego ${pendingStatus === 'ON' ? 'activado' : 'desactivado'}`,
        variant: 'default',
      });
    } catch (err) {
      console.error('Error toggling irrigation:', err);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del riego. Por favor, inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setPendingStatus(null);
    }
  };

  const handleCancelToggle = () => {
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  const handleSaveSchedule = async (startTime, endTime, date, recurrence, days) => {
    if (editingSchedule && Object.keys(editingSchedule).length > 0) {
      if (getScheduleState(editingSchedule, scheduleClock) === 'past') {
        return { success: false, error: 'Este horario ya pasó y no se puede editar.' };
      }
      const result = await updateSchedule(editingSchedule.id, startTime, endTime, date, recurrence, days);
      if (result.success) setEditingSchedule(null);
      return result;
    }

    return await addSchedule(startTime, endTime, date, recurrence, days);
  };

  const handleEditSchedule = (schedule) => {
    if (getScheduleState(schedule, scheduleClock) === 'past') return;
    setEditingSchedule(schedule);
  };

  const handleDeleteSchedule = async (id) => {
    const result = await deleteSchedule(id);
    if (result.success) {
      toast({
        title: 'Éxito',
        description: 'Horario eliminado exitosamente',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo eliminar el horario',
        variant: 'destructive',
      });
    }
  };

  const handleResumeAutomatic = async () => {
    if (!selectedCrop) return;
    try {
      await pb.collection('crops').update(selectedCrop.id, { manual_override_until: '' }, { $autoCancel: false });
      setManualOverrideUntil(null);
      toast({ title: 'Control automático reanudado', description: 'El cultivo volverá a responder a sus umbrales.' });
    } catch (error) {
      console.error('Could not resume automatic irrigation:', error);
      toast({ title: 'Error', description: 'No se pudo reanudar el control automático.', variant: 'destructive' });
    }
  };

  const scheduleStatus = getScheduleStatus(scheduleClock);
  const activeSchedule = scheduleStatus.activeSchedule;
  const nextTime = scheduleStatus.nextSchedule?.startDate || getNextScheduledTime();
  const displayedStatus = getDisplayedIrrigationStatus(currentStatus, lastLog, activeSchedule);
  const manualStopDuringSchedule = activeSchedule
    && lastLog?.status === 'OFF'
    && lastLog?.source === 'MANUAL'
    && new Date(lastLog.created) >= activeSchedule.startDate;
  const automaticScheduleEnded = lastLog?.status === 'OFF'
    && lastLog?.source === 'AUTOMATIC'
    && !activeSchedule;
  const statusDescription = activeSchedule && displayedStatus === 'ON'
    ? 'Riego activado por horario'
    : manualStopDuringSchedule
      ? 'Riego pausado manualmente durante el horario'
    : automaticScheduleEnded
      ? 'Riego finalizado según el horario'
      : displayedStatus === 'ON'
        ? 'Riego activado manualmente'
        : 'Riego desactivado';
  const remainingMs = activeSchedule ? Math.max(0, activeSchedule.endDate - scheduleClock) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMinutesPart = remainingMinutes % 60;
  const manualOverrideActive = selectedCrop?.control_mode === 'AUTO'
    && manualOverrideUntil
    && new Date(manualOverrideUntil).getTime() > scheduleClock.getTime();

  return (
    <>
      <Helmet>
        <title>Panel de Control - Neptuno</title>
        <meta name="description" content="Controla tu sistema de riego de forma remota con actualizaciones de estado en tiempo real y programación automática" />
      </Helmet>

      <Header />

      <div className="relative min-h-screen overflow-hidden bg-[#f4fbfa] py-10 sm:py-14">
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Riego inteligente
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Panel de Control</h1>
            <p className="mt-2 text-base text-slate-600 sm:text-lg">Controla el riego y organiza tus próximos horarios desde un solo lugar.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Manual Control */}
            <div className="lg:col-span-5 space-y-8">
              <Card className="overflow-hidden rounded-3xl border-white/80 bg-white shadow-xl shadow-slate-900/5">
                <CardHeader className="border-b border-slate-100 pb-6 text-center bg-teal-50/70">
                  <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                    <Power className="h-5 w-5" />
                  </span>
                  <CardTitle className="mb-1 text-2xl tracking-tight text-slate-900">Control Manual</CardTitle>
                  <CardDescription className="text-slate-500">
                    Activa o desactiva el riego instantáneamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-7 p-6 sm:p-8">
                  {/* Status Display */}
                  <div className="text-center">
                    <div className={`inline-flex items-center gap-3 rounded-full border px-5 py-3 ${
                      displayedStatus === 'ON'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}>
                      <div className={`h-3 w-3 rounded-full ${
                        displayedStatus === 'ON' ? 'animate-pulse bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-400 ring-4 ring-slate-200'
                      }`}></div>
                      <span className={`text-sm font-bold tracking-wide ${
                        displayedStatus === 'ON' ? 'text-emerald-800' : 'text-slate-700'
                      }`}>
                        {displayedStatus === 'ON' ? 'RIEGO ACTIVADO' : 'RIEGO DESACTIVADO'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <div className="flex justify-center">
                    <Button
                      onClick={handleToggleClick}
                      disabled={loading}
                      size="lg"
                      className={`h-14 w-full max-w-[280px] rounded-2xl text-base font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                        displayedStatus === 'ON'
                          ? 'text-white bg-rose-600 hover:bg-rose-700'
                          : 'text-white bg-teal-700 hover:bg-teal-800'
                      }`}
                    >
                      <Power className="w-6 h-6 mr-3" />
                      {loading ? 'Procesando...' : displayedStatus === 'ON' ? 'Desactivar Riego' : 'Activar Riego'}
                    </Button>
                  </div>
                  <p className={`text-center text-sm font-medium ${displayedStatus === 'ON' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {statusDescription}
                  </p>
                  {manualOverrideActive && (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                      <p className="text-sm font-semibold text-amber-900">
                        Control manual activo hasta {new Date(manualOverrideUntil).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <Button type="button" variant="outline" className="min-h-10 border-amber-300" onClick={handleResumeAutomatic}>
                        Volver a automático
                      </Button>
                    </div>
                  )}

                  {/* Last Activity */}
                  {lastLog && (
                    <div className="rounded-2xl border border-teal-100 p-4 bg-teal-50/70">
                      <div className="flex items-start space-x-3">
                        <Clock className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="mb-0.5 text-sm font-semibold text-slate-900">Última Actividad</p>
                          <p className="text-gray-700 text-sm">
                            Sistema <span className="font-semibold">{lastLog.status === 'ON' ? 'activado' : 'desactivado'}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(lastLog.created).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Next Scheduled Info Card */}
              <Card className="overflow-hidden rounded-3xl border-teal-100 bg-white shadow-lg shadow-slate-900/5">
                <CardContent className="relative p-6 sm:p-7 bg-teal-50/70">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-2xl bg-teal-100 p-3 text-teal-700">
                      <CalendarClock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-teal-700">
                        {activeSchedule && displayedStatus === 'ON'
                          ? 'Riego activo'
                          : activeSchedule
                            ? 'Horario en pausa'
                            : nextTime
                              ? 'Próximo riego programado'
                              : 'Sin riegos pendientes'}
                      </p>
                      {activeSchedule && displayedStatus === 'ON' ? (
                        <>
                          <p className="text-2xl font-bold text-slate-900">En uso</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            Cierra a las {activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            Tiempo restante: {remainingHours} h {String(remainingMinutesPart).padStart(2, '0')} min
                          </p>
                        </>
                      ) : activeSchedule ? (
                        <>
                          <p className="text-2xl font-bold text-slate-900">Riego pausado</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            El horario termina a las {activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </>
                      ) : nextTime ? (
                        <>
                          <p className="text-2xl font-bold text-slate-900">
                            {nextTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {nextTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </>
                      ) : (
                        <p className="text-lg font-semibold text-slate-700">
                          {schedules.length > 0 ? 'Los horarios guardados ya pasaron.' : 'No hay riegos programados.'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Scheduling */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Programación Automática</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Define cuándo regar tus cultivos.</p>
                  </div>
                </div>
                {!editingSchedule && (
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingSchedule({})} 
                    className="rounded-xl border-teal-200 bg-white font-semibold text-teal-700 shadow-sm hover:bg-teal-50 hover:text-teal-800"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Nuevo horario
                  </Button>
                )}
              </div>

              {editingSchedule && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <IrrigationScheduleForm 
                    initialData={Object.keys(editingSchedule).length > 0 ? editingSchedule : null}
                    onSave={handleSaveSchedule}
                    onCancel={() => setEditingSchedule(null)}
                  />
                </div>
              )}

              <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Horarios guardados</h3>
                    <p className="mt-1 text-sm text-slate-500">Consulta o ajusta tus riegos programados.</p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                    {schedules.length} {schedules.length === 1 ? 'horario' : 'horarios'}
                  </span>
                </div>
                <ScheduledIrrigationList 
                  schedules={schedules} 
                  loading={schedulesLoading}
                  error={schedulesError}
                  onEdit={handleEditSchedule}
                  onDelete={handleDeleteSchedule}
                  referenceDate={scheduleClock}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas {pendingStatus === 'ON' ? 'activar' : 'desactivar'} el sistema de riego? Esta acción tendrá efecto inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelToggle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={pendingStatus === 'ON' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ControlPanelPage;
