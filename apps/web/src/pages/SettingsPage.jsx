import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BellRing, Mail } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import pb from '@/lib/pocketbaseClient';

const describeRequestError = (error) => {
  const status = error?.status;
  if (status === 0 || (!status && /fetch|network/i.test(String(error?.message)))) {
    return 'No se pudo conectar con el servidor. Comprueba que PocketBase esté en marcha.';
  }
  if (status === 401 || status === 403) return 'Tu sesión no tiene permiso para ver estas preferencias. Cierra sesión y vuelve a entrar.';
  if (status) return `El servidor respondió con el error ${status}${error?.response?.message ? `: ${error.response.message}` : ''}.`;
  return error?.message || 'Error desconocido.';
};

const defaults = { notify_irrigation_events: false, notify_alerts: true };

const SettingsPage = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(defaults);
  const [recordId, setRecordId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const result = await pb.collection('user_settings').getList(1, 1, {
        filter: `userId = "${currentUser.id}"`,
        sort: '-updated',
        $autoCancel: false,
      });
      const record = result.items[0];
      setRecordId(record?.id || '');
      setSettings(record
        ? {
          notify_irrigation_events: record.notify_irrigation_events ?? false,
          notify_alerts: record.notify_alerts ?? true,
        }
        : defaults);
    } catch (loadError) {
      console.error('Could not load notification preferences:', loadError);
      setError(`No se pudieron cargar las preferencias de notificación. ${describeRequestError(loadError)}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { userId: currentUser.id, ...settings };
      const saved = recordId
        ? await pb.collection('user_settings').update(recordId, payload, { $autoCancel: false })
        : await pb.collection('user_settings').create(payload, { $autoCancel: false });
      setRecordId(saved.id);
      setMessage('Preferencias guardadas.');
    } catch (saveError) {
      console.error('Could not save notification preferences:', saveError);
      setError(`No se pudieron guardar las preferencias. ${describeRequestError(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet><title>Ajustes - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-dew px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><BellRing className="h-4 w-4" /> Preferencias</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ajustes de notificaciones</h1>
            <p className="mt-2 text-slate-600">Elige qué novedades del cultivo quieres recibir por correo.</p>
          </header>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-teal-700" /> Notificaciones por correo</CardTitle>
              <CardDescription>Como máximo se envía un correo de cada tipo y cultivo cada 30 minutos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                ['notify_irrigation_events', 'Inicios y finales de riego', 'Desactivado inicialmente para evitar correos repetidos.'],
                ['notify_alerts', 'Alertas importantes', 'Incluye nivel de agua, temperatura y dispositivo sin conexión.'],
              ].map(([key, title, description]) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key])}
                    disabled={loading || saving}
                    onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))}
                    className="mt-1 h-4 w-4 accent-teal-700"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">{title}</span>
                    <span className="mt-1 block text-sm text-slate-600">{description}</span>
                  </span>
                </label>
              ))}
              {error && (
                <div role="alert" className="space-y-2 text-sm text-red-700">
                  <p>{error}</p>
                  <Button type="button" variant="outline" size="sm" onClick={loadSettings} disabled={loading}>Reintentar</Button>
                </div>
              )}
              {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
              <Button type="button" onClick={saveSettings} disabled={loading || saving} className="min-h-11 bg-teal-700 hover:bg-teal-800">
                {saving ? 'Guardando…' : 'Guardar preferencias'}
              </Button>
            </CardContent>
          </Card>
          <p className="text-sm text-slate-600">
            Los umbrales de humedad, agua y temperatura que disparan las alertas se configuran por cultivo en{' '}
            <Link to="/crops" className="font-semibold text-teal-700 hover:underline">Cultivos</Link>.
          </p>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;
