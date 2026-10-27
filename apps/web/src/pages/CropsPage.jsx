import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';
import { useCrop } from '@/contexts/CropContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Pencil, Plus, Sprout, Trash2, X } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { Link } from 'react-router-dom';
import { toFormValue } from '@/utils/optionalNumber';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import AreaInput from '@/components/AreaInput';
import { formatArea } from '@/utils/area';
import { STRAWBERRY_STAGE_DEFAULTS, applyStageDefaults } from '@/utils/strawberryStages';

const emptyCrop = {
  name: '',
  variety: '',
  area_m2: '',
  flow_lpm: '',
  phenological_stage: '',
  humidity_min: '',
  humidity_max: '',
  max_irrigation_minutes: '',
  min_rest_minutes: '',
  manual_override_minutes: '30',
  alert_water_min: '',
  alert_temp_max: '',
  control_mode: 'MANUAL',
  latitude: '',
  longitude: '',
  rain_skip: false,
  rain_threshold_mm: '2',
  pulse_on_minutes: '',
  pulse_off_minutes: '',
};

const MODE_HELP = {
  MANUAL: 'Solo se usan las alertas. El riego lo controlas tú desde el panel.',
  SCHEDULE: 'El riego sigue los horarios que crees en el panel; aquí solo se configuran las alertas.',
  AUTO: 'El sistema riega cuando la humedad baja del mínimo y corta al llegar al máximo o al límite de tiempo.',
};

const stageLabels = {
  vegetativo: 'Vegetativo',
  floración: 'Floración',
  fructificación: 'Fructificación',
};

const cropToForm = (crop) => ({
  name: crop.name || '',
  variety: crop.variety || '',
  area_m2: toFormValue(crop.area_m2),
  flow_lpm: toFormValue(crop.flow_lpm),
  phenological_stage: crop.phenological_stage || '',
  humidity_min: toFormValue(crop.humidity_min),
  humidity_max: toFormValue(crop.humidity_max),
  max_irrigation_minutes: toFormValue(crop.max_irrigation_minutes),
  min_rest_minutes: toFormValue(crop.min_rest_minutes),
  manual_override_minutes: toFormValue(crop.manual_override_minutes, '30'),
  alert_water_min: toFormValue(crop.alert_water_min),
  alert_temp_max: toFormValue(crop.alert_temp_max),
  control_mode: crop.control_mode || 'MANUAL',
  latitude: Number(crop.latitude) || Number(crop.longitude) ? String(crop.latitude) : '',
  longitude: Number(crop.latitude) || Number(crop.longitude) ? String(crop.longitude) : '',
  rain_skip: Boolean(crop.rain_skip),
  rain_threshold_mm: toFormValue(crop.rain_threshold_mm, '2'),
  pulse_on_minutes: toFormValue(crop.pulse_on_minutes),
  pulse_off_minutes: toFormValue(crop.pulse_off_minutes),
});

// Los valores por defecto de Ajustes rellenan el formulario de un cultivo nuevo.
const withDefaults = (settings) => ({
  ...emptyCrop,
  humidity_min: toFormValue(settings.default_humidity_min),
  humidity_max: toFormValue(settings.default_humidity_max),
  max_irrigation_minutes: toFormValue(settings.default_max_irrigation_minutes),
  min_rest_minutes: toFormValue(settings.default_min_rest_minutes),
  flow_lpm: toFormValue(settings.default_flow_lpm),
});

const CropsPage = () => {
  const { crops, loading, error: loadError, createCrop, updateCrop, deleteCrop, selectCrop, selectedCropId } = useCrop();
  const { settings: userSettings } = useUserSettings();
  const [form, setForm] = useState(() => withDefaults(userSettings));
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [stageNote, setStageNote] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // Si los ajustes llegan después de abrir la página, se aplican mientras el formulario siga vacío.
  useEffect(() => {
    if (!editingId) setForm((current) => (current.name ? current : withDefaults(userSettings)));
  }, [userSettings, editingId]);

  useEffect(() => {
    if (!editingId) return;
    const crop = crops.find((item) => item.id === editingId);
    if (crop) setForm(cropToForm(crop));
  }, [crops, editingId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
    setNotice('');
  };

  const handleToggle = (event) => {
    const { name, checked } = event.target;
    setForm((current) => ({ ...current, [name]: checked }));
    setError('');
    setNotice('');
  };

  const pulsesOn = form.pulse_on_minutes !== '' || form.pulse_off_minutes !== '';
  const togglePulses = (event) => {
    const checked = event.target.checked;
    setForm((current) => ({
      ...current,
      pulse_on_minutes: checked ? '10' : '',
      pulse_off_minutes: checked ? '20' : '',
    }));
    setError('');
    setNotice('');
  };

  const [locating, setLocating] = useState(false);
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no permite obtener la ubicación. Escribe la latitud y la longitud.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(4),
          longitude: position.coords.longitude.toFixed(4),
        }));
        setLocating(false);
      },
      () => {
        setError('No se pudo obtener la ubicación. Revisa el permiso del navegador o escribe las coordenadas.');
        setLocating(false);
      },
      { timeout: 10000 },
    );
  };

  const handleStageChange = (event, force = false) => {
    const stage = typeof event === 'string' ? event : event.target.value;
    const { values, kept } = applyStageDefaults(form, stage, { force });
    setForm((current) => ({ ...current, phenological_stage: stage, ...values }));
    setError('');
    setNotice('');
    setStageNote(
      STRAWBERRY_STAGE_DEFAULTS[stage]
        ? { stage, kept: kept.length }
        : null,
    );
  };

  const resetForm = () => {
    setEditingId('');
    setForm(withDefaults(userSettings));
    setStageNote(null);
    setError('');
    setNotice('');
  };

  const startEdit = (crop) => {
    selectCrop(crop.id);
    setEditingId(crop.id);
    setForm(cropToForm(crop));
    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let savedId = editingId;
      if (editingId) {
        await updateCrop(editingId, form);
        setNotice('Cultivo actualizado.');
      } else {
        const crop = await createCrop(form);
        setNotice('Cultivo creado y seleccionado.');
        setEditingId(crop.id);
        savedId = crop.id;
      }
      if (form.rain_skip && savedId) {
        try {
          const forecast = await pb.send(`/api/neptuno/crops/${savedId}/rain-forecast`, { method: 'POST' });
          setNotice((current) => `${current} Lluvia prevista en las próximas 6 horas: ${forecast.mm} mm.`);
        } catch (forecastError) {
          console.error('Could not fetch rain forecast:', forecastError);
          setNotice((current) => `${current} No pude consultar el pronóstico ahora; se reintenta cada 30 minutos.`);
        }
      }
    } catch (saveError) {
      console.error('Could not save crop:', saveError);
      setError(saveError.message || 'No se pudo guardar el cultivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (crop) => {
    const accepted = window.confirm(
      `¿Eliminar “${crop.name}”? También se eliminarán las lecturas, horarios y el historial de riego asociados a este cultivo.`,
    );
    if (!accepted) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await deleteCrop(crop.id);
      if (editingId === crop.id) resetForm();
      setNotice('Cultivo y datos asociados eliminados.');
    } catch (deleteError) {
      console.error('Could not delete crop:', deleteError);
      setError(deleteError.message || 'No se pudo eliminar el cultivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Cultivos - Neptuno</title>
        <meta name="description" content="Administra tus cultivos y configura su modo de riego." />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-dew py-10 sm:py-14">
        <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
              <Sprout className="h-4 w-4" /> Administración del cultivo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Mis cultivos</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Cada cultivo mantiene sus propias lecturas, área, horarios y configuración de riego.
            </p>
            <Link to="/devices" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50">
              Administrar dispositivos del cultivo
            </Link>
          </header>

          {(error || loadError) && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error || loadError}</p>
            </div>
          )}
          {notice && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
            <Card className="border-teal-100 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>{editingId ? 'Editar cultivo' : 'Agregar cultivo'}</CardTitle>
                <CardDescription>Los umbrales quedan sin configurar hasta que los valides para tu cultivo.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="crop-control-mode">Modo de control</Label>
                    <select id="crop-control-mode" name="control_mode" value={form.control_mode} onChange={handleChange} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="MANUAL">Manual: tú enciendes y apagas el riego</option>
                      <option value="SCHEDULE">Programado: riega en los horarios que definas</option>
                      <option value="AUTO">Automático: riega según la humedad del suelo</option>
                    </select>
                    <p className="text-xs text-slate-500">{MODE_HELP[form.control_mode]}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="crop-name">Nombre</Label>
                      <Input id="crop-name" name="name" value={form.name} onChange={handleChange} placeholder="Fresas del lote norte" required maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-variety">Variedad</Label>
                      <Input id="crop-variety" name="variety" value={form.variety} onChange={handleChange} placeholder="Opcional" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-area">Área total del cultivo</Label>
                      <AreaInput id="crop-area" valueM2={form.area_m2} onChangeM2={(value) => { setForm((current) => ({ ...current, area_m2: value })); setError(''); setNotice(''); }} placeholder="Opcional" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-flow">Caudal medido (L/min)</Label>
                      <Input id="crop-flow" name="flow_lpm" type="number" min="0.01" step="any" value={form.flow_lpm} onChange={handleChange} placeholder="Requerido para consumo estimado" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-stage">Etapa fenológica</Label>
                      <select id="crop-stage" name="phenological_stage" value={form.phenological_stage} onChange={handleStageChange} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="">Sin especificar</option>
                        {Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    {form.control_mode === 'AUTO' && (
                      <>
                    <div className="space-y-2">
                      <Label htmlFor="crop-humidity-min">Humedad mínima (%)</Label>
                      <Input id="crop-humidity-min" name="humidity_min" type="number" min="0" max="100" step="any" value={form.humidity_min} onChange={handleChange} placeholder="Sin configurar" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-humidity-max">Humedad máxima (%)</Label>
                      <Input id="crop-humidity-max" name="humidity_max" type="number" min="0" max="100" step="any" value={form.humidity_max} onChange={handleChange} placeholder="Sin configurar" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-max-irrigation">Máximo de riego continuo (min)</Label>
                      <Input id="crop-max-irrigation" name="max_irrigation_minutes" type="number" min="1" max="1440" step="1" value={form.max_irrigation_minutes} onChange={handleChange} placeholder="Requerido para AUTO" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-min-rest">Descanso mínimo entre riegos (min)</Label>
                      <Input id="crop-min-rest" name="min_rest_minutes" type="number" min="0" max="10080" step="1" value={form.min_rest_minutes} onChange={handleChange} placeholder="0 = sin descanso" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-manual-override">Duración del control manual (min)</Label>
                      <Input id="crop-manual-override" name="manual_override_minutes" type="number" min="1" max="1440" step="1" value={form.manual_override_minutes} onChange={handleChange} required />
                    </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="flex items-start gap-3 text-sm font-medium text-slate-800">
                            <input type="checkbox" checked={pulsesOn} onChange={togglePulses} className="mt-1 h-4 w-4" />
                            <span>
                              Regar por pulsos
                              <span className="block text-xs font-normal text-slate-500">
                                Riega en tandas cortas con pausa para que el agua se absorba (útil en fresa, de raíz superficial). Sigue hasta la humedad máxima, y el máximo de riego cuenta todo el tiempo regado.
                              </span>
                            </span>
                          </label>
                          {pulsesOn && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor="crop-pulse-on">Minutos regando por pulso</Label>
                                <Input id="crop-pulse-on" name="pulse_on_minutes" type="number" min="1" max="1440" step="1" value={form.pulse_on_minutes} onChange={handleChange} />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="crop-pulse-off">Minutos de pausa</Label>
                                <Input id="crop-pulse-off" name="pulse_off_minutes" type="number" min="1" max="1440" step="1" value={form.pulse_off_minutes} onChange={handleChange} />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="crop-alert-water">Alertar si el nivel de agua baja de (%)</Label>
                      <Input id="crop-alert-water" name="alert_water_min" type="number" min="0" max="100" step="any" value={form.alert_water_min} onChange={handleChange} placeholder="Desactivada" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crop-alert-temperature">Alertar si la temperatura supera (°C)</Label>
                      <Input id="crop-alert-temperature" name="alert_temp_max" type="number" min="-10" max="60" step="any" value={form.alert_temp_max} onChange={handleChange} placeholder="Desactivada" />
                    </div>
                  </div>
                  {form.control_mode !== 'MANUAL' && (
                    <div className="space-y-3 rounded-lg border border-cyan-100 bg-cyan-50/50 p-4">
                      <label className="flex items-start gap-3 text-sm font-medium text-slate-800">
                        <input type="checkbox" name="rain_skip" checked={form.rain_skip} onChange={handleToggle} className="mt-1 h-4 w-4" />
                        <span>
                          No empezar a regar si se espera lluvia
                          <span className="block text-xs font-normal text-slate-500">
                            Consulta el pronóstico de las próximas 6 horas (Open-Meteo, gratis). Si el suelo está muy seco, riega igual para no arriesgar el cultivo. El riego en curso se sigue cortando por la humedad.
                          </span>
                        </span>
                      </label>
                      {form.rain_skip && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor="crop-latitude">Latitud</Label>
                            <Input id="crop-latitude" name="latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={handleChange} placeholder="4.4545" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="crop-longitude">Longitud</Label>
                            <Input id="crop-longitude" name="longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={handleChange} placeholder="-73.8" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="crop-rain-threshold">Lluvia que cuenta (mm)</Label>
                            <Input id="crop-rain-threshold" name="rain_threshold_mm" type="number" step="any" min="0.1" max="200" value={form.rain_threshold_mm} onChange={handleChange} />
                          </div>
                          <div className="sm:col-span-3">
                            <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>{locating ? 'Buscando…' : 'Usar mi ubicación actual'}</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {form.control_mode === 'AUTO' && (
                    <>
                  {stageNote && (
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                      <p>
                        Cargué valores sugeridos para {stageLabels[stageNote.stage].toLowerCase()}: {STRAWBERRY_STAGE_DEFAULTS[stageNote.stage].note}
                        {stageNote.kept > 0 && ` Conservé ${stageNote.kept} ${stageNote.kept === 1 ? 'valor que ya habías escrito' : 'valores que ya habías escrito'}.`}
                      </p>
                      {stageNote.kept > 0 && (
                        <button type="button" className="mt-1 font-medium underline" onClick={() => handleStageChange(stageNote.stage, true)}>
                          Reemplazar también esos valores
                        </button>
                      )}
                    </div>
                  )}
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Al elegir la etapa se cargan valores iniciales basados en datos de fresa (tiempos de riego de LSU AgCenter, clima de la fresa en Colombia). Los porcentajes de humedad son un punto de partida: la literatura los mide en tensión del suelo (≈ -10 a -30 kPa), así que calíbralos con tu sensor y valida con AGROSAVIA (2022) antes de usar el modo AUTO.
                  </p>
                  <p className="text-xs leading-relaxed text-amber-800">
                    AUTO no actuará hasta que ambos umbrales y el máximo de riego continuo estén configurados.
                  </p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving} className="bg-teal-700 text-white hover:bg-teal-800">
                      {editingId ? 'Guardar cambios' : <><Plus className="mr-2 h-4 w-4" /> Crear cultivo</>}
                    </Button>
                    {editingId && <Button type="button" variant="outline" onClick={resetForm} disabled={saving}><X className="mr-2 h-4 w-4" /> Cancelar edición</Button>}
                  </div>
                </form>
              </CardContent>
            </Card>

            <section aria-label="Cultivos registrados" className="space-y-3">
              {loading ? <p className="p-4 text-sm text-slate-500">Cargando cultivos…</p> : crops.length === 0 ? (
                <Card className="border-dashed border-teal-200 bg-white">
                  <CardContent className="py-10 text-center text-sm text-slate-600">
                    Aún no tienes cultivos. Crea uno para empezar a registrar lecturas y horarios.
                  </CardContent>
                </Card>
              ) : crops.map((crop) => (
                <Card key={crop.id} className={`bg-white ${selectedCropId === crop.id ? 'border-teal-400 ring-1 ring-teal-200' : 'border-slate-200'}`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <button type="button" onClick={() => selectCrop(crop.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold text-slate-900">{crop.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {[crop.variety, formatArea(crop.area_m2), stageLabels[crop.phenological_stage] || 'Etapa sin especificar'].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-teal-700">Modo {crop.control_mode || 'MANUAL'}</span>
                    </button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(crop)} aria-label={`Editar ${crop.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(crop)} disabled={saving} aria-label={`Eliminar ${crop.name}`} className="text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default CropsPage;
