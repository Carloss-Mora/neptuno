import { soilState } from '@/utils/soilState';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Droplets, Gauge, Minus, Plus, Radio, Sprout, Thermometer, Trash2, Waves, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import pb from '@/lib/pocketbaseClient';
import ZonesCard from '@/components/ZonesCard';
import { useZones } from '@/hooks/useZones';
import { SENSOR_KINDS, formatAge, layoutOf, sensorStatus, staleAfterMs } from '@/utils/sensorStatus';

const KIND_ICONS = { soil_humidity: Droplets, temperature: Thermometer, water_level: Waves };

// Colores por estado: menta = bien, coral = atención, gris = sin datos.
const STATE_STYLES = {
  ok: { tile: 'border-emerald-200 bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  alert: { tile: 'border-rose-200 bg-rose-50', icon: 'bg-rose-100 text-rose-600', pill: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  stale: { tile: 'border-amber-200 bg-amber-50', icon: 'bg-amber-100 text-amber-700', pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  never: { tile: 'border-slate-200 bg-slate-50', icon: 'bg-slate-100 text-slate-500', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const emptyForm = { name: '', kind: 'soil_humidity', cell: '', zoneId: '' };

const describeError = (error) => {
  if (error?.status === 0) return 'No se pudo conectar con el servidor.';
  return error?.response?.message || error?.message || 'Ocurrió un error inesperado.';
};

const SensorsPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop, refreshCrops } = useCrop();
  const { formatTemperature, formatDateTime } = useUserSettings();
  const cropId = selectedCrop?.id || '';
  const userId = currentUser?.id || '';
  const [sensors, setSensors] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(null); // null | 'new' | sensor id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { zones, reload: reloadZones } = useZones(selectedCrop);
  const zoneNames = useMemo(() => new Map(zones.map((zone) => [zone.id, zone.name])), [zones]);
  const { rows, cols } = layoutOf(selectedCrop);

  const load = useCallback(async () => {
    if (!cropId) {
      setSensors([]);
      setDevices([]);
      setLoading(false);
      return;
    }
    try {
      const [sensorList, deviceList] = await Promise.all([
        pb.collection('sensors').getFullList({ filter: `cropId = "${cropId}"`, sort: 'created', $autoCancel: false }),
        pb.collection('devices').getFullList({ filter: `cropId = "${cropId}" && is_simulated != true`, sort: 'created', $autoCancel: false }),
      ]);
      setSensors(sensorList);
      setDevices(deviceList);
      setError('');
    } catch (loadError) {
      console.error('Could not load sensors:', loadError);
      setError(`No se pudieron cargar los sensores. ${describeError(loadError)}`);
    } finally {
      setLoading(false);
    }
  }, [cropId]);

  useEffect(() => {
    setLoading(true);
    setEditing(null);
    load();
    const refresh = window.setInterval(load, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 5000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [load]);

  const intervalSeconds = useMemo(
    () => (devices.length > 0 ? Math.min(...devices.map((device) => Number(device.interval_seconds) || 15)) : 15),
    [devices],
  );

  const statuses = useMemo(
    () => new Map(sensors.map((sensor) => [sensor.id, sensorStatus(sensor, selectedCrop, intervalSeconds, now)])),
    [sensors, selectedCrop, intervalSeconds, now],
  );
  const counts = useMemo(() => {
    const result = { ok: 0, alert: 0, stale: 0, never: 0 };
    statuses.forEach((status) => { result[status.state] += 1; });
    return result;
  }, [statuses]);

  const byCell = useMemo(() => {
    const map = new Map();
    sensors.forEach((sensor) => {
      const key = `${Number(sensor.grid_row)}-${Number(sensor.grid_col)}`;
      if (!map.has(key)) map.set(key, sensor);
    });
    return map;
  }, [sensors]);

  const freeCells = useMemo(() => {
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const occupant = byCell.get(`${row}-${col}`);
        if (!occupant || occupant.id === editing) cells.push(`${row}-${col}`);
      }
    }
    return cells;
  }, [rows, cols, byCell, editing]);

  const lastDeviceSeen = useMemo(() => {
    const times = devices.map((device) => new Date(device.last_seen || device.last_ingest_at || 0).getTime()).filter((time) => time > 0);
    return times.length > 0 ? Math.max(...times) : 0;
  }, [devices]);
  const deviceOnline = lastDeviceSeen > 0 && now - lastDeviceSeen <= staleAfterMs(intervalSeconds);

  const startNew = (cell) => {
    setEditing('new');
    setConfirmDelete(false);
    setFormError('');
    setForm({ ...emptyForm, cell: cell || freeCells[0] || '' });
  };
  const startEdit = (sensor) => {
    setEditing(sensor.id);
    setConfirmDelete(false);
    setFormError('');
    setForm({ name: sensor.name, kind: sensor.kind, cell: `${Number(sensor.grid_row)}-${Number(sensor.grid_col)}`, zoneId: sensor.zoneId || '' });
  };
  const closeForm = () => {
    setEditing(null);
    setConfirmDelete(false);
    setFormError('');
  };

  const saveSensor = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError('Ponle un nombre al sensor, por ejemplo «Humedad surco 1».');
      return;
    }
    if (!form.cell) {
      setFormError('Elige una posición libre en el plano.');
      return;
    }
    const [gridRow, gridCol] = form.cell.split('-').map(Number);
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await pb.collection('sensors').create({ userId, cropId, name, kind: form.kind, grid_row: gridRow, grid_col: gridCol, ...(form.kind === 'soil_humidity' && form.zoneId ? { zoneId: form.zoneId } : {}) }, { $autoCancel: false });
      } else {
        await pb.collection('sensors').update(editing, { name, grid_row: gridRow, grid_col: gridCol, ...(form.kind === 'soil_humidity' ? { zoneId: form.zoneId || '' } : {}) }, { $autoCancel: false });
      }
      closeForm();
      await load();
    } catch (saveError) {
      console.error('Could not save sensor:', saveError);
      setFormError(`No se pudo guardar el sensor. ${describeError(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteSensor = async () => {
    setSaving(true);
    try {
      await pb.collection('sensors').delete(editing, { $autoCancel: false });
      closeForm();
      await load();
    } catch (deleteError) {
      setFormError(`No se pudo eliminar el sensor. ${describeError(deleteError)}`);
    } finally {
      setSaving(false);
    }
  };

  const changeLayout = async (nextRows, nextCols) => {
    setError('');
    try {
      await pb.collection('crops').update(cropId, { layout_rows: nextRows, layout_cols: nextCols }, { $autoCancel: false });
      await refreshCrops();
    } catch (layoutError) {
      setError(`No se pudo cambiar el plano. ${describeError(layoutError)}`);
    }
  };
  const canShrinkRows = rows > 1 && !sensors.some((sensor) => Number(sensor.grid_row) >= rows - 1);
  const canShrinkCols = cols > 1 && !sensors.some((sensor) => Number(sensor.grid_col) >= cols - 1);

  const readingText = (sensor) => {
    if (!sensor.last_reading_at) return '--';
    const value = Number(sensor.last_value);
    return sensor.kind === 'temperature' ? formatTemperature(value) : `${Number(value.toFixed(1))} %`;
  };

  const SummaryTile = ({ label, value, tone }) => (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );

  return (
    <>
      <Helmet><title>Sensores - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-dew py-10 sm:py-14">
        <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><Radio className="h-4 w-4" /> Sensores</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Estado de los sensores</h1>
              <p className="mt-2 max-w-xl text-slate-600">Cómo está distribuido tu cultivo y qué mide cada sensor en este momento.</p>
            </div>
            {selectedCrop && (
              <div role="status" className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${deviceOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                {deviceOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {devices.length === 0
                  ? 'Sin dispositivo vinculado'
                  : deviceOnline ? `Dispositivo en línea · hace ${formatAge(now - lastDeviceSeen)}` : 'Dispositivo sin conexión'}
              </div>
            )}
          </header>

          {!selectedCrop ? (
            <Card><CardContent className="flex flex-col items-start gap-3 p-8">
              <Sprout className="h-8 w-8 text-teal-700" />
              <p className="font-semibold text-slate-900">Primero crea un cultivo</p>
              <p className="text-slate-600">Los sensores se registran dentro de un cultivo.</p>
              <Button asChild className="bg-teal-700 hover:bg-teal-800"><Link to="/crops">Ir a Cultivos</Link></Button>
            </CardContent></Card>
          ) : (
            <>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

              <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryTile label="Sensores" value={sensors.length} tone="border-teal-100 bg-white" />
                <SummaryTile label="Normales" value={counts.ok} tone="border-emerald-200 bg-emerald-50" />
                <SummaryTile label="En alerta" value={counts.alert} tone="border-rose-200 bg-rose-50" />
                <SummaryTile label="Sin señal o sin datos" value={counts.stale + counts.never} tone="border-amber-200 bg-amber-50" />
              </section>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <Card className="rounded-3xl border-teal-100">
                  <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle>Plano de «{selectedCrop.name}»</CardTitle>
                      <CardDescription>Toca un sensor para editarlo o un espacio libre para agregar uno.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      {[['Filas', rows, canShrinkRows, (delta) => changeLayout(rows + delta, cols), rows < 6],
                        ['Columnas', cols, canShrinkCols, (delta) => changeLayout(rows, cols + delta), cols < 6]].map(([label, value, canShrink, change, canGrow]) => (
                        <div key={label} className="flex items-center gap-1" role="group" aria-label={label}>
                          <span className="mr-1">{label}</span>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Quitar ${label.toLowerCase()}`} disabled={!canShrink} onClick={() => change(-1)}><Minus className="h-4 w-4" /></Button>
                          <span className="w-5 text-center font-semibold text-slate-900">{value}</span>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Agregar ${label.toLowerCase()}`} disabled={!canGrow} onClick={() => change(1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <p className="py-10 text-center text-slate-500">Cargando sensores…</p>
                    ) : (
                      <div
                        className="grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3 sm:p-4"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: rows * cols }, (_, index) => {
                          const row = Math.floor(index / cols);
                          const col = index % cols;
                          const sensor = byCell.get(`${row}-${col}`);
                          if (!sensor) {
                            return (
                              <button
                                key={`${row}-${col}`}
                                type="button"
                                onClick={() => startNew(`${row}-${col}`)}
                                aria-label={`Agregar sensor en fila ${row + 1}, columna ${col + 1}`}
                                className="flex min-h-[8.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-teal-200 bg-white/60 text-sm font-medium text-teal-700 transition-colors hover:border-teal-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                              >
                                <Plus className="h-5 w-5" /> Agregar sensor
                              </button>
                            );
                          }
                          const status = statuses.get(sensor.id);
                          const style = STATE_STYLES[status.state];
                          const Icon = KIND_ICONS[sensor.kind] || Gauge;
                          return (
                            <button
                              key={sensor.id}
                              type="button"
                              onClick={() => startEdit(sensor)}
                              aria-label={`Fila ${row + 1}, columna ${col + 1}: ${sensor.name}, ${readingText(sensor)}, ${status.label}`}
                              className={`flex min-h-[8.5rem] flex-col justify-between rounded-2xl border p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${style.tile} ${editing === sensor.id ? 'ring-2 ring-teal-600' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.icon}`}><Icon className="h-5 w-5" /></span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${style.pill}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />{status.label}
                                </span>
                              </div>
                              <div>
                                <p className="text-2xl font-extrabold tracking-tight text-slate-900">{readingText(sensor)}</p>
                                <p className="truncate text-sm font-semibold text-slate-700">{sensor.name}</p>
                                <p className="truncate text-xs text-slate-500">{SENSOR_KINDS[sensor.kind]?.label}{sensor.zoneId && zoneNames.get(sensor.zoneId) ? ` · ${zoneNames.get(sensor.zoneId)}` : ''}</p>
                                {sensor.kind === 'soil_humidity' && status.state !== 'stale' && status.state !== 'never' && soilState(sensor.last_value, selectedCrop) && (
                                  <p className="mt-1 text-xs font-semibold text-slate-700">{soilState(sensor.last_value, selectedCrop).label}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="h-fit rounded-3xl border-teal-100">
                  <CardHeader>
                    <CardTitle>{editing === 'new' ? 'Nuevo sensor' : editing ? 'Editar sensor' : 'Sensores'}</CardTitle>
                    <CardDescription>
                      {editing ? 'Los cambios se aplican al plano al guardar.' : 'Elige un espacio del plano para empezar.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {editing ? (
                      <form onSubmit={saveSensor} className="space-y-4" noValidate>
                        <div className="space-y-2">
                          <Label htmlFor="sensor-name">Nombre</Label>
                          <Input id="sensor-name" value={form.name} maxLength={60} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Humedad surco 1" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sensor-kind">Qué mide</Label>
                          <select
                            id="sensor-kind"
                            value={form.kind}
                            disabled={editing !== 'new'}
                            onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
                            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            {Object.entries(SENSOR_KINDS).map(([value, kind]) => <option key={value} value={value}>{kind.label}</option>)}
                          </select>
                          {editing !== 'new' && <p className="text-xs text-slate-500">El tipo no se puede cambiar; crea otro sensor si lo necesitas.</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sensor-cell">Posición en el plano</Label>
                          <select
                            id="sensor-cell"
                            value={form.cell}
                            onChange={(event) => setForm((current) => ({ ...current, cell: event.target.value }))}
                            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                          >
                            {freeCells.length === 0 && <option value="">No quedan espacios libres</option>}
                            {freeCells.map((cell) => {
                              const [row, col] = cell.split('-').map(Number);
                              return <option key={cell} value={cell}>Fila {row + 1}, columna {col + 1}</option>;
                            })}
                          </select>
                          {freeCells.length === 0 && <p className="text-xs text-slate-500">Agrega una fila o columna al plano para tener más espacio.</p>}
                        </div>
                        {form.kind === 'soil_humidity' && zones.length > 0 && (
                          <div className="space-y-2">
                            <Label htmlFor="sensor-zone">Zona de riego</Label>
                            <select
                              id="sensor-zone"
                              value={form.zoneId}
                              onChange={(event) => setForm((current) => ({ ...current, zoneId: event.target.value }))}
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                            >
                              <option value="">Sin zona (lectura general)</option>
                              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                            </select>
                            <p className="text-xs text-slate-500">La zona se riega según el promedio de sus sensores de suelo.</p>
                          </div>
                        )}
                        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={saving || freeCells.length === 0} className="bg-teal-700 hover:bg-teal-800">{saving ? 'Guardando…' : 'Guardar sensor'}</Button>
                          <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancelar</Button>
                        </div>
                        {editing !== 'new' && (
                          <div className="border-t border-slate-100 pt-4">
                            {confirmDelete ? (
                              <div className="space-y-2">
                                <p className="text-sm text-slate-700">Se borrará este sensor del plano. Las lecturas del cultivo no se pierden.</p>
                                <div className="flex gap-2">
                                  <Button type="button" onClick={deleteSensor} disabled={saving} className="bg-rose-600 text-white hover:bg-rose-700">Sí, eliminar</Button>
                                  <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>No</Button>
                                </div>
                              </div>
                            ) : (
                              <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar sensor</Button>
                            )}
                          </div>
                        )}
                      </form>
                    ) : (
                      <div className="space-y-3 text-sm text-slate-600">
                        <p>Cada sensor aparece donde lo colocaste en el cultivo, con su última lectura y su estado.</p>
                        <ul className="space-y-2">
                          {[['ok', 'Normal', 'Dentro de los umbrales del cultivo.'], ['alert', 'Alerta', 'Fuera de un umbral configurado.'], ['stale', 'Sin señal', 'No envía datos hace varios intervalos.'], ['never', 'Sin lecturas', 'Aún no ha enviado nada.']].map(([state, label, text]) => (
                            <li key={state} className="flex items-start gap-2">
                              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATE_STYLES[state].dot}`} />
                              <span><strong className="text-slate-800">{label}.</strong> {text}</span>
                            </li>
                          ))}
                        </ul>
                        <Button type="button" onClick={() => startNew('')} disabled={freeCells.length === 0} className="w-full bg-teal-700 hover:bg-teal-800"><Plus className="mr-2 h-4 w-4" /> Agregar sensor</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <ZonesCard crop={selectedCrop} userId={userId} zones={zones} reload={reloadZones} sensors={sensors} />

              <Card className="rounded-3xl border-teal-100">
                <CardHeader>
                  <CardTitle>Detalle de cada sensor</CardTitle>
                  <CardDescription>Última lectura y estado, ordenados por su posición en el plano.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {sensors.length === 0 ? (
                    <p className="py-6 text-center text-slate-500">Todavía no hay sensores. Agrega el primero desde el plano.</p>
                  ) : (
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th scope="col" className="py-2 pr-3 font-medium">Sensor</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Posición</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Lectura</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Última actualización</th>
                          <th scope="col" className="py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sensors]
                          .sort((a, b) => (Number(a.grid_row) - Number(b.grid_row)) || (Number(a.grid_col) - Number(b.grid_col)))
                          .map((sensor) => {
                            const status = statuses.get(sensor.id);
                            const style = STATE_STYLES[status.state];
                            return (
                              <tr key={sensor.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-3 pr-3"><p className="font-semibold text-slate-900">{sensor.name}</p><p className="text-xs text-slate-500">{SENSOR_KINDS[sensor.kind]?.label}</p></td>
                                <td className="py-3 pr-3 text-slate-600">Fila {Number(sensor.grid_row) + 1}, col. {Number(sensor.grid_col) + 1}</td>
                                <td className="py-3 pr-3 font-semibold text-slate-900">{readingText(sensor)}</td>
                                <td className="py-3 pr-3 text-slate-600">{sensor.last_reading_at ? formatDateTime(sensor.last_reading_at) : '—'}</td>
                                <td className="py-3"><span title={status.detail} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />{status.label}</span></td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default SensorsPage;
