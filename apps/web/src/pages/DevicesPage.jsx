import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { AlertCircle, Copy, Cpu, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import pb from '@/lib/pocketbaseClient';

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const createDeviceKey = async () => {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error('Este navegador no puede crear claves seguras. Usa HTTPS o un navegador actualizado.');
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const key = bytesToHex(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return { key, keyHash: bytesToHex(new Uint8Array(digest)) };
};

const DevicesPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop } = useCrop();
  const cropId = selectedCrop?.id || '';
  const [devices, setDevices] = useState([]);
  const [name, setName] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState('15');
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const refreshDevices = useCallback(async () => {
    if (!currentUser || !cropId) {
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const records = await pb.collection('devices').getFullList({
        filter: `cropId = "${cropId}"`,
        sort: 'name',
        $autoCancel: false,
      });
      setDevices(records);
    } catch (loadError) {
      console.error('Could not load devices:', loadError);
      setError('No se pudieron cargar los dispositivos.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, cropId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    let timer = null;
    const scheduleOfflineRefresh = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      const transitions = devices
        .filter((device) => device.last_seen)
        .map((device) => new Date(device.last_seen).getTime() + Number(device.interval_seconds) * 2000)
        .filter((timestamp) => timestamp > currentTime);
      if (transitions.length > 0) {
        timer = window.setTimeout(scheduleOfflineRefresh, Math.max(1000, Math.min(...transitions) - currentTime));
      }
    };
    scheduleOfflineRefresh();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [devices]);

  useEffect(() => {
    if (!cropId) return undefined;
    let active = true;
    let unsubscribe = null;
    pb.collection('devices').subscribe('*', (event) => {
      if (!active || event.record?.cropId !== cropId) return;
      setDevices((current) => event.action === 'delete'
        ? current.filter((device) => device.id !== event.record.id)
        : [...current.filter((device) => device.id !== event.record.id), event.record]
          .sort((first, second) => first.name.localeCompare(second.name)));
    }).then((stop) => {
      const stopSafely = () => {
        const result = stop();
        if (result?.catch) result.catch((error) => console.error('Could not unsubscribe from device status:', error));
      };
      if (active) unsubscribe = stopSafely;
      else stopSafely();
    }).catch((subscribeError) => {
      console.error('Could not subscribe to device status:', subscribeError);
    });
    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [cropId]);

  const handleCreateDevice = async (event) => {
    event.preventDefault();
    if (!currentUser || !selectedCrop) {
      setError('Selecciona un cultivo antes de registrar un dispositivo.');
      return;
    }
    const interval = Number(intervalSeconds);
    if (!Number.isInteger(interval) || interval < 1 || interval > 3600) {
      setError('El intervalo debe estar entre 1 y 3600 segundos.');
      return;
    }
    setSaving(true);
    setError('');
    setNewKey('');
    try {
      const { key, keyHash } = await createDeviceKey();
      const record = await pb.collection('devices').create({
        userId: currentUser.id,
        cropId: selectedCrop.id,
        name: name.trim(),
        key_hash: keyHash,
        interval_seconds: interval,
        desired_state: 'OFF',
      }, { $autoCancel: false });
      setDevices((existing) => [...existing, record].sort((first, second) => first.name.localeCompare(second.name)));
      setNewKey(key);
      setName('');
      setCopied(false);
    } catch (saveError) {
      console.error('Could not create device:', saveError);
      setError(saveError?.data?.message || saveError?.message || 'No se pudo registrar el dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`¿Eliminar el dispositivo “${device.name}”?`)) return;
    try {
      await pb.collection('devices').delete(device.id, { $autoCancel: false });
      setDevices((existing) => existing.filter((item) => item.id !== device.id));
      if (newKey) setNewKey('');
    } catch (deleteError) {
      console.error('Could not delete device:', deleteError);
      setError(deleteError?.data?.message || deleteError?.message || 'No se pudo eliminar el dispositivo.');
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch (copyError) {
      console.error('Could not copy device key:', copyError);
      setError('No se pudo copiar la clave; selecciónala y cópiala manualmente.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Dispositivos - Neptuno</title>
        <meta name="description" content="Registra y supervisa los dispositivos de medición de cada cultivo." />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-[#f4fbfa] py-10 sm:py-14">
        <div className="container mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><Cpu className="h-4 w-4" /> Conexión de sensores</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Dispositivos</h1>
            <p className="mt-2 text-slate-600">Registra un dispositivo para este cultivo; su clave secreta solo se muestra una vez.</p>
          </header>

          {!selectedCrop && (
            <Card><CardContent className="py-6 text-slate-700">Primero crea o selecciona un cultivo en <Link className="font-semibold text-teal-700 underline" to="/crops">Mis cultivos</Link>.</CardContent></Card>
          )}
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
          {newKey && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader><CardTitle className="text-amber-950">Guarda esta clave ahora</CardTitle><CardDescription className="text-amber-900">Neptuno no guarda la clave original. Si la pierdes, elimina el dispositivo y registra uno nuevo.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-sm">{newKey}</code>
                <Button type="button" variant="outline" onClick={copyKey} className="min-h-11"><Copy className="mr-2 h-4 w-4" />{copied ? 'Copiada' : 'Copiar clave'}</Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="border-teal-100 bg-white shadow-sm">
              <CardHeader><CardTitle>Registrar dispositivo</CardTitle><CardDescription>El simulador y los equipos deben enviar lecturas respetando este intervalo.</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDevice} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="device-name">Nombre</Label><Input id="device-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="Sensor del lote norte" /></div>
                  <div className="space-y-2"><Label htmlFor="device-interval">Intervalo de reporte (segundos)</Label><Input id="device-interval" type="number" min="1" max="3600" step="1" value={intervalSeconds} onChange={(event) => setIntervalSeconds(event.target.value)} required /></div>
                  <Button type="submit" disabled={saving || !selectedCrop} className="min-h-11 w-full bg-teal-700 hover:bg-teal-800">{saving ? 'Registrando…' : <><Plus className="mr-2 h-4 w-4" />Crear clave de dispositivo</>}</Button>
                </form>
              </CardContent>
            </Card>

            <section aria-label="Dispositivos del cultivo" className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">{selectedCrop?.name || 'Cultivo seleccionado'}</h2>
              {loading ? <p role="status" className="rounded-xl bg-white p-5 text-slate-600">Cargando dispositivos…</p>
                : devices.length === 0 ? <Card className="border-dashed"><CardContent className="py-8 text-center text-slate-600">Todavía no hay dispositivos registrados.</CardContent></Card>
                  : devices.map((device) => {
                    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
                    const online = lastSeen > 0 && now - lastSeen <= Number(device.interval_seconds) * 2000;
                    return (
                      <Card key={device.id} className="border-teal-100 bg-white">
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</span>
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-slate-900">{device.name}</h3>
                              <p className={`text-sm font-medium ${online ? 'text-emerald-700' : 'text-slate-500'}`}>{online ? 'En línea' : 'Sin conexión'}</p>
                              <p className="text-xs text-slate-500">{lastSeen ? `Última lectura: ${new Date(lastSeen).toLocaleString()}` : 'Aún no envía lecturas'}</p>
                              <p className="text-xs text-slate-500">Riego deseado: {device.desired_state || 'OFF'} · cada {device.interval_seconds} s</p>
                            </div>
                          </div>
                          <Button type="button" variant="outline" aria-label={`Eliminar ${device.name}`} onClick={() => handleDelete(device)} className="min-h-11 text-red-700 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                        </CardContent>
                      </Card>
                    );
                  })}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default DevicesPage;
