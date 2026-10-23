import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Activity, Droplets, Sprout, Thermometer, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import pb from '@/lib/pocketbaseClient';
import { getPocketBaseErrorDetails } from '@/lib/pocketbaseError';

const deviceIsOnline = (device, now = Date.now()) => {
  const lastSeen = device?.last_seen ? new Date(device.last_seen).getTime() : 0;
  return lastSeen > 0 && now - lastSeen <= Math.max(2 * Number(device.interval_seconds || 15), 60) * 1000;
};

const SummaryPage = () => {
  const { currentUser } = useAuth();
  const {
    crops,
    loading: cropsLoading,
    error: cropsError,
    selectCrop,
  } = useCrop();
  const [readings, setReadings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setReadings([]);
      setLogs([]);
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const getRecords = async (collection, options) => {
        try {
          return await pb.collection(collection).getFullList(options);
        } catch (requestError) {
          console.error(`Could not load PocketBase collection "${collection}":`, {
            url: `${pb.baseURL}/api/collections/${collection}/records`,
            status: requestError?.status || requestError?.response?.status || 0,
            response: requestError?.response,
            error: requestError,
          });
          throw new Error(`PocketBase "${collection}": ${getPocketBaseErrorDetails(requestError)}`, {
            cause: requestError,
          });
        }
      };
      const [readingRecords, hourlyRecords, logRecords, deviceRecords] = await Promise.all([
        getRecords('sensor_readings', { sort: '-created', $autoCancel: false }),
        getRecords('sensor_readings_hourly', { sort: '-hour_start', $autoCancel: false }),
        getRecords('irrigation_logs', { sort: '-created', $autoCancel: false }),
        getRecords('devices', { sort: 'name', $autoCancel: false }),
      ]);
      setReadings([
        ...readingRecords,
        ...hourlyRecords.map((reading) => ({
          cropId: reading.cropId,
          soil_humidity: reading.humidity_avg,
          temperature: reading.temperature_avg,
          water_level: reading.water_level_avg,
          created: reading.hour_start,
          is_demo: reading.is_demo,
        })),
      ].sort((first, second) => new Date(second.created) - new Date(first.created)));
      setLogs(logRecords);
      setDevices(deviceRecords);
      setNow(Date.now());
    } catch (loadError) {
      console.error('Could not load crop summary:', loadError);
      setError(import.meta.env.DEV
        ? `No se pudo cargar el resumen: ${loadError.message}`
        : 'No se pudo cargar el resumen de cultivos.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const cropData = (crop) => {
    const latestReading = readings.find((reading) => reading.cropId === crop.id);
    const latestLog = logs.find((log) => log.cropId === crop.id);
    const cropDevices = devices.filter((device) => device.cropId === crop.id);
    const online = cropDevices.some((device) => deviceIsOnline(device, now));
    return { latestReading, latestLog, cropDevices, online };
  };

  return (
    <>
      <Helmet><title>Resumen de cultivos - Neptuno</title></Helmet>
      <Header />
      <main className="min-h-screen bg-[#f4fbfa] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl space-y-6">
          <header>
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><Activity className="h-4 w-4" /> Estado general</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Resumen de cultivos</h1>
            <p className="mt-2 text-slate-600">Una vista rápida de las lecturas, el riego y los dispositivos de cada cultivo.</p>
          </header>
          {(error || cropsError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || cropsError}</p>}
          {loading || cropsLoading ? <p role="status" className="rounded-xl bg-white p-5 text-slate-600">Cargando resumen…</p>
            : crops.length === 0 && !cropsError ? <Card><CardContent className="py-8 text-center text-slate-600">Todavía no tienes cultivos. <Link className="font-semibold text-teal-700 underline" to="/crops">Crea uno aquí</Link>.</CardContent></Card>
              : <section aria-label="Resumen por cultivo" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {crops.map((crop) => {
                  const { latestReading, latestLog, cropDevices, online } = cropData(crop);
                  const irrigationState = latestLog?.status === 'ON' ? 'ON' : 'OFF';
                  return (
                    <Card key={crop.id} className="overflow-hidden border-teal-100 bg-white shadow-sm">
                      <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
                        <CardTitle className="flex items-center gap-2 text-slate-900"><Sprout className="h-5 w-5 text-teal-700" />{crop.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Humedad</p>
                            <p className="mt-1 flex items-center gap-1 font-bold text-slate-900">
                              <Droplets className="h-4 w-4 text-cyan-700" />
                              {latestReading ? `${Number(latestReading.soil_humidity).toFixed(1)}%` : 'Sin lectura'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Riego</p>
                            <p className={`mt-1 font-bold ${irrigationState === 'ON' ? 'text-emerald-700' : 'text-slate-700'}`}>{irrigationState}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Dispositivo</p>
                            <p className={`mt-1 flex items-center gap-1 font-semibold ${online ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                              {online ? 'En línea' : 'Sin conexión'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Temperatura</p>
                            <p className="mt-1 flex items-center gap-1 font-semibold text-slate-800">
                              <Thermometer className="h-4 w-4 text-orange-600" />
                              {latestReading ? `${Number(latestReading.temperature).toFixed(1)} °C` : 'Sin lectura'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          Último riego: {latestLog ? new Date(latestLog.created).toLocaleString('es-ES') : 'Sin eventos'}
                          {latestReading?.is_demo ? ' · Demo' : ''}
                        </p>
                        <p className="text-xs text-slate-500">{cropDevices.length} dispositivo(s) registrado(s)</p>
                        <Link
                          to="/dashboard"
                          onClick={() => selectCrop(crop.id)}
                          className="inline-flex min-h-10 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                        >
                          Ver detalle
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>}
        </div>
      </main>
    </>
  );
};

export default SummaryPage;
