import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FlaskConical, Pause, Play, RotateCcw, StepForward, Trash2, TriangleAlert } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbaseClient';
import { isSet } from '@/utils/optionalNumber';
import { FAULT_OPTIONS, irrigationLabel, reasonLabel } from '@/utils/simulationLabels';

const POLL_MS = 3000;
const STEP_CHOICES = [1, 5, 10, 30, 60];
const TONE_CLASSES = {
  on: 'bg-sky-100 text-sky-900 border-sky-200',
  off: 'bg-slate-100 text-slate-800 border-slate-200',
  safety: 'bg-amber-100 text-amber-900 border-amber-300',
};

const formatSimTime = (ms) => (ms
  ? new Date(ms).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

const NumberAction = ({ label, id, value, min, max, step = 1, unit, onApply, disabled }) => {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => { setDraft(String(value ?? '')); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} className="w-28" />
        <Button type="button" variant="outline" disabled={disabled || draft === '' || Number(draft) < min || Number(draft) > max} onClick={() => onApply(Number(draft))}>
          Aplicar{unit ? ` (${unit})` : ''}
        </Button>
      </div>
    </div>
  );
};

const SimulatorPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop } = useCrop();
  const { toast } = useToast();
  const cropId = selectedCrop?.id || '';
  const [simulation, setSimulation] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!currentUser || !cropId) {
      setSimulation(null);
      setEvents([]);
      setLoading(false);
      return;
    }
    try {
      const list = await pb.collection('simulations').getList(1, 1, { filter: `cropId = "${cropId}"`, $autoCancel: false });
      const current = list.items[0] || null;
      setSimulation(current);
      if (current) {
        const recent = await pb.collection('simulation_events').getList(1, 60, {
          filter: `simulationId = "${current.id}"`,
          sort: '-sim_time_ms',
          $autoCancel: false,
        });
        setEvents(recent.items);
      } else {
        setEvents([]);
      }
      setLoadError('');
    } catch (error) {
      console.error('Could not load the simulation lab:', error);
      setLoadError('No se pudo cargar el laboratorio de simulación.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, cropId]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const run = async (path, body, method = 'POST') => {
    setBusy(true);
    try {
      await pb.send(path, { method, body, $autoCancel: false });
      await load();
    } catch (error) {
      console.error('Simulation command failed:', error);
      toast({ variant: 'destructive', title: 'No se pudo completar la acción', description: error?.response?.message || error?.message || 'Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };
  const command = (name, extra = {}) => {
    // Respuesta inmediata en la pantalla; la lectura posterior del servidor la confirma o corrige.
    if (name === 'set_fault') setSimulation((current) => ({ ...current, fault: extra.fault }));
    if (name === 'set_step_minutes') setSimulation((current) => ({ ...current, step_minutes: extra.value }));
    return run(`/api/neptuno/simulations/${simulation.id}/command`, { command: name, ...extra });
  };
  const create = () => run('/api/neptuno/simulations', { cropId });
  const remove = async () => {
    if (!window.confirm('¿Eliminar el laboratorio de este cultivo y su historial simulado?')) return;
    await command('delete');
  };

  const humidityMin = isSet(selectedCrop?.humidity_min) ? Number(selectedCrop.humidity_min) : null;
  const humidityMax = isSet(selectedCrop?.humidity_max) ? Number(selectedCrop.humidity_max) : null;
  const chartData = useMemo(() => [...events].reverse().map((event) => ({
    time: new Date(event.sim_time_ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    humidity: event.humidity,
  })), [events]);
  const status = irrigationLabel(simulation?.last_state, simulation?.last_reason);
  const running = simulation?.status === 'running';
  const notAuto = selectedCrop && selectedCrop.control_mode !== 'AUTO';
  const missingLimits = selectedCrop && (humidityMin === null || humidityMax === null || !isSet(selectedCrop.max_irrigation_minutes));

  return (
    <>
      <Helmet><title>Laboratorio de simulación - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-[#f4fbfa] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><FlaskConical className="h-4 w-4" /> Laboratorio de simulación</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Prueba el riego sin sensores ni agua</h1>
            <p className="text-slate-600">
              Un cultivo virtual pasa por el mismo motor de decisiones que usará el dispositivo real. Todo lo que ocurre aquí
              queda marcado como simulado y no puede accionar una bomba ni una válvula.
            </p>
          </header>

          {!cropId && (
            <Card><CardContent className="py-8 text-center text-slate-600">
              Selecciona o crea un cultivo en <Link to="/crops" className="font-semibold text-teal-700 hover:underline">Cultivos</Link> para usar el laboratorio.
            </CardContent></Card>
          )}

          {cropId && (notAuto || missingLimits) && (
            <div role="status" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                {notAuto && 'El cultivo está en modo MANUAL: el motor automático no decidirá. '}
                {missingLimits && 'Faltan los umbrales de humedad o el máximo de riego continuo. '}
                Configúralos en <Link to="/crops" className="font-semibold underline">Cultivos</Link> para ver decisiones reales.
              </p>
            </div>
          )}

          {cropId && loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}

          {cropId && !loading && !simulation && !loadError && (
            <Card>
              <CardHeader>
                <CardTitle>Aún no hay laboratorio para «{selectedCrop.name}»</CardTitle>
                <CardDescription>Se crea un dispositivo simulado propio, separado de cualquier dispositivo físico.</CardDescription>
              </CardHeader>
              <CardContent><Button onClick={create} disabled={busy} className="bg-teal-700 hover:bg-teal-800">Crear laboratorio</Button></CardContent>
            </Card>
          )}

          {simulation && (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Estado simulado</CardTitle>
                    <CardDescription>
                      Reloj simulado: {formatSimTime(simulation.sim_time_ms)} · {simulation.ticks} pasos · cada paso = {simulation.step_minutes} min simulados
                    </CardDescription>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${TONE_CLASSES[status.tone]}`}>{status.text}</span>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div><p className="text-sm text-slate-500">Humedad</p><p className="text-3xl font-bold text-teal-700">{simulation.humidity}%</p>
                      <p className="text-xs text-slate-500">{humidityMin !== null && humidityMax !== null ? `Umbrales ${humidityMin}–${humidityMax}%` : 'Sin umbrales'}</p></div>
                    <div><p className="text-sm text-slate-500">Nivel de agua</p><p className="text-3xl font-bold text-slate-900">{simulation.water_level}%</p></div>
                    <div><p className="text-sm text-slate-500">Temperatura</p><p className="text-3xl font-bold text-slate-900">{simulation.temperature}°C</p></div>
                    <div><p className="text-sm text-slate-500">Simulación</p><p className="text-lg font-semibold text-slate-900">{running ? 'En marcha' : 'En pausa'}</p>
                      <p className="text-xs text-slate-500">{running ? 'Avanza un paso por minuto real' : 'Usa «Avanzar un paso»'}</p></div>
                  </div>
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Decisión del motor:</span> {reasonLabel(simulation.last_reason)}</p>
                  <div className="flex flex-wrap gap-2">
                    {running
                      ? <Button type="button" variant="outline" disabled={busy} onClick={() => command('pause')}><Pause className="mr-2 h-4 w-4" />Pausar</Button>
                      : <Button type="button" disabled={busy} onClick={() => command('start')} className="bg-teal-700 hover:bg-teal-800"><Play className="mr-2 h-4 w-4" />Iniciar</Button>}
                    <Button type="button" variant="outline" disabled={busy} onClick={() => command('step')}><StepForward className="mr-2 h-4 w-4" />Avanzar un paso</Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => command('reset')}><RotateCcw className="mr-2 h-4 w-4" />Reiniciar</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={remove} className="text-red-700"><Trash2 className="mr-2 h-4 w-4" />Eliminar laboratorio</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Condiciones</CardTitle><CardDescription>Cambia los valores a mano para probar el motor.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <NumberAction id="sim-humidity" label="Humedad (%)" value={simulation.humidity} min={0} max={100} step={0.5} disabled={busy} onApply={(value) => command('set_humidity', { value })} />
                    <div className="flex flex-wrap items-end gap-2">
                      <NumberAction id="sim-water" label="Nivel de agua (%)" value={simulation.water_level} min={0} max={100} disabled={busy} onApply={(value) => command('set_water', { value })} />
                      <Button type="button" variant="outline" disabled={busy} onClick={() => command('set_water', { value: 100 })}>Rellenar tanque</Button>
                    </div>
                    <NumberAction id="sim-temperature" label="Temperatura (°C)" value={simulation.temperature} min={-10} max={60} step={0.5} disabled={busy} onApply={(value) => command('set_temperature', { value })} />
                    {humidityMin !== null && (
                      <Button type="button" variant="outline" disabled={busy} onClick={() => command('set_humidity', { value: Math.max(0, humidityMin - 10) })}>Bajar la humedad por debajo del mínimo</Button>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="sim-step">Minutos simulados por paso</Label>
                      <select id="sim-step" value={simulation.step_minutes} disabled={busy} onChange={(event) => command('set_step_minutes', { value: Number(event.target.value) })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                        {STEP_CHOICES.map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Fallos</CardTitle><CardDescription>Comprueba cómo reacciona el sistema cuando algo sale mal.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {FAULT_OPTIONS.map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                        <input type="radio" name="sim-fault" value={option.value} checked={simulation.fault === option.value} disabled={busy} onChange={() => command('set_fault', { fault: option.value })} className="mt-1 h-4 w-4 accent-teal-700" />
                        <span><span className="block font-semibold text-slate-900">{option.label}</span><span className="block text-sm text-slate-600">{option.description}</span></span>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Evolución de la humedad</CardTitle><CardDescription>Últimos {chartData.length} pasos simulados.</CardDescription></CardHeader>
                <CardContent>
                  {chartData.length === 0
                    ? <p className="py-6 text-center text-sm text-slate-500">Avanza un paso para ver la gráfica.</p>
                    : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '12px' }} />
                          <YAxis domain={[0, 100]} stroke="#6b7280" style={{ fontSize: '12px' }} unit="%" />
                          <Tooltip formatter={(value) => [`${value}%`, 'Humedad']} />
                          {humidityMin !== null && <ReferenceLine y={humidityMin} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Mínimo', fontSize: 11 }} />}
                          {humidityMax !== null && <ReferenceLine y={humidityMax} stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'Objetivo', fontSize: 11 }} />}
                          <Line type="monotone" dataKey="humidity" stroke="#0d9488" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Historial de decisiones</CardTitle><CardDescription>Hora simulada, lectura, resultado y motivo de cada paso.</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Hora simulada</TableHead><TableHead>Humedad</TableHead><TableHead>Riego</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {events.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500">Sin pasos todavía.</TableCell></TableRow>}
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{formatSimTime(event.sim_time_ms)}</TableCell>
                          <TableCell>{event.humidity}%</TableCell>
                          <TableCell>{irrigationLabel(event.state, event.reason).text}</TableCell>
                          <TableCell>{event.note || reasonLabel(event.reason)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default SimulatorPage;
