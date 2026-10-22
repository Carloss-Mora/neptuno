import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import Header from '@/components/Header';
import ConsumptionChart from '@/components/ConsumptionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock3,
  Droplets,
  Gauge,
  Sprout,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import pb from '@/lib/pocketbaseClient';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  buildIrrigationSessions,
  estimateDailyConsumption,
} from '@/utils/irrigationMetrics';

const DAY_COUNT = 14;

const formatDuration = (milliseconds) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
};

const StatisticsPage = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || '';
  const { selectedCrop } = useCrop();
  const cropId = selectedCrop?.id || '';
  const [consumptionData, setConsumptionData] = useState([]);
  const [irrigationLogs, setIrrigationLogs] = useState([]);
  const [sensorHistory, setSensorHistory] = useState([]);
  const flowRate = Number(selectedCrop?.flow_lpm) || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consumptionError, setConsumptionError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!userId || !cropId) {
      setIrrigationLogs([]);
      setConsumptionData([]);
      setSensorHistory([]);
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    const fetchStatistics = async () => {
      setLoading(true);
      setError('');
      setConsumptionError('');
      const today = format(new Date(), 'yyyy-MM-dd');
      const consumptionStart = format(subMonths(new Date(), 2), 'yyyy-MM-dd');

      try {
        const records = await pb.collection('irrigation_logs').getFullList({
          filter: `cropId = "${cropId}"`,
          sort: 'created',
          $autoCancel: false,
        });
        if (isMounted) setIrrigationLogs(records);
      } catch (fetchError) {
        console.error('Error fetching irrigation statistics:', fetchError);
        if (isMounted) setError('No se pudieron cargar las estadísticas de riego. Intenta actualizar la página.');
      }

      try {
        const records = await pb.collection('water_consumption').getFullList({
          filter: `cropId = "${cropId}" && consumption_date >= "${consumptionStart}" && consumption_date <= "${today}" && period = "daily"`,
          sort: 'consumption_date',
          $autoCancel: false,
        });
        if (isMounted) setConsumptionData(records);
      } catch (fetchError) {
        console.error('Error fetching water consumption statistics:', fetchError);
        if (isMounted) {
          setConsumptionData([]);
          setConsumptionError('No hay datos de consumo de agua disponibles todavía.');
        }
      }

      try {
        const [rawReadings, hourlyReadings] = await Promise.all([
          pb.collection('sensor_readings').getFullList({
            filter: `cropId = "${cropId}" && created >= "${subDays(new Date(), 30).toISOString()}"`,
            sort: '-created',
            $autoCancel: false,
          }),
          pb.collection('sensor_readings_hourly').getFullList({
            filter: `cropId = "${cropId}"`,
            sort: '-hour_start',
            $autoCancel: false,
          }),
        ]);
        if (isMounted) setSensorHistory([
          ...hourlyReadings.map((reading) => ({
            humidity: Number(reading.humidity_avg),
            sampleCount: Number(reading.sample_count) || 1,
            is_demo: reading.is_demo,
          })),
          ...rawReadings.map((reading) => ({
            humidity: Number(reading.soil_humidity),
            sampleCount: 1,
            is_demo: reading.is_demo,
          })),
        ].filter((reading) => Number.isFinite(reading.humidity)));
      } catch (fetchError) {
        console.error('Error fetching sensor history:', fetchError);
        if (isMounted) setSensorHistory([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatistics();
    const refreshInterval = window.setInterval(() => setNow(new Date()), 60000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
    };
  }, [userId, cropId]);

  const sessions = useMemo(() => buildIrrigationSessions(irrigationLogs, now), [irrigationLogs, now]);
  const recentSessions = useMemo(() => {
    const cutoff = subDays(now, 30);
    return sessions.filter((session) => session.activationDate >= cutoff);
  }, [sessions, now]);
  const estimatedConsumptionByDay = useMemo(
    () => estimateDailyConsumption(sessions, startOfMonth(subMonths(now, 1)), now, flowRate),
    [sessions, now, flowRate],
  );
  const monthlyConsumption = useMemo(() => {
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    const totals = Array.from(estimatedConsumptionByDay.entries()).reduce((result, [day, liters]) => {
      const date = new Date(`${day}T00:00:00`);
      if (date >= currentMonthStart) result.current += liters;
      if (date >= previousMonthStart && date <= previousMonthEnd) result.previous += liters;
      return result;
    }, { current: 0, previous: 0 });

    return {
      ...totals,
      change: totals.previous > 0 ? ((totals.current - totals.previous) / totals.previous) * 100 : 0,
    };
  }, [estimatedConsumptionByDay, now]);

  const dailyActivity = useMemo(() => {
    const activityByDate = new Map();
    for (let offset = DAY_COUNT - 1; offset >= 0; offset -= 1) {
      const date = subDays(now, offset);
      const key = format(date, 'yyyy-MM-dd');
      activityByDate.set(key, {
        date: format(date, 'd MMM', { locale: es }),
        activations: 0,
        minutes: 0,
        estimatedLiters: estimatedConsumptionByDay.get(key) || 0,
      });
    }

    recentSessions.forEach((session) => {
      const key = format(session.activationDate, 'yyyy-MM-dd');
      const day = activityByDate.get(key);
      if (!day) return;
      day.activations += 1;
      day.minutes += session.durationMs / 60000;
    });

    return Array.from(activityByDate.values());
  }, [recentSessions, estimatedConsumptionByDay, now]);

  const totalRuntime = recentSessions.reduce((total, session) => total + session.durationMs, 0);
  const averageRuntime = recentSessions.length > 0 ? totalRuntime / recentSessions.length : 0;
  const estimatedConsumptionToday = estimatedConsumptionByDay.get(format(now, 'yyyy-MM-dd')) || 0;
  const hasDemoData = irrigationLogs.some((log) => log.is_demo);
  const averageEstimatedDailyConsumption = Array.from(estimatedConsumptionByDay.entries())
    .filter(([day]) => new Date(`${day}T00:00:00`) >= subDays(now, 29))
    .reduce((sum, [, liters]) => sum + liters, 0) / 30;
  const activeSessionCount = recentSessions.filter((session) => session.active).length;
  const sensorSampleCount = sensorHistory.reduce((sum, reading) => sum + reading.sampleCount, 0);
  const averageSoilHumidity = sensorSampleCount > 0
    ? sensorHistory.reduce((sum, reading) => sum + reading.humidity * reading.sampleCount, 0) / sensorSampleCount
    : null;
  const hasDemoSensorData = sensorHistory.some((reading) => reading.is_demo);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#f4fbfa] py-12">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Skeleton className="mb-8 h-28 rounded-3xl" />
            <div className="mb-6 grid gap-5 md:grid-cols-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-3xl" />)}
            </div>
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Estadísticas de Riego - Neptuno</title>
        <meta name="description" content="Consulta las activaciones, duración y consumo de agua de tu sistema de riego." />
      </Helmet>

      <Header />
      <main className="relative min-h-screen overflow-hidden bg-[#f4fbfa] py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-br from-cyan-100/80 via-teal-50/70 to-transparent" />
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <section className="mb-8 rounded-3xl border border-teal-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <span className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                  <BarChart3 className="h-4 w-4" /> Actividad del sistema
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Estadísticas de riego</h1>
                {hasDemoData && <span className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Demo</span>}
                <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
                  Consulta las sesiones y el tiempo de riego registrados en tu sistema.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 sm:self-auto">
                <Activity className="h-4 w-4 text-teal-600" />
                <span>{activeSessionCount > 0 ? 'Riego activo ahora' : 'Últimos 30 días'}</span>
              </div>
            </div>
          </section>

          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <section className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Riegos iniciados</span>
                  <span className="rounded-2xl bg-teal-50 p-3 text-teal-700"><Sprout className="h-5 w-5" /></span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">{recentSessions.length}</p>
                <p className="mt-1 text-xs text-slate-500">En los últimos 30 días</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Tiempo total de riego</span>
                  <span className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Timer className="h-5 w-5" /></span>
                </div>
                <p data-testid="total-irrigation-runtime" className="text-3xl font-extrabold tracking-tight text-slate-900">{formatDuration(totalRuntime)}</p>
                <p className="mt-1 text-xs text-slate-500">Incluye sesiones activas</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Duración promedio</span>
                  <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><Clock3 className="h-5 w-5" /></span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">{formatDuration(averageRuntime)}</p>
                <p className="mt-1 text-xs text-slate-500">Por sesión de riego</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Consumo estimado hoy</span>
                  <span className="rounded-2xl bg-sky-50 p-3 text-sky-700"><Droplets className="h-5 w-5" /></span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {flowRate ? `${estimatedConsumptionToday.toFixed(1)} L` : 'Configura el caudal'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {flowRate
                    ? `${flowRate} L/min × duración real · promedio diario: ${averageEstimatedDailyConsumption.toFixed(1)} L`
                    : 'Configura el caudal medido en la administración del cultivo para estimar litros.'}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Humedad media registrada</span>
                  <span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Gauge className="h-5 w-5" /></span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {averageSoilHumidity == null ? 'Sin lecturas' : `${averageSoilHumidity.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {sensorSampleCount} muestras · lecturas recientes y promedios horarios
                  {hasDemoSensorData ? ' · Demo' : ''}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-slate-900">Frecuencia de riego</CardTitle>
                <p className="text-sm text-slate-500">Sesiones iniciadas por día · últimos 14 días</p>
              </CardHeader>
              <CardContent className="pt-3">
                {recentSessions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dailyActivity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip cursor={{ fill: '#f0fdfa' }} contentStyle={{ borderRadius: 14, border: '1px solid #ccfbf1' }} />
                      <Bar dataKey="activations" name="Riegos" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 px-6 text-center">
                    <span className="mb-3 rounded-2xl bg-white p-3 text-teal-600 shadow-sm"><Sprout className="h-6 w-6" /></span>
                    <p className="font-semibold text-slate-800">Aún no hay sesiones de riego</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">Activa el riego desde el panel de control y aquí verás tus estadísticas.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-slate-900">Tiempo de riego</CardTitle>
                <p className="text-sm text-slate-500">Minutos por día según las sesiones registradas</p>
              </CardHeader>
              <CardContent className="pt-3">
                {recentSessions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dailyActivity} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip cursor={{ fill: '#ecfeff' }} contentStyle={{ borderRadius: 14, border: '1px solid #cffafe' }} formatter={(value) => [`${Math.round(value)} min`, 'Tiempo']} />
                      <Bar dataKey="minutes" name="Minutos" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/50 px-6 text-center">
                    <span className="mb-3 rounded-2xl bg-white p-3 text-cyan-700 shadow-sm"><Gauge className="h-6 w-6" /></span>
                    <p className="font-semibold text-slate-800">El tiempo aparecerá aquí</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">Cada activación y desactivación permite calcular cuánto duró el riego.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="mb-6 rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-slate-900">Consumo estimado por día</CardTitle>
              <p className="text-sm text-slate-500">
              Calculado con caudal (L/min) × duración real · estimado · últimos 14 días
              </p>
            </CardHeader>
            <CardContent className="pt-3">
              {recentSessions.length > 0 && flowRate ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyActivity} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: '#e0f2fe' }}
                      contentStyle={{ borderRadius: 14, border: '1px solid #bae6fd' }}
                      formatter={(value) => [`${Number(value).toFixed(1)} L`, 'Consumo estimado']}
                    />
                    <Bar dataKey="estimatedLiters" name="Consumo estimado" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/50 px-6 text-center">
                  <p className="font-semibold text-slate-800">
                    {flowRate ? 'Aún no hay consumo estimable' : 'Configura el caudal del cultivo'}
                  </p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    {flowRate
                      ? 'Cuando haya sesiones registradas, el cálculo usará su duración real y el caudal configurado.'
                      : 'En la administración del cultivo introduce el caudal medido en L/min.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6 rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">Consumo de agua registrado</CardTitle>
              <p className="text-sm text-slate-500">Litros diarios reportados por tus sensores</p>
            </CardHeader>
            <CardContent>
              {consumptionData.length > 0 ? (
                <ConsumptionChart data={consumptionData} />
              ) : (
                <div className="flex min-h-28 items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                  <Droplets className="h-6 w-6 shrink-0 text-slate-400" />
                  <p className="text-sm text-slate-600">{consumptionError || 'Todavía no se han registrado lecturas de consumo en este periodo.'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">Comparación mensual estimada</CardTitle>
              <p className="text-sm text-slate-500">Consumo estimado: caudal configurado × minutos reales de riego.</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-teal-50 p-5">
                <p className="text-sm font-medium text-teal-800">Mes actual</p>
                <p className="mt-2 text-3xl font-extrabold text-teal-900">{flowRate ? monthlyConsumption.current.toFixed(1) : '—'} <span className="text-sm">L</span></p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-600">Mes anterior</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-800">{flowRate ? monthlyConsumption.previous.toFixed(1) : '—'} <span className="text-sm">L</span></p>
              </div>
              <div className={`rounded-2xl p-5 ${monthlyConsumption.change > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <p className="text-sm font-medium text-slate-600">Variación mensual</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                  {monthlyConsumption.change > 0 ? <TrendingUp className="h-6 w-6 text-amber-600" /> : <TrendingDown className="h-6 w-6 text-emerald-600" />}
                  {flowRate && monthlyConsumption.previous > 0
                    ? `${monthlyConsumption.change > 0 ? '+' : ''}${monthlyConsumption.change.toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default StatisticsPage;
