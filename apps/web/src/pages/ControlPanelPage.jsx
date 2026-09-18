
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import IrrigationScheduleForm from '@/components/IrrigationScheduleForm';
import ScheduledIrrigationList from '@/components/ScheduledIrrigationList';
import { useIrrigationSchedule } from '@/hooks/useIrrigationSchedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Power, Clock, CalendarClock } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const ControlPanelPage = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState('OFF');
  const [lastLog, setLastLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  
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

  const fetchCurrentStatus = async () => {
    try {
      const logs = await pb.collection('irrigation_logs').getList(1, 1, {
        filter: `userId = "${currentUser.id}"`,
        sort: '-created',
        $autoCancel: false,
      });

      if (logs.items.length > 0) {
        setCurrentStatus(logs.items[0].status);
        setLastLog(logs.items[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching status:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentStatus();

    const statusInterval = window.setInterval(fetchCurrentStatus, 15000);
    return () => window.clearInterval(statusInterval);
  }, [currentUser]);

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
      const newLog = await pb.collection('irrigation_logs').create({
        userId: currentUser.id,
        status: pendingStatus,
        source: 'MANUAL',
      }, { $autoCancel: false });

      setCurrentStatus(pendingStatus);
      setLastLog(newLog);

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

  const handleSaveSchedule = async (startTime, endTime, date) => {
    if (editingSchedule && Object.keys(editingSchedule).length > 0) {
      const result = await updateSchedule(editingSchedule.id, startTime, endTime, date);
      if (result.success) setEditingSchedule(null);
      return result;
    }

    return await addSchedule(startTime, endTime, date);
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

  const scheduleStatus = getScheduleStatus(scheduleClock);
  const activeSchedule = scheduleStatus.activeSchedule;
  const nextTime = scheduleStatus.nextSchedule?.startDate || getNextScheduledTime();
  const manualStop = lastLog?.status === 'OFF' && lastLog?.source === 'MANUAL';
  const automaticScheduleEnded = lastLog?.source === 'AUTOMATIC' && !activeSchedule;
  const displayedStatus = manualStop || automaticScheduleEnded
    ? 'OFF'
    : activeSchedule
      ? 'ON'
      : currentStatus;
  const statusDescription = activeSchedule
    ? 'Riego activado por horario'
    : automaticScheduleEnded
      ? 'Riego finalizado según el horario'
      : displayedStatus === 'ON'
        ? 'Riego activado manualmente'
        : 'Riego desactivado';
  const remainingMs = activeSchedule ? Math.max(0, activeSchedule.endDate - scheduleClock) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMinutesPart = remainingMinutes % 60;

  return (
    <>
      <Helmet>
        <title>Panel de Control - Neptuno</title>
        <meta name="description" content="Controla tu sistema de riego de forma remota con actualizaciones de estado en tiempo real y programación automática" />
      </Helmet>

      <Header />

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Page Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Panel de Control</h1>
            <p className="text-lg text-gray-600">Gestiona y programa tu sistema de riego</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Manual Control */}
            <div className="lg:col-span-5 space-y-8">
              <Card className="rounded-xl shadow-xl border-gray-100">
                <CardHeader className="text-center pb-6 border-b border-gray-50">
                  <CardTitle className="text-2xl mb-1">Control Manual</CardTitle>
                  <CardDescription>
                    Activa o desactiva el riego instantáneamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 pt-8">
                  {/* Status Display */}
                  <div className="text-center">
                    <div className={`inline-flex items-center space-x-3 px-6 py-3 rounded-2xl ${
                      displayedStatus === 'ON'
                        ? 'bg-green-100 border-2 border-green-300' 
                        : 'bg-gray-100 border-2 border-gray-300'
                    }`}>
                      <div className={`w-3 h-3 rounded-full ${
                        displayedStatus === 'ON' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`}></div>
                      <span className={`text-xl font-bold ${
                        displayedStatus === 'ON' ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        Sistema {displayedStatus === 'ON' ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <div className="flex justify-center">
                    <Button
                      onClick={handleToggleClick}
                      disabled={loading}
                      size="lg"
                      className={`w-full max-w-[240px] h-16 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${
                        displayedStatus === 'ON'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      <Power className="w-6 h-6 mr-3" />
                      {loading ? 'Procesando...' : displayedStatus === 'ON' ? 'Desactivar Riego' : 'Activar Riego'}
                    </Button>
                  </div>
                  <p className={`text-center text-sm font-medium ${displayedStatus === 'ON' ? 'text-green-700' : 'text-gray-500'}`}>
                    {statusDescription}
                  </p>

                  {/* Last Activity */}
                  {lastLog && (
                    <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                      <div className="flex items-start space-x-3">
                        <Clock className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm mb-0.5">Última Actividad</p>
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
              <Card className="rounded-xl shadow-md border-teal-200 bg-gradient-to-br from-teal-600 to-cyan-700 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="bg-white/20 p-3 rounded-full">
                      <CalendarClock className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-teal-100 font-medium mb-1">
                        {activeSchedule ? 'Riego activo' : 'Próximo Riego Programado'}
                      </p>
                      {activeSchedule ? (
                        <>
                          <p className="text-2xl font-bold">En uso</p>
                          <p className="text-sm text-teal-50 mt-0.5">
                            Cierra a las {activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm font-semibold text-white mt-1">
                            Tiempo restante: {remainingHours} h {String(remainingMinutesPart).padStart(2, '0')} min
                          </p>
                        </>
                      ) : nextTime ? (
                        <>
                          <p className="text-2xl font-bold">
                            {nextTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-teal-50 mt-0.5">
                            {nextTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </>
                      ) : (
                        <p className="text-lg font-semibold text-white">No hay riegos programados</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Scheduling */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-gray-900">Programación Automática</h2>
                {!editingSchedule && (
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingSchedule({})} 
                    className="text-teal-700 border-teal-200 hover:bg-teal-50"
                  >
                    + Nuevo Horario
                  </Button>
                )}
              </div>

              {editingSchedule && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <IrrigationScheduleForm 
                    initialData={Object.keys(editingSchedule).length > 0 ? editingSchedule : null}
                    onSave={handleSaveSchedule}
                    onCancel={() => setEditingSchedule(null)}
                  />
                </div>
              )}

              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Horarios Guardados</h3>
                <ScheduledIrrigationList 
                  schedules={schedules} 
                  loading={schedulesLoading}
                  error={schedulesError}
                  onEdit={setEditingSchedule}
                  onDelete={handleDeleteSchedule}
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
