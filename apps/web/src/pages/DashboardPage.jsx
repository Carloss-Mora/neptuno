
import { soilState } from '@/utils/soilState';
import AreaInput from '@/components/AreaInput';
import { formatArea } from '@/utils/area';
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { tempFromCelsius, tempUnitLabel } from '@/utils/units';
import { useIrrigationSchedule } from '@/hooks/useIrrigationSchedule';
import { useAlert } from '@/contexts/AlertContext';
import Header from '@/components/Header';
import SensorCard from '@/components/SensorCard';
import GaugeChart from '@/components/GaugeChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, Thermometer, Waves, Clock, AlertCircle, Bell, ArrowRight, Activity, CalendarDays, Gauge } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { toFormValue } from '@/utils/optionalNumber';
import { format, startOfDay } from 'date-fns';
import {
  buildIrrigationSessions,
  estimateDailyConsumption,
  getActiveSchedule,
  getDisplayedIrrigationStatus,
  getScheduleState,
} from '@/utils/irrigationMetrics';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop, updateCrop } = useCrop();
  const { settings: prefs, formatVolume } = useUserSettings();
  const cropId = selectedCrop?.id || '';
  const { schedules } = useIrrigationSchedule();
  const { alerts } = useAlert();
  const [sensorData, setSensorData] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const [irrigationLogs, setIrrigationLogs] = useState([]);
  const [cultivatedArea, setCultivatedArea] = useState('');
  const [areaDraft, setAreaDraft] = useState('');
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaMessage, setAreaMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const area = toFormValue(selectedCrop?.area_m2);
    setCultivatedArea(area);
    setAreaDraft(area);
    setIsEditingArea(!area);
    setAreaMessage('');
  }, [selectedCrop?.id, selectedCrop?.area_m2]);

  const fetchData = useCallback(async () => {
    if (!currentUser || !cropId) {
      setSensorData(null);
      setLatestLog(null);
      setIrrigationLogs([]);
      setLoading(false);
      return;
    }
    try {
      setError('');
      const fetchedAt = new Date();

      const [readingsResult, logsResult] = await Promise.allSettled([
        pb.collection('sensor_readings').getList(1, 1, {
          filter: `cropId = "${cropId}"`,
          sort: '-created',
          $autoCancel: false,
        }),
        pb.collection('irrigation_logs').getFullList({
          filter: `cropId = "${cropId}"`,
          sort: '-created',
          $autoCancel: false,
        }),
      ]);

      setSensorData(readingsResult.status === 'fulfilled' ? readingsResult.value.items[0] || null : null);
      const logs = logsResult.status === 'fulfilled' ? logsResult.value : [];
      setIrrigationLogs(logs);
      setLatestLog(logs[0] || null);
      setNow(fetchedAt);
      const failedLoads = [readingsResult, logsResult]
        .filter((result) => result.status === 'rejected');
      if (failedLoads.length > 0) {
        throw failedLoads[0].reason;
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos de los sensores. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, cropId]);

  useEffect(() => {
    let active = true;
    const subscriptions = [];
    fetchData();

    if (!currentUser || !cropId) {
      return () => { active = false; };
    }

    const subscribe = async (collectionName, onRecord) => {
      try {
        const unsubscribe = await pb.collection(collectionName).subscribe('*', (event) => {
          if (active && event.record?.cropId === cropId) onRecord(event.record);
        });
        const stop = () => {
          const result = unsubscribe();
          if (result?.catch) result.catch((error) => console.error(`Could not unsubscribe from ${collectionName}:`, error));
        };
        if (active) subscriptions.push(stop);
        else stop();
      } catch (subscribeError) {
        console.error(`Could not subscribe to ${collectionName}:`, subscribeError);
        if (active) setError('No se pudieron activar las actualizaciones en tiempo real.');
      }
    };

    subscribe('sensor_readings', (record) => {
      setSensorData((current) => !current || new Date(record.created) >= new Date(current.created) ? record : current);
      setNow(new Date());
    });
    subscribe('irrigation_logs', (record) => {
      setIrrigationLogs((current) => {
        const records = [record, ...current.filter((item) => item.id !== record.id)];
        return records.sort((first, second) => new Date(second.created) - new Date(first.created));
      });
      setLatestLog((current) => !current || new Date(record.created) >= new Date(current.created) ? record : current);
      setNow(new Date());
    });

    return () => {
      active = false;
      subscriptions.forEach((stop) => stop());
    };
  }, [currentUser, cropId, fetchData]);

  const getScheduleTimes = () => {
    return [...schedules]
      .filter((schedule) => schedule && typeof schedule === 'object')
      .sort((first, second) => {
        const getStartDate = (schedule) => {
          const date = schedule.date || schedule.startDate;
          const time = schedule.startTime || schedule.time || '00:00';
          return date ? new Date(`${date}T${time}`).getTime() : Number.POSITIVE_INFINITY;
        };
        return getStartDate(first) - getStartDate(second);
      });
  };

  const formatScheduleTime = (timeValue) => {
    if (!timeValue) return '00:00';
    const [hours, minutes] = String(timeValue).split(':');
    const hour = Number.parseInt(hours, 10);
    const minute = Number.parseInt(minutes, 10) || 0;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour + 11) % 12) + 1;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const formatScheduleDate = (dateValue) => {
    if (!dateValue) return 'Fecha no especificada';
    const date = new Date(`${dateValue}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? dateValue
      : date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const activeSchedule = getActiveSchedule(schedules, now);
  const upcomingSchedule = getScheduleTimes()
    .filter((schedule) => getScheduleState(schedule, now) === 'upcoming')
    .sort((first, second) => {
      const getStartDate = (schedule) => {
        const date = schedule.date || schedule.startDate;
        const time = schedule.startTime || schedule.time || '00:00';
        return new Date(`${date || format(now, 'yyyy-MM-dd')}T${time}`).getTime();
      };
      return getStartDate(first) - getStartDate(second);
    })[0] || null;
  const displayedStatus = getDisplayedIrrigationStatus(latestLog?.status, latestLog, activeSchedule);
  const sessions = buildIrrigationSessions(irrigationLogs, now);
  const today = startOfDay(now);
  const flowRate = Number(selectedCrop?.flow_lpm) || null;
  const estimatedConsumptionToday = estimateDailyConsumption(sessions, today, now, flowRate)
    .get(format(now, 'yyyy-MM-dd')) || 0;

  const saveCultivatedArea = async (event) => {
    event.preventDefault();
    const area = Number(areaDraft);
    if (!Number.isFinite(area) || area <= 0) {
      setAreaMessage('Introduce un área mayor que cero.');
      return;
    }

    setAreaSaving(true);
    setAreaMessage('');
    try {
      if (!selectedCrop) throw new Error('Crea o selecciona un cultivo antes de configurar el área.');
      const savedCrop = await updateCrop(selectedCrop.id, { ...selectedCrop, area_m2: area });
      const verifiedArea = Number(savedCrop?.area_m2);
      if (verifiedArea !== area) {
        throw new Error('No se confirmó el área guardada. Inténtalo de nuevo.');
      }
      setCultivatedArea(String(area));
      setAreaDraft(String(area));
      setIsEditingArea(false);
      setAreaMessage('Área guardada.');
    } catch (saveError) {
      console.error('Error saving cultivated area:', saveError);
      const fieldMessages = Object.values(saveError?.data?.data || {})
        .map((fieldError) => fieldError?.message)
        .filter(Boolean);
      setAreaMessage(
        fieldMessages.join(' ')
        || saveError?.data?.message
        || saveError?.message
        || 'No se pudo guardar el área. Intenta de nuevo.',
      );
    } finally {
      setAreaSaving(false);
    }
  };

  const cancelAreaEdit = () => {
    setAreaDraft(cultivatedArea);
    setIsEditingArea(!cultivatedArea);
    setAreaMessage('');
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen py-16 bg-dew">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-6 w-full max-w-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Inicio - Neptuno</title>
        <meta name="description" content="Monitorea tu sistema de riego en tiempo real con datos de sensores y análisis en vivo" />
      </Helmet>

      <Header />

      <main className="relative min-h-screen overflow-hidden bg-dew py-10 sm:py-14">
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700 shadow-sm">
                <Activity className="h-3.5 w-3.5" /> Monitoreo en vivo
              </span>
              {(sensorData?.is_demo || irrigationLogs.some((log) => log.is_demo)) && (
                <span className="mb-3 ml-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">Demo</span>
              )}
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Panel Principal</h1>
              <p className="mt-2 text-base text-slate-600 sm:text-lg">El estado de tu cultivo, claro y al momento.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {alerts.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 shadow-sm">
                  <Bell className="h-5 w-5 animate-pulse" />
                  <span className="font-semibold">{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              <Link to="/control">
                <Button className="rounded-xl font-semibold text-white shadow-md shadow-teal-700/15 bg-teal-700 hover:bg-teal-800">
                  Controlar riego <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {!selectedCrop && (
            <div className="mb-6 rounded-2xl border border-teal-200 bg-white p-6 text-slate-700">
              <p className="font-semibold">Aún no hay un cultivo seleccionado.</p>
              <Link to="/crops" className="mt-2 inline-block font-semibold text-teal-700 hover:underline">Crear o seleccionar cultivo</Link>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error al Cargar Datos</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="overflow-hidden rounded-3xl border border-teal-100 bg-teal-50 shadow-sm shadow-slate-900/5">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Estado del sistema</p>
                  <p className={`mt-2 text-2xl font-bold ${displayedStatus === 'ON' ? 'text-emerald-800' : 'text-slate-800'}`}>
                    {displayedStatus === 'ON' ? 'Riego activo' : 'Riego inactivo'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeSchedule && displayedStatus === 'ON'
                      ? `Horario activo hasta las ${activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                      : latestLog?.created
                        ? `Último cambio ${new Date(latestLog.created).toLocaleString('es-ES')}`
                        : 'Aún no hay actividad registrada'}
                  </p>
                </div>
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${displayedStatus === 'ON' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'}`}>
                  <Droplets className="h-7 w-7" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5">
              <CardContent className="flex h-full items-center justify-between gap-4 p-6">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {activeSchedule && displayedStatus === 'ON'
                      ? 'Riego programado'
                      : activeSchedule
                        ? 'Horario en pausa'
                        : upcomingSchedule
                          ? 'Próximo riego'
                          : getScheduleTimes().length > 0
                            ? 'Horarios vencidos'
                            : 'Próximo riego'}
                  </p>
                  {activeSchedule && displayedStatus === 'ON' ? (
                    <>
                      <p className="mt-2 text-2xl font-extrabold text-emerald-800">En curso</p>
                      <p className="mt-1 text-sm text-slate-500">Finaliza a las {activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    </>
                  ) : activeSchedule ? (
                    <>
                      <p className="mt-2 text-2xl font-extrabold text-slate-900">Riego pausado</p>
                      <p className="mt-1 text-sm text-slate-500">El horario termina a las {activeSchedule.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    </>
                  ) : upcomingSchedule ? (
                    <>
                      <p className="mt-2 text-2xl font-extrabold text-slate-900">{formatScheduleTime(upcomingSchedule.startTime || upcomingSchedule.time)}</p>
                      <p className="mt-1 text-sm capitalize text-slate-500">{upcomingSchedule.date || upcomingSchedule.startDate ? formatScheduleDate(upcomingSchedule.date || upcomingSchedule.startDate) : 'Horario programado'}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">Sin riegos pendientes</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {getScheduleTimes().length > 0 ? 'Los horarios guardados ya pasaron.' : 'Programa el siguiente riego.'}
                      </p>
                    </>
                  )}
                </div>
                <Link to="/control" aria-label="Configurar horarios de riego" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100">
                  <CalendarDays className="h-6 w-6" />
                </Link>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-sky-100 bg-white shadow-lg shadow-slate-900/5">
              <CardContent className="flex h-full items-center justify-between gap-4 p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-500">Consumo estimado hoy</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {flowRate ? formatVolume(estimatedConsumptionToday) : 'Configura el caudal'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {flowRate
                      ? `${flowRate} L/min × duración real`
                      : 'El cálculo requiere el caudal medido del cultivo.'}
                  </p>
                  {isEditingArea ? (
                    <form onSubmit={saveCultivatedArea} className="mt-4 space-y-2">
                      <label htmlFor="cultivated-area" className="block text-sm font-medium text-slate-700">
                        Área total del cultivo
                      </label>
                      <div className="flex gap-2">
                        <AreaInput id="cultivated-area" valueM2={areaDraft} onChangeM2={setAreaDraft} placeholder="Ej. 120" required />
                        <Button type="submit" disabled={areaSaving} className="shrink-0 bg-teal-700 text-white hover:bg-teal-800">
                          {areaSaving ? 'Guardando…' : 'Guardar'}
                        </Button>
                      </div>
                      {cultivatedArea && (
                        <Button type="button" variant="ghost" onClick={cancelAreaEdit} disabled={areaSaving} className="h-8 px-2 text-slate-600">
                          Cancelar
                        </Button>
                      )}
                      {areaMessage && (
                        <p role={areaMessage === 'Área guardada.' ? 'status' : 'alert'} className={`text-xs ${areaMessage === 'Área guardada.' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {areaMessage}
                        </p>
                      )}
                    </form>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-slate-700">Área total registrada: {formatArea(cultivatedArea)}</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAreaMessage('');
                          setIsEditingArea(true);
                        }}
                        className="h-9 border-teal-200 px-3 text-teal-700 hover:bg-teal-50"
                      >
                        Modificar área
                      </Button>
                      {areaMessage && (
                        <p role={areaMessage === 'Área guardada.' ? 'status' : 'alert'} className={`text-xs ${areaMessage === 'Área guardada.' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {areaMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Droplets className="h-6 w-6" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
          </section>

          {/* Sensor Cards Grid */}
          <section className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Lecturas de sensores</h2>
                <p className="mt-1 text-sm text-slate-500">{sensorData?.created ? `Actualizado ${new Date(sensorData.created).toLocaleString('es-ES')}` : 'Esperando la primera lectura de sensores'}</p>
              </div>
              <Gauge className="h-5 w-5 text-teal-600" />
            </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <SensorCard
              icon={Droplets}
              label="Humedad del Suelo"
              value={sensorData ? Number(sensorData.soil_humidity).toFixed(1) : '--'}
              unit="%"
              progress={sensorData?.soil_humidity || 0}
              color="teal"
              badge={soilState(sensorData?.soil_humidity, selectedCrop)}
            />

            <SensorCard
              icon={Waves}
              label="Nivel de Agua"
              value={sensorData ? Number(sensorData.water_level).toFixed(1) : '--'}
              unit="%"
              progress={sensorData?.water_level || 0}
              color="blue"
            />

            <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Thermometer className="w-6 h-6" />
                  </div>
                </div>
                <p className="mb-4 text-sm font-semibold text-slate-600">Temperatura</p>
                <GaugeChart value={tempFromCelsius(sensorData?.temperature || 0, prefs.unit_temp)} min={tempFromCelsius(0, prefs.unit_temp)} max={tempFromCelsius(50, prefs.unit_temp)} unit={tempUnitLabel(prefs.unit_temp)} />
              </CardContent>
            </Card>
          </div>
          </section>

          {/* Irrigation Schedule Card */}
          <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-xl">
                <span className="flex items-center gap-2"><Clock className="h-6 w-6 text-teal-600" />
                <span>Horario de Riego</span>
                </span>
                <Link to="/control" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900">Ver todos <ArrowRight className="h-4 w-4" /></Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getScheduleTimes().length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">Próximos horarios programados:</p>
                  {getScheduleTimes().map((schedule, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-2xl border border-teal-100 p-4 bg-teal-50/70"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md bg-teal-700">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatScheduleTime(schedule.startTime || schedule.time)}
                            {schedule.endTime && ` - ${formatScheduleTime(schedule.endTime)}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            {schedule.date ? formatScheduleDate(schedule.date) : 'Riego diario'}
                          </p>
                              {getScheduleState(schedule, now) === 'past' && (
                                <p className="mt-1 text-xs font-semibold text-slate-500">Ya pasó</p>
                              )}
                            </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-slate-600">No hay horarios de riego configurados</p>
                  <Link to="/control" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900">Configurar horario <ArrowRight className="h-4 w-4" /></Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Updated */}
          {sensorData && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Última actualización: {new Date(sensorData.created).toLocaleString('es-ES')}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default DashboardPage;
