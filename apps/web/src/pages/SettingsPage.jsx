import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Database, Droplets, FlaskConical, Settings2, ShieldAlert, User } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useCrop } from '@/contexts/CropContext';
import { validateDefaults } from '@/utils/settingsValidation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import pb from '@/lib/pocketbaseClient';
import { TIME_ZONES } from '@/utils/units';

const describeRequestError = (error) => {
  const status = error?.status;
  if (status === 0 || (!status && /fetch|network/i.test(String(error?.message)))) {
    return 'No se pudo conectar con el servidor. Comprueba que PocketBase esté en marcha.';
  }
  if (status === 401 || status === 403) return 'Tu sesión no tiene permiso para esta acción. Cierra sesión y vuelve a entrar.';
  if (status) return `El servidor respondió con el error ${status}${error?.response?.message ? `: ${error.response.message}` : ''}.`;
  return error?.message || 'Error desconocido.';
};

// Datos de ejemplo para mostrar Neptuno funcionando sin hardware: 30 días de lecturas y riegos que siguen en vivo.
const DemoDataSection = () => {
  const { selectedCrop, refreshCrops } = useCrop();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const run = async (action) => {
    if (!selectedCrop) return;
    setBusy(action);
    setMessage('');
    try {
      if (action === 'load') {
        const result = await pb.send('/api/neptuno/demo/history', { method: 'POST', body: { cropId: selectedCrop.id, days: 30, live: true } });
        setMessage(`Listo: ${result.readings} lecturas y ${result.logs} cambios de riego de los últimos 30 días. Seguirán actualizándose solos cada 5 minutos.`);
      } else {
        await pb.send('/api/neptuno/demo/history', { method: 'DELETE', query: { cropId: selectedCrop.id } });
        setMessage('Datos de ejemplo borrados. Tus datos reales no se tocaron.');
      }
      await refreshCrops();
    } catch (error) {
      setMessage(`No se pudo completar la acción. ${describeRequestError(error)}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3 border-t border-slate-100 pt-5">
      <p className="text-sm font-semibold text-slate-800">Datos de ejemplo</p>
      <p className="text-sm text-slate-600">
        {selectedCrop
          ? `Llena «${selectedCrop.name}» con 30 días de lecturas, riegos y zonas de ejemplo para ver todos los paneles y gráficos con datos, como si el sistema ya estuviera conectado. Quedan marcados como demostración.`
          : 'Crea o selecciona un cultivo para cargar datos de ejemplo.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => run('load')} disabled={!selectedCrop || Boolean(busy)} className="bg-teal-700 text-white hover:bg-teal-800">
          {busy === 'load' ? 'Cargando…' : selectedCrop?.demo_live ? 'Volver a generar datos' : 'Cargar datos de ejemplo'}
        </Button>
        <Button type="button" variant="outline" onClick={() => run('clear')} disabled={!selectedCrop || Boolean(busy)} className="border-rose-200 text-rose-700 hover:bg-rose-50">
          {busy === 'clear' ? 'Borrando…' : 'Borrar datos de ejemplo'}
        </Button>
      </div>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </div>
  );
};

const RETENTION_OPTIONS = [7, 14, 30, 60, 90];

const Segmented = ({ label, value, options, onChange, disabled }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-teal-100 bg-teal-50/60 p-1">
    {options.map(([optionValue, optionLabel]) => (
      <button
        key={optionValue}
        type="button"
        role="radio"
        aria-checked={value === optionValue}
        disabled={disabled}
        onClick={() => onChange(optionValue)}
        className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${value === optionValue ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
      >
        {optionLabel}
      </button>
    ))}
  </div>
);

const Section = ({ icon: Icon, title, description, children }) => (
  <Card className="rounded-3xl border-teal-100">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Icon className="h-5 w-5" /></span>{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className="space-y-5">{children}</CardContent>
  </Card>
);

const SettingsPage = () => {
  const { currentUser, updateProfile, deleteAccount } = useAuth();
  const { settings, loading, error: loadError, reload, save } = useUserSettings();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(settings);
  const [name, setName] = useState(currentUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => { setName(currentUser?.name || ''); }, [currentUser?.name]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings) || name.trim() !== (currentUser?.name || ''),
    [draft, settings, name, currentUser?.name],
  );
  const set = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setMessage(''); };
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoneOptions = useMemo(() => {
    const list = [...TIME_ZONES];
    [draft.timezone, browserZone].forEach((zone) => { if (zone && !list.some(([value]) => value === zone)) list.push([zone, zone]); });
    return list;
  }, [draft.timezone, browserZone]);

  const saveAll = async () => {
    setError('');
    setMessage('');
    const problem = validateDefaults(draft);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      if (name.trim() !== (currentUser?.name || '')) await updateProfile({ name });
      await save(draft);
      setMessage('Cambios guardados.');
    } catch (saveError) {
      console.error('Could not save settings:', saveError);
      setError(`No se pudieron guardar los cambios. ${describeRequestError(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setDataMessage('');
    try {
      const data = await pb.send('/api/neptuno/me/export', {});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neptuno-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDataMessage('Descarga lista.');
    } catch (exportError) {
      setDataMessage(`No se pudieron exportar tus datos. ${describeRequestError(exportError)}`);
    } finally {
      setExporting(false);
    }
  };

  const removeAccount = async () => {
    setDeleting(true);
    setDataMessage('');
    try {
      await deleteAccount();
      navigate('/');
    } catch (deleteError) {
      setDataMessage(`No se pudo eliminar la cuenta. ${describeRequestError(deleteError)}`);
      setDeleting(false);
    }
  };

  const numberField = (id, label, key, props = {}, help) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" step="any" min="0" placeholder="Sin configurar" disabled={loading || saving} value={draft[key]} onChange={(event) => set(key, event.target.value)} {...props} />
      {help && <p className="text-xs text-slate-500">{help}</p>}
    </div>
  );

  return (
    <>
      <Helmet><title>Ajustes - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-dew px-4 py-10 pb-28 sm:px-6 sm:py-14 sm:pb-28">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><Settings2 className="h-4 w-4" /> Preferencias</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ajustes</h1>
            <p className="mt-2 text-slate-600">Personaliza tu cuenta, las unidades y los valores que usa Neptuno por defecto.</p>
          </header>

          {loadError && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <span>{loadError}</span><Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>Reintentar</Button>
            </div>
          )}

          <Section icon={User} title="Cuenta" description="Cómo apareces en Neptuno y en qué zona horaria ves las fechas.">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Nombre</Label>
              <Input id="settings-name" value={name} maxLength={100} disabled={saving} onChange={(event) => { setName(event.target.value); setMessage(''); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Correo</Label>
              <Input id="settings-email" value={currentUser?.email || ''} readOnly disabled />
              <p className="text-xs text-slate-500">El correo identifica tu cuenta y no se puede cambiar aquí.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-timezone">Zona horaria</Label>
              <select id="settings-timezone" value={draft.timezone} disabled={loading || saving} onChange={(event) => set('timezone', event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="">Usar la de este dispositivo ({browserZone})</option>
                {zoneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="text-xs text-slate-500">Se aplica a las fechas de los sensores y de los reportes.</p>
            </div>
          </Section>

          <Section icon={Droplets} title="Unidades" description="Los datos se guardan siempre en litros y °C; aquí eliges cómo verlos y descargarlos.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-slate-800">Volumen de agua</span>
              <Segmented label="Volumen de agua" value={draft.unit_volume} disabled={loading || saving} onChange={(value) => set('unit_volume', value)} options={[['L', 'Litros (L)'], ['gal', 'Galones (gal)']]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-slate-800">Temperatura</span>
              <Segmented label="Temperatura" value={draft.unit_temp} disabled={loading || saving} onChange={(value) => set('unit_temp', value)} options={[['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)']]} />
            </div>
          </Section>

          <Section icon={Settings2} title="Valores por defecto de los cultivos nuevos" description="Se rellenan solos al crear un cultivo; en cada cultivo los puedes cambiar. Valídalos con tu asesor agronómico.">
            <div className="grid gap-4 sm:grid-cols-2">
              {numberField('default-humidity-min', 'Humedad mínima (%)', 'default_humidity_min', { max: '100' })}
              {numberField('default-humidity-max', 'Humedad máxima (%)', 'default_humidity_max', { max: '100' })}
              {numberField('default-max-irrigation', 'Riego continuo máximo (min)', 'default_max_irrigation_minutes', { max: '1440' }, 'Por seguridad, el riego se detiene al llegar a este tiempo.')}
              {numberField('default-min-rest', 'Descanso mínimo entre riegos (min)', 'default_min_rest_minutes', { max: '10080' })}
              {numberField('default-flow', 'Caudal (L/min)', 'default_flow_lpm', {}, 'Sirve para estimar el consumo de agua. Mídelo con tu sistema.')}
            </div>
          </Section>

          <Section icon={BellRing} title="Notificaciones por correo" description="Como máximo se envía un correo de cada tipo y cultivo cada 30 minutos.">
            {[
              ['notify_irrigation_events', 'Inicios y finales de riego', 'Desactivado inicialmente para evitar correos repetidos.'],
              ['notify_alerts', 'Alertas importantes', 'Incluye nivel de agua, temperatura y dispositivo sin conexión.'],
            ].map(([key, title, description]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-teal-100 p-4 hover:bg-teal-50/40">
                <input type="checkbox" checked={Boolean(draft[key])} disabled={loading || saving} onChange={(event) => set(key, event.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" />
                <span><span className="block font-semibold text-slate-900">{title}</span><span className="mt-1 block text-sm text-slate-600">{description}</span></span>
              </label>
            ))}
            <p className="text-sm text-slate-600">
              Los umbrales que disparan las alertas se configuran por cultivo en <Link to="/crops" className="font-semibold text-teal-700 hover:underline">Cultivos</Link>.
            </p>
          </Section>

          <Section icon={FlaskConical} title="Modo demostración" description="Un laboratorio para probar el riego con datos simulados, sin tocar tu cultivo real.">
            <p className="text-sm text-slate-600">
              Los datos simulados no aparecen en tus sensores ni en tus reportes. <Link to="/simulator" className="font-semibold text-teal-700 hover:underline">Abrir el laboratorio</Link>.
            </p>
            <DemoDataSection />
          </Section>

          <Section icon={Database} title="Datos y privacidad" description="Qué se guarda de tus sensores y cómo llevarte tu información.">
            <div className="space-y-2">
              <Label htmlFor="settings-retention">Conservar lecturas detalladas</Label>
              <select id="settings-retention" value={draft.retention_days} disabled={loading || saving} onChange={(event) => set('retention_days', Number(event.target.value))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {RETENTION_OPTIONS.map((days) => <option key={days} value={days}>{days} días</option>)}
              </select>
              <p className="text-xs text-slate-500">Pasado ese tiempo, las lecturas se resumen por hora para ahorrar espacio. Los reportes siguen funcionando.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <Button type="button" variant="outline" onClick={exportData} disabled={exporting} className="border-teal-200 text-teal-800 hover:bg-teal-50">{exporting ? 'Preparando…' : 'Descargar mis datos (JSON)'}</Button>
              <span className="text-xs text-slate-500">Cultivos, dispositivos, sensores, riegos y lecturas.</span>
            </div>
            {dataMessage && <p role="status" className="text-sm text-slate-700">{dataMessage}</p>}
          </Section>

          <Card className="rounded-3xl border-rose-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-rose-700"><ShieldAlert className="h-5 w-5" /> Eliminar mi cuenta</CardTitle>
              <CardDescription>Se borran tu cuenta y todos tus cultivos, sensores, riegos y lecturas. No se puede deshacer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="settings-delete-confirm">Escribe ELIMINAR para confirmar</Label>
              <div className="flex flex-wrap gap-3">
                <Input id="settings-delete-confirm" className="max-w-xs" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" />
                <Button type="button" onClick={removeAccount} disabled={confirmText !== 'ELIMINAR' || deleting} className="bg-rose-600 text-white hover:bg-rose-700">{deleting ? 'Eliminando…' : 'Eliminar cuenta'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div aria-live="polite" className="min-h-5 text-sm">
              {error ? <span role="alert" className="text-rose-700">{error}</span>
                : message ? <span role="status" className="text-emerald-700">{message}</span>
                  : dirty ? <span className="text-slate-600">Tienes cambios sin guardar.</span>
                    : <span className="text-slate-500">Todo está guardado.</span>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setDraft(settings); setName(currentUser?.name || ''); setError(''); setMessage(''); }}>Descartar</Button>
              <Button type="button" onClick={saveAll} disabled={!dirty || saving || loading} className="min-h-10 bg-teal-700 hover:bg-teal-800">{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;
