import { useZones, zoneFlowTotal } from '@/hooks/useZones';
import { zoneStates } from '@/components/ZonesCard';
import { soilState, SOIL_TONE_CLASSES } from '@/utils/soilState';
import { formatArea } from '@/utils/area';
import { startReason, endReason } from '@/utils/irrigationReason';
import { stageForDate } from '@/utils/strawberryStages';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, Thermometer, Waves, Clock, AlertCircle, Bell, ArrowRight, CalendarDays, CloudRain, MapPin, Sprout } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { format, startOfDay } from 'date-fns';
import {
  buildIrrigationSessions,
  estimateDailyConsumption,
  getActiveSchedule,
  getDisplayedIrrigationStatus,
  getScheduleState,
} from '@/utils/irrigationMetrics';

const MODE_LABELS = { MANUAL: 'Manual', SCHEDULE: 'Programado', AUTO: 'Automático' };
const STAGE_LABELS = { vegetativo: 'Vegetativo', 'floración': 'Floración', 'fructificación': 'Fructificación' };
const RAIN_FRESH_MS = 2 * 60 * 60 * 1000;

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop, crops } = useCrop();
  const { settings: prefs, formatVolume } = useUserSettings();
  const cropId = selectedCrop?.id || '';
  const { schedules } = useIrrigationSchedule();
  const { zones, flows: zoneFlows } = useZones(selectedCrop);
  const { alerts } = useAlert();
  const [sensorData, setSensorData] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const [irrigationLogs, setIrrigationLogs] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setLatestLog(logs.find((log) => !log.zoneId) || null);
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
      if (!record.zoneId) setLatestLog((current) => !current || new Date(record.created) >= new Date(current.created) ? record : current);
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
  const sessions = buildIrrigationSessions(irrigationLogs, now, zoneFlows);
  const today = startOfDay(now);
  const flowRate = Number(selectedCrop?.flow_lpm) || zoneFlowTotal(zoneFlows) || null;
  const estimatedConsumptionToday = estimateDailyConsumption(sessions, today, now, flowRate)
    .get(format(now, 'yyyy-MM-dd')) || 0;

  const states = zoneStates(irrigationLogs);
  const stageInfo = selectedCrop ? stageForDate(selectedCrop.planting_date, now) : null;
  const stageKey = selectedCrop?.phenological_stage || stageInfo?.stage || '';
  const humidity = sensorData ? Number(sensorData.soil_humidity) : null;
  const soil = soilState(humidity, selectedCrop);
  const hasRange = Number(selectedCrop?.humidity_min) > 0 && Number(selectedCrop?.humidity_max) > 0;
  const forecastFresh = selectedCrop?.rain_skip && selectedCrop?.growing_environment !== 'greenhouse' && selectedCrop?.rain_forecast_at
    && now.getTime() - new Date(selectedCrop.rain_forecast_at).getTime() < RAIN_FRESH_MS;
  const forecastMm = Number(selectedCrop?.rain_forecast_mm) || 0;
  const totalFarmM2 = (crops || []).reduce((total, crop) => total + (Number(crop.area_m2) > 0 ? Number(crop.area_m2) : 0), 0);
  const cropArea = Number(selectedCrop?.area_m2) > 0 ? Number(selectedCrop.area_m2) : 0;
  const lastReason = latestLog
    ? (latestLog.status === 'ON' ? startReason(latestLog.source) : endReason(latestLog.source))
    : '';
  const timeOf = (date) => date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

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

  const alertList = alerts.slice(0, 3);
  const scheduleList = getScheduleTimes();

  return (
    <>
      <Helmet>
        <title>Inicio - Neptuno</title>
        <meta name="description" content="Estado de tu cultivo: riego, humedad, agua, alertas y zonas en un solo vistazo" />
      </Helmet>

      <Header />

      <main className="relative min-h-screen overflow-hidden bg-dew py-8 sm:py-12">
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Panel Principal</h1>
              {selectedCrop ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800"><Sprout className="h-4 w-4 text-sky-600" aria-hidden="true" />{selectedCrop.name}</span>
                  {stageKey && STAGE_LABELS[stageKey] && (
                    <span>{STAGE_LABELS[stageKey]}{stageInfo ? `, día ${stageInfo.days} desde la siembra` : ''}</span>
                  )}
                  {selectedCrop.growing_environment === 'greenhouse' && <span>Invernadero</span>}
                  <span>Riego {(MODE_LABELS[selectedCrop.control_mode] || 'Manual').toLowerCase()}</span>
                  {cropArea > 0 && <span>{formatArea(cropArea)}</span>}
                  {(sensorData?.is_demo || irrigationLogs.some((log) => log.is_demo)) && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Demo</span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-base text-slate-600">El estado de tu cultivo, claro y al momento.</p>
              )}
            </div>
            <Link to="/control">
              <Button className="rounded-xl bg-blue-700 font-semibold text-white shadow-md shadow-blue-700/15 hover:bg-blue-800">
                Controlar riego <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {!selectedCrop && (
            <div className="mb-6 rounded-2xl border border-sky-200 bg-white p-6 text-slate-700">
              <p className="font-semibold">Aún no hay un cultivo seleccionado.</p>
              <p className="mt-1 text-sm text-slate-500">Crea tu primer cultivo y registra su área, su caudal y su etapa para ver aquí el estado del riego.</p>
              <Link to="/crops" className="mt-3 inline-block font-semibold text-blue-700 hover:underline">Crear o seleccionar cultivo</Link>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Error al Cargar Datos</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {alertList.length > 0 && (
            <section aria-label="Alertas activas" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-rose-800">
                <Bell className="h-5 w-5" aria-hidden="true" />
                {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {alertList.map((alert) => <li key={alert.id}>{alert.message}</li>)}
              </ul>
            </section>
          )}

          <section className="mb-6 grid gap-4 lg:grid-cols-5">
            <Card className="rounded-3xl border border-sky-100 bg-white shadow-lg shadow-slate-900/5 lg:col-span-3">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Estado del riego</p>
                    <p className={`mt-2 text-3xl font-extrabold ${displayedStatus === 'ON' ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {displayedStatus === 'ON' ? 'Riego activo' : 'Riego inactivo'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {activeSchedule && displayedStatus === 'ON'
                        ? `Horario activo hasta las ${timeOf(activeSchedule.endDate)}`
                        : latestLog?.created
                          ? `Último cambio ${new Date(latestLog.created).toLocaleString('es-ES')}`
                          : 'Aún no hay actividad registrada'}
                    </p>
                  </div>
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${displayedStatus === 'ON' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                    <Droplets className="h-7 w-7" aria-hidden="true" />
                  </span>
                </div>
                {lastReason && (
                  <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">Por qué: </span>{lastReason}
                  </p>
                )}
                {forecastFresh && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <CloudRain className="h-4 w-4 text-sky-600" aria-hidden="true" />
                    {forecastMm > 0
                      ? `Lluvia prevista en las próximas 6 horas: ${forecastMm.toLocaleString('es-CO', { maximumFractionDigits: 1 })} mm`
                      : 'Sin lluvia prevista en las próximas 6 horas'}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-sky-100 pt-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {activeSchedule && displayedStatus === 'ON'
                        ? 'Riego programado'
                        : activeSchedule
                          ? 'Horario en pausa'
                          : upcomingSchedule
                            ? 'Próximo riego'
                            : scheduleList.length > 0
                              ? 'Horarios vencidos'
                              : 'Próximo riego'}
                    </p>
                    {activeSchedule && displayedStatus === 'ON' ? (
                      <p className="mt-1 text-lg font-bold text-emerald-700">En curso <span className="text-sm font-normal text-slate-500">· finaliza a las {timeOf(activeSchedule.endDate)}</span></p>
                    ) : activeSchedule ? (
                      <p className="mt-1 text-lg font-bold text-slate-900">Riego pausado <span className="text-sm font-normal text-slate-500">· el horario termina a las {timeOf(activeSchedule.endDate)}</span></p>
                    ) : upcomingSchedule ? (
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatScheduleTime(upcomingSchedule.startTime || upcomingSchedule.time)}
                        <span className="text-sm font-normal text-slate-500"> · {upcomingSchedule.date || upcomingSchedule.startDate ? formatScheduleDate(upcomingSchedule.date || upcomingSchedule.startDate) : 'Horario programado'}</span>
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-lg font-bold text-slate-900">Sin riegos pendientes</p>
                        <p className="text-sm text-slate-500">
                          {scheduleList.length > 0 ? 'Los horarios guardados ya pasaron.' : 'Programa el siguiente riego.'}
                        </p>
                      </>
                    )}
                  </div>
                  <Link to="/control" aria-label="Configurar horarios de riego" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition hover:bg-blue-100">
                    <CalendarDays className="h-5 w-5" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-sky-100 bg-white shadow-lg shadow-slate-900/5 lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">Humedad del Suelo</p>
                  {soil && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${SOIL_TONE_CLASSES[soil.tone]}`}>{soil.label}</span>}
                </div>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {humidity !== null ? humidity.toFixed(1) : '--'}<span className="ml-1 text-xl font-semibold text-slate-400">%</span>
                </p>
                <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-sky-100" role="img" aria-label={hasRange ? `Humedad ${humidity ?? 'sin lectura'} por ciento, rango ideal ${selectedCrop.humidity_min} a ${selectedCrop.humidity_max}` : 'Humedad del suelo'}>
                  {hasRange && (
                    <span className="absolute inset-y-0 bg-emerald-200" style={{ left: `${selectedCrop.humidity_min}%`, width: `${Math.max(0, selectedCrop.humidity_max - selectedCrop.humidity_min)}%` }} />
                  )}
                  {humidity !== null && (
                    <span className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-blue-700" style={{ left: `${Math.min(100, Math.max(0, humidity))}%` }} />
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {hasRange
                    ? `Rango ideal de este cultivo: ${selectedCrop.humidity_min}–${selectedCrop.humidity_max} %`
                    : 'Define el rango de humedad en Cultivos para ver si el suelo está seco o con mucha agua.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {sensorData?.created ? `Actualizado ${new Date(sensorData.created).toLocaleString('es-ES')}` : 'Esperando la primera lectura de sensores'}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SensorCard
              icon={Waves}
              label="Nivel de Agua"
              value={sensorData ? Number(sensorData.water_level).toFixed(1) : '--'}
              unit="%"
              progress={sensorData?.water_level || 0}
              color="blue"
            />
            <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5">
              <CardContent className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Thermometer className="h-6 w-6" />
                  </div>
                </div>
                <p className="mb-4 text-sm font-semibold text-slate-600">Temperatura</p>
                <GaugeChart value={tempFromCelsius(sensorData?.temperature || 0, prefs.unit_temp)} min={tempFromCelsius(0, prefs.unit_temp)} max={tempFromCelsius(50, prefs.unit_temp)} unit={tempUnitLabel(prefs.unit_temp)} />
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-sky-100 bg-white shadow-lg shadow-slate-900/5 sm:col-span-2 lg:col-span-1">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Consumo estimado hoy</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {flowRate ? formatVolume(estimatedConsumptionToday) : 'Falta el caudal'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {flowRate
                      ? `${flowRate} L/min × duración real`
                      : 'Sin el caudal (L/min) no se puede calcular cuánta agua usaste.'}
                  </p>
                </div>
                {!flowRate && selectedCrop && (
                  <Link to="/crops" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
                    Registrar el caudal <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            {zones.length > 0 && (
              <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-xl">
                    <span className="flex items-center gap-2"><MapPin className="h-5 w-5 text-sky-600" aria-hidden="true" /> Zonas de riego</span>
                    <Link to="/control" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">Controlar <ArrowRight className="h-4 w-4" /></Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {zones.map((zone) => {
                      const on = states.get(zone.id) === true;
                      return (
                        <li key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl bg-sky-50/70 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{zone.name}</p>
                            <p className="text-xs text-slate-500">Válvula {zone.valve_channel}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {on ? 'Regando' : 'En reposo'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card className={`rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5 ${zones.length === 0 ? 'lg:col-span-2' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-xl">
                  <span className="flex items-center gap-2"><Clock className="h-5 w-5 text-sky-600" aria-hidden="true" /> <span>Horario de Riego</span></span>
                  <Link to="/control" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">Ver todos <ArrowRight className="h-4 w-4" /></Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleList.length > 0 ? (
                  <div className="space-y-2">
                    {scheduleList.slice(0, 4).map((schedule, index) => (
                      <div key={schedule.id || index} className="flex items-center gap-3 rounded-2xl bg-sky-50/70 px-4 py-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700"><Clock className="h-5 w-5 text-white" /></span>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {formatScheduleTime(schedule.startTime || schedule.time)}
                            {schedule.endTime && ` - ${formatScheduleTime(schedule.endTime)}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {schedule.date ? formatScheduleDate(schedule.date) : 'Riego diario'}
                            {getScheduleState(schedule, now) === 'past' && ' · Ya pasó'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {scheduleList.length > 4 && <p className="text-xs text-slate-500">y {scheduleList.length - 4} más en el Panel de Control.</p>}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-slate-600">No hay horarios de riego configurados</p>
                    <Link to="/control" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">Configurar horario <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-label="Resumen de la finca" className="rounded-3xl border border-sky-100 bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Mi finca</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {totalFarmM2 > 0
                    ? `Área total de la finca: ${formatArea(totalFarmM2)}`
                    : 'Registra el área de tus cultivos para ver aquí el total de la finca.'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {(crops || []).length} cultivo{(crops || []).length !== 1 ? 's' : ''}
                  {zones.length > 0 ? `, ${zones.length} zona${zones.length !== 1 ? 's' : ''} en ${selectedCrop?.name}` : ''}
                  {(crops || []).length > 1 && totalFarmM2 > 0 ? '. Es la suma del área de todos tus cultivos.' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/crops"><Button variant="outline" className="rounded-xl border-sky-200 text-blue-700 hover:bg-sky-50">Editar cultivos y área</Button></Link>
                <Link to="/sensors"><Button variant="outline" className="rounded-xl border-sky-200 text-blue-700 hover:bg-sky-50">Sensores</Button></Link>
                <Link to="/reports"><Button variant="outline" className="rounded-xl border-sky-200 text-blue-700 hover:bg-sky-50">Reportes</Button></Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default DashboardPage;
