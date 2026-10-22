
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
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
import { format, startOfDay } from 'date-fns';
import {
  buildIrrigationSessions,
  estimateDailyConsumption,
  getActiveSchedule,
  getDisplayedIrrigationStatus,
  getScheduleState,
  LITERS_PER_SQUARE_METER_LABEL,
} from '@/utils/irrigationMetrics';

const getCultivatedAreaStorageKey = (userId) => `neptuno:cultivated-area:${userId}`;

const getStoredCultivatedArea = (userId) => {
  try {
    return localStorage.getItem(getCultivatedAreaStorageKey(userId)) || '';
  } catch (storageError) {
    console.error('Error reading locally cached cultivated area:', storageError);
    return '';
  }
};

const setStoredCultivatedArea = (userId, area) => {
  try {
    localStorage.setItem(getCultivatedAreaStorageKey(userId), String(area));
  } catch (storageError) {
    console.error('Error caching cultivated area locally:', storageError);
  }
};

const selectSettingsRecord = (records) => (
  records.find((record) => Number(record.cultivated_area_m2) > 0) || records[0] || null
);

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { alerts } = useAlert();
  const [sensorData, setSensorData] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const [irrigationLogs, setIrrigationLogs] = useState([]);
  const [cultivatedArea, setCultivatedArea] = useState('');
  const [areaDraft, setAreaDraft] = useState('');
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaMessage, setAreaMessage] = useState('');
  const areaDirtyRef = useRef(false);
  const areaSyncVersionRef = useRef(0);
  const areaSavingRef = useRef(false);
  const confirmedAreaRef = useRef('');
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setError('');
      const fetchedAt = new Date();
      const areaSyncVersion = areaSyncVersionRef.current;

      const [readingsResult, settingsResult, logsResult] = await Promise.allSettled([
        pb.collection('sensor_readings').getList(1, 1, {
          filter: `userId = "${currentUser.id}"`,
          sort: '-created',
          $autoCancel: false,
        }),
        pb.collection('user_settings').getList(1, 50, {
          filter: `userId = "${currentUser.id}"`,
          sort: '-updated',
          $autoCancel: false,
        }),
        pb.collection('irrigation_logs').getFullList({
          filter: `userId = "${currentUser.id}"`,
          sort: '-created',
          $autoCancel: false,
        }),
      ]);

      setSensorData(readingsResult.status === 'fulfilled' ? readingsResult.value.items[0] || null : null);
      if (
        settingsResult.status === 'fulfilled'
        && areaSyncVersion === areaSyncVersionRef.current
        && !areaSavingRef.current
      ) {
        const settings = selectSettingsRecord(settingsResult.value.items);
        setScheduleData(settings);
        const remoteArea = settings?.cultivated_area_m2
          ? String(settings.cultivated_area_m2)
          : '';
        const savedArea = confirmedAreaRef.current
          || remoteArea
          || getStoredCultivatedArea(currentUser.id);
        if (!confirmedAreaRef.current && remoteArea) {
          confirmedAreaRef.current = remoteArea;
        }
        setCultivatedArea(savedArea);
        if (!areaDirtyRef.current) setIsEditingArea(!savedArea);
        if (!areaDirtyRef.current) setAreaDraft(savedArea);
      }
      const logs = logsResult.status === 'fulfilled' ? logsResult.value : [];
      setIrrigationLogs(logs);
      setLatestLog(logs[0] || null);
      setNow(fetchedAt);
      const failedLoads = [readingsResult, settingsResult, logsResult]
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
  };

  useEffect(() => {
    if (!currentUser) return undefined;

    fetchData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const getScheduleTimes = () => {
    if (!scheduleData?.irrigation_schedule_times) return [];

    try {
      const parsed = JSON.parse(scheduleData.irrigation_schedule_times);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((schedule) => schedule && typeof schedule === 'object')
          .sort((first, second) => {
            const getStartDate = (schedule) => {
              const date = schedule.date || schedule.startDate;
              const time = schedule.startTime || schedule.time || '00:00';
              return date ? new Date(`${date}T${time}`).getTime() : Number.POSITIVE_INFINITY;
            };
            return getStartDate(first) - getStartDate(second);
          });
      }
    } catch {
      // Keep compatibility with schedules saved in the original comma-separated format.
    }

    return String(scheduleData.irrigation_schedule_times)
      .split(',')
      .map((time) => ({ startTime: time.trim() }))
      .filter((schedule) => schedule.startTime);
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

  const activeSchedule = getActiveSchedule(scheduleData?.irrigation_schedule_times, now);
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
  const estimatedConsumptionToday = estimateDailyConsumption(sessions, today, now, cultivatedArea)
    .get(format(now, 'yyyy-MM-dd')) || 0;

  const saveCultivatedArea = async (event) => {
    event.preventDefault();
    const area = Number(areaDraft);
    if (!Number.isFinite(area) || area <= 0) {
      setAreaMessage('Introduce un área mayor que cero.');
      return;
    }

    areaDirtyRef.current = true;
    areaSavingRef.current = true;
    areaSyncVersionRef.current += 1;
    setAreaSaving(true);
    setAreaMessage('');
    try {
      const settingsCollection = pb.collection('user_settings');
      const settingsResult = await settingsCollection.getList(1, 50, {
        filter: `userId = "${currentUser.id}"`,
        sort: '-updated',
        $autoCancel: false,
      });
      const existingSettings = selectSettingsRecord(settingsResult.items);
      let savedSettings;
      if (existingSettings?.id) {
        savedSettings = await settingsCollection.update(existingSettings.id, {
          userId: currentUser.id,
          cultivated_area_m2: area,
        }, { $autoCancel: false });
      } else {
        savedSettings = await settingsCollection.create({
          userId: currentUser.id,
          irrigation_schedule_times: '[]',
          cultivated_area_m2: area,
        }, { $autoCancel: false });
      }
      const verifiedArea = Number(savedSettings?.cultivated_area_m2);
      if (verifiedArea !== area) {
        throw new Error('PocketBase no confirmó el área guardada. Reinicia el servidor para aplicar sus migraciones y vuelve a intentarlo.');
      }
      setScheduleData(savedSettings);
      setCultivatedArea(String(area));
      setAreaDraft(String(area));
      setStoredCultivatedArea(currentUser.id, area);
      confirmedAreaRef.current = String(area);
      areaSyncVersionRef.current += 1;
      areaDirtyRef.current = false;
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
      areaSavingRef.current = false;
      setAreaSaving(false);
    }
  };

  const cancelAreaEdit = () => {
    areaDirtyRef.current = false;
    setAreaDraft(cultivatedArea);
    setIsEditingArea(!cultivatedArea);
    setAreaMessage('');
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
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

      <main className="relative min-h-screen overflow-hidden bg-[#f4fbfa] py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-br from-teal-100/80 via-cyan-50/70 to-transparent" />
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-700 shadow-sm">
                <Activity className="h-3.5 w-3.5" /> Monitoreo en vivo
              </span>
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
                <Button className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-semibold text-white shadow-md shadow-teal-700/15 hover:from-teal-700 hover:to-cyan-700">
                  Controlar riego <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

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
            <Card className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-sm shadow-slate-900/5">
              <CardContent className="flex items-center justify-between gap-4 bg-gradient-to-r from-white to-teal-50/70 p-6">
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
                    {Number(cultivatedArea) > 0 ? `${estimatedConsumptionToday.toFixed(1)} L` : 'Configura el área'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {Number(cultivatedArea) > 0
                      ? `${cultivatedArea} m² × ${LITERS_PER_SQUARE_METER_LABEL} L/m² por sesión`
                      : 'El cálculo necesita la superficie de cultivo.'}
                  </p>
                  {isEditingArea ? (
                    <form onSubmit={saveCultivatedArea} className="mt-4 space-y-2">
                      <label htmlFor="cultivated-area" className="block text-sm font-medium text-slate-700">
                        Área de cultivo (m²)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          id="cultivated-area"
                          type="number"
                          min="0.01"
                          step="any"
                          inputMode="decimal"
                          value={areaDraft}
                          onChange={(event) => {
                            areaDirtyRef.current = true;
                            setAreaDraft(event.target.value);
                          }}
                          className="h-10 min-w-0"
                          placeholder="Ej. 120"
                          required
                        />
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
                      <p className="text-sm font-medium text-slate-700">Área registrada: {cultivatedArea} m²</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAreaMessage('');
                          areaDirtyRef.current = true;
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md">
                    <Thermometer className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="mb-4 text-sm font-semibold text-slate-600">Temperatura</p>
                <GaugeChart value={sensorData?.temperature || 0} min={0} max={50} unit="°C" />
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
                      className="flex items-center justify-between rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-4"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md">
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
