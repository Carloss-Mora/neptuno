import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Clock3, Download, Droplets, FileSpreadsheet, FileText, Sprout, Timer } from 'lucide-react';
import Header from '@/components/Header';
import WaterConsumptionChart from '@/components/WaterConsumptionChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCrop } from '@/contexts/CropContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import pb from '@/lib/pocketbaseClient';
import { buildReport, dateKey, endOfDay, startOfDay } from '@/utils/reportData';
import { downloadExcel, downloadPdf, formatMinutes } from '@/utils/reportExport';
import { SENSOR_KINDS } from '@/utils/sensorStatus';
import { formatVolume, tempFromCelsius, tempUnitLabel, volumeFromLiters, volumeUnitLabel } from '@/utils/units';

const PRESETS = [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días']];
const MAX_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseDay = (value) => {
  const [year, month, day] = String(value).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const describeError = (error) => (error?.status === 0 ? 'No se pudo conectar con el servidor.' : error?.response?.message || error?.message || 'Error inesperado.');

const ReportsPage = () => {
  const { selectedCrop } = useCrop();
  const { settings } = useUserSettings();
  const cropId = selectedCrop?.id || '';
  const [preset, setPreset] = useState(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [logs, setLogs] = useState([]);
  const [hours, setHours] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [now] = useState(() => new Date());

  const range = useMemo(() => {
    const today = endOfDay(now);
    if (preset === 'custom') {
      const from = parseDay(customFrom);
      const to = parseDay(customTo);
      if (!from || !to) return { error: 'Elige la fecha de inicio y la de fin.' };
      if (from > to) return { error: 'La fecha de inicio debe ser anterior a la de fin.' };
      if (startOfDay(to) > today) return { error: 'La fecha de fin no puede ser futura.' };
      if ((to - from) / DAY_MS >= MAX_DAYS) return { error: `El periodo máximo es de ${MAX_DAYS} días.` };
      return { from: startOfDay(from), to: endOfDay(to) };
    }
    return { from: startOfDay(new Date(now.getTime() - (preset - 1) * DAY_MS)), to: today };
  }, [preset, customFrom, customTo, now]);

  const fromTime = range.from?.getTime();
  const toTime = range.to?.getTime();

  const load = useCallback(async () => {
    if (!cropId || !fromTime || !toTime) return;
    setLoading(true);
    setError('');
    try {
      const [logList, readings, sensorList, deviceList] = await Promise.all([
        pb.collection('irrigation_logs').getFullList({ filter: `cropId = "${cropId}" && created <= "${new Date(toTime).toISOString()}"`, sort: 'created', $autoCancel: false }),
        pb.send('/api/neptuno/reports/readings', { query: { cropId, from: new Date(fromTime).toISOString(), to: new Date(toTime).toISOString() } }),
        pb.collection('sensors').getFullList({ filter: `cropId = "${cropId}"`, sort: 'created', $autoCancel: false }),
        pb.collection('devices').getFullList({ filter: `cropId = "${cropId}" && is_simulated != true`, $autoCancel: false }),
      ]);
      setLogs(logList);
      setHours(readings.hours || []);
      setSensors(sensorList);
      setDevices(deviceList);
    } catch (loadError) {
      console.error('Could not load report data:', loadError);
      setError(`No se pudieron cargar los datos del reporte. ${describeError(loadError)}`);
    } finally {
      setLoading(false);
    }
  }, [cropId, fromTime, toTime]);

  useEffect(() => {
    load();
  }, [load]);

  const report = useMemo(() => {
    if (!selectedCrop || !fromTime) return null;
    const interval = devices.length > 0 ? Math.min(...devices.map((device) => Number(device.interval_seconds) || 15)) : 15;
    return buildReport({
      crop: selectedCrop, logs, hours, sensors, deviceIntervalSeconds: interval, from: new Date(fromTime), to: new Date(toTime), now: new Date(),
    });
  }, [selectedCrop, logs, hours, sensors, devices, fromTime, toTime]);

  const hasFlow = report?.flowLpm !== null && report?.flowLpm !== undefined;
  const volumeUnit = settings.unit_volume;
  const tempUnit = settings.unit_temp;

  const download = async (kind) => {
    if (!report) return;
    setDownloading(kind);
    setDownloadError('');
    try {
      const preferences = { unit_volume: volumeUnit, unit_temp: tempUnit, timezone: settings.timezone };
      if (kind === 'pdf') await downloadPdf(report, preferences);
      else await downloadExcel(report, preferences);
    } catch (exportError) {
      console.error('Could not export the report:', exportError);
      setDownloadError(`No se pudo generar el archivo. ${describeError(exportError)}`);
    } finally {
      setDownloading('');
    }
  };

  // Humedad y agua por día (promedio de las lecturas por hora) para no pintar miles de puntos.
  const trend = useMemo(() => {
    const days = new Map();
    hours.forEach((row) => {
      const key = dateKey(new Date(row.hour));
      const bucket = days.get(key) || { date: key, humidity: 0, water: 0, samples: 0 };
      const samples = Number(row.samples) || 1;
      bucket.humidity += Number(row.humidity) * samples;
      bucket.water += Number(row.water_level) * samples;
      bucket.samples += samples;
      days.set(key, bucket);
    });
    return Array.from(days.values()).sort((a, b) => (a.date < b.date ? -1 : 1)).map((bucket) => ({
      date: bucket.date,
      humidity: Number((bucket.humidity / bucket.samples).toFixed(1)),
      water: Number((bucket.water / bucket.samples).toFixed(1)),
    }));
  }, [hours]);

  const Kpi = ({ icon: Icon, label, value, note, tone }) => (
    <Card className="rounded-3xl border-teal-100">
      <CardContent className="flex items-start gap-4 p-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
          {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet><title>Reportes - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-dew py-10 sm:py-14">
        <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><FileText className="h-4 w-4" /> Reportes</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Reportes de riego y consumo</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Revisa cuánta agua usó tu cultivo y descarga el informe en PDF o Excel.</p>
          </header>

          {!selectedCrop ? (
            <Card><CardContent className="flex flex-col items-start gap-3 p-8">
              <Sprout className="h-8 w-8 text-teal-700" />
              <p className="font-semibold text-slate-900">Primero crea un cultivo</p>
              <Button asChild className="bg-teal-700 hover:bg-teal-800"><Link to="/crops">Ir a Cultivos</Link></Button>
            </CardContent></Card>
          ) : (
            <>
              <Card className="rounded-3xl border-teal-100">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo del reporte">
                    {PRESETS.map(([days, label]) => (
                      <Button key={days} type="button" size="sm" variant={preset === days ? 'default' : 'outline'} aria-pressed={preset === days} onClick={() => setPreset(days)} className={preset === days ? 'bg-teal-700 hover:bg-teal-800' : ''}>{label}</Button>
                    ))}
                    <Button type="button" size="sm" variant={preset === 'custom' ? 'default' : 'outline'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')} className={preset === 'custom' ? 'bg-teal-700 hover:bg-teal-800' : ''}>Elegir fechas</Button>
                  </div>
                  {preset === 'custom' && (
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-1"><Label htmlFor="report-from">Desde</Label><Input id="report-from" type="date" max={dateKey(now)} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></div>
                      <div className="space-y-1"><Label htmlFor="report-to">Hasta</Label><Input id="report-to" type="date" max={dateKey(now)} value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></div>
                    </div>
                  )}
                  {range.error && <p role="alert" className="text-sm text-rose-700">{range.error}</p>}
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                    <Button type="button" onClick={() => download('pdf')} disabled={!report || loading || Boolean(range.error) || Boolean(downloading)} className="bg-teal-700 hover:bg-teal-800">
                      <Download className="mr-2 h-4 w-4" /> {downloading === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => download('xlsx')} disabled={!report || loading || Boolean(range.error) || Boolean(downloading)} className="border-teal-200 text-teal-800 hover:bg-teal-50">
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> {downloading === 'xlsx' ? 'Generando Excel…' : 'Descargar Excel'}
                    </Button>
                    <p className="text-xs text-slate-500">El PDF es un resumen con gráfica; el Excel trae todos los datos.</p>
                  </div>
                  {downloadError && <p role="alert" className="text-sm text-rose-700">{downloadError}</p>}
                </CardContent>
              </Card>

              {error && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <span>{error}</span><Button type="button" size="sm" variant="outline" onClick={load}>Reintentar</Button>
                </div>
              )}

              {report && !range.error && (
                <>
                  {!hasFlow && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Para calcular litros falta el caudal del cultivo. Mientras tanto verás los minutos de riego. <Link to="/crops" className="font-semibold underline">Configurar caudal</Link>
                    </p>
                  )}
                  <section aria-label="Resumen del periodo" className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
                    <Kpi icon={Droplets} label="Consumo estimado" tone="bg-cyan-100 text-cyan-700" value={hasFlow ? formatVolume(report.totals.liters, volumeUnit) : 'Sin caudal'}
                      note={hasFlow && report.areaM2 ? `${(volumeFromLiters(report.totals.liters, volumeUnit) / report.areaM2).toFixed(1)} ${volumeUnitLabel(volumeUnit)} por m²` : undefined} />
                    <Kpi icon={Sprout} label="Riegos" tone="bg-teal-100 text-teal-700" value={String(report.totals.sessions)}
                      note={report.totals.averageMinutesPerSession !== null ? `Promedio ${formatMinutes(report.totals.averageMinutesPerSession)}` : 'Sin riegos'} />
                    <Kpi icon={Timer} label="Tiempo de riego" tone="bg-orange-100 text-orange-600" value={formatMinutes(report.totals.minutes)} />
                    <Kpi icon={Clock3} label="Promedio diario" tone="bg-emerald-100 text-emerald-700"
                      value={hasFlow ? formatVolume(report.totals.averageLitersPerDay, volumeUnit) : formatMinutes(report.totals.minutes / Math.max(1, report.days))}
                      note={report.totals.peakDay ? `Mayor riego: ${report.totals.peakDay.date.split('-').reverse().slice(0, 2).join('/')}` : undefined} />
                  </section>

                  <Card className="rounded-3xl border-teal-100">
                    <CardHeader>
                      <CardTitle>{hasFlow ? 'Consumo de agua por día' : 'Minutos de riego por día'}</CardTitle>
                      <CardDescription>{hasFlow ? 'Barras: litros de cada día. Línea: acumulado del periodo. Estimado con caudal × minutos reales.' : 'Barras: minutos de cada día. Línea: acumulado del periodo.'}</CardDescription>
                    </CardHeader>
                    <CardContent><WaterConsumptionChart daily={report.daily} hasFlow={hasFlow} volumeUnit={volumeUnit} /></CardContent>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-3xl border-teal-100">
                      <CardHeader>
                        <CardTitle>Humedad y nivel de agua</CardTitle>
                        <CardDescription>Promedio diario de las lecturas del periodo.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {trend.length === 0 ? (
                          <p className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 text-slate-500">Sin lecturas en este periodo.</p>
                        ) : (
                          <div className="h-56" role="img" aria-label="Gráfica de humedad del suelo y nivel de agua por día">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#dbe7f5" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={(key) => key.split('-').reverse().slice(0, 2).join('/')} stroke="#6b7a90" fontSize={12} minTickGap={24} />
                                <YAxis domain={[0, 100]} stroke="#6b7a90" fontSize={12} width={36} unit="%" />
                                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dbe7f5' }} formatter={(value) => `${value} %`} />
                                <Legend />
                                <Line type="monotone" dataKey="humidity" name="Humedad del suelo" stroke="#2468b6" strokeWidth={2.5} dot={false} />
                                <Line type="monotone" dataKey="water" name="Nivel de agua" stroke="#22a0b9" strokeWidth={2.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-teal-100">
                      <CardHeader>
                        <CardTitle>Lecturas de sensores</CardTitle>
                        <CardDescription>Promedio y extremos horarios del periodo.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full min-w-[22rem] text-left text-sm">
                          <thead><tr className="border-b border-slate-200 text-slate-500">
                            <th scope="col" className="py-2 pr-3 font-medium">Medida</th><th scope="col" className="py-2 pr-3 font-medium">Promedio</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Mínimo</th><th scope="col" className="py-2 font-medium">Máximo</th>
                          </tr></thead>
                          <tbody>
                            {report.sensorSummary.map((metric) => {
                              const show = (value) => (value === null ? '—' : metric.key === 'temperature'
                                ? `${Number(tempFromCelsius(value, tempUnit).toFixed(1))} ${tempUnitLabel(tempUnit)}` : `${Number(value.toFixed(1))} %`);
                              return (
                                <tr key={metric.key} className="border-b border-slate-100 last:border-0">
                                  <td className="py-3 pr-3 font-semibold text-slate-900">{metric.label}</td>
                                  <td className="py-3 pr-3">{show(metric.average)}</td><td className="py-3 pr-3">{show(metric.minimum)}</td><td className="py-3">{show(metric.maximum)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="mt-4 text-sm text-slate-600">
                          {sensors.length > 0
                            ? <>Sensores registrados: {sensors.map((sensor) => SENSOR_KINDS[sensor.kind]?.short).join(', ')}. <Link to="/sensors" className="font-semibold text-teal-700 hover:underline">Ver su estado</Link></>
                            : <>Aún no registras sensores en el plano. <Link to="/sensors" className="font-semibold text-teal-700 hover:underline">Agregar sensores</Link></>}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default ReportsPage;
