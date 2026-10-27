
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useCrop } from '@/contexts/CropContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Clock, Power, Filter, Sprout, Timer, AlertCircle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { formatDistanceStrict, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

const IrrigationHistoryPage = () => {
  const { currentUser } = useAuth();
  const { selectedCrop } = useCrop();
  const cropId = selectedCrop?.id || '';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // '7days', '30days', 'all'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = useCallback(async () => {
    if (!currentUser || !cropId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const filterStr = `cropId = "${cropId}"`;
      const cutoff = filter === '7days'
        ? subDays(new Date(), 7)
        : filter === '30days'
          ? subDays(new Date(), 30)
          : null;

      // Fetch all matching logs to calculate durations properly
      const records = await pb.collection('irrigation_logs').getFullList({
        filter: filterStr,
        sort: '-created',
        $autoCancel: false,
      });

      const orderedRecords = [...records].sort(
        (first, second) => new Date(first.created) - new Date(second.created)
      );
      const sessions = [];
      let openSession = null;

      orderedRecords.forEach((record) => {
        if (record.status === 'ON' && !openSession) {
          openSession = record;
          return;
        }

        if (record.status === 'OFF' && openSession) {
          const activationDate = new Date(openSession.created);
          const closingDate = new Date(record.created);
          sessions.push({
            id: `${openSession.id}-${record.id}`,
            activationDate,
            closingDate,
            status: 'OFF',
            durationMs: closingDate - activationDate,
            durationStr: formatDistanceStrict(activationDate, closingDate, { locale: es }),
            source: openSession.source,
            is_demo: openSession.is_demo,
          });
          openSession = null;
        }
      });

      if (openSession) {
        const activationDate = new Date(openSession.created);
        sessions.push({
          id: openSession.id,
          activationDate,
          closingDate: null,
          status: 'ON',
          durationMs: new Date() - activationDate,
          durationStr: `${formatDistanceStrict(activationDate, new Date(), { locale: es })} (en curso)`,
          source: openSession.source,
          is_demo: openSession.is_demo,
        });
      }

      const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : cutoff;
      const endDate = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
      const minimumMs = minDuration === '' ? null : Number(minDuration) * 60 * 1000;
      const maximumMs = maxDuration === '' ? null : Number(maxDuration) * 60 * 1000;
      const processedLogs = sessions
        .filter((session) => {
          const sessionEnd = session.closingDate || new Date();
          return (!startDate || sessionEnd >= startDate)
            && (!endDate || session.activationDate <= endDate)
            && (minimumMs === null || session.durationMs >= minimumMs)
            && (maximumMs === null || session.durationMs <= maximumMs);
        })
        .sort((first, second) => second.activationDate - first.activationDate);

      setLogs(processedLogs);
      setPage(1);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching irrigation logs:', err);
      setError('No se pudo cargar el historial de riego. Intenta actualizar la página.');
      setLoading(false);
    }
  }, [currentUser, cropId, filter, dateFrom, dateTo, minDuration, maxDuration]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setFilter('all');
    setDateFrom('');
    setDateTo('');
    setMinDuration('');
    setMaxDuration('');
  };

  const totalActivations = logs.length;
  const totalRuntimeMs = logs.reduce((total, log) => total + log.durationMs, 0);
  const totalRuntimeLabel = totalRuntimeMs < 3600000
    ? `${Math.floor(totalRuntimeMs / 60000)} min`
    : `${Math.floor(totalRuntimeMs / 3600000)} h ${String(Math.floor((totalRuntimeMs % 3600000) / 60000)).padStart(2, '0')} min`;
  
  // Pagination logic
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const paginatedLogs = logs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <>
      <Helmet>
        <title>Historial de Riego - Neptuno</title>
        <meta name="description" content="Revisa el historial completo de activaciones de tu sistema de riego" />
      </Helmet>

      <Header />

      <main className="relative min-h-screen overflow-hidden bg-dew py-10 sm:py-14">
        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 rounded-3xl border border-teal-100 bg-white p-6 shadow-sm sm:p-8">
            <span className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><History className="h-4 w-4" /> Actividad del sistema</span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Historial de riego</h1>
            {logs.some((log) => log.is_demo) && <span className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Demo</span>}
            <p className="mt-2 max-w-xl text-slate-600">Revisa cada sesión, cuánto duró y cuándo estuvo activo el riego.</p>
          </div>

          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-md bg-teal-700">
                  <Power className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Sesiones de riego</p>
                  <p className="text-3xl font-extrabold text-slate-900">{totalActivations}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <Timer className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Tiempo registrado</p>
                  <p className="text-3xl font-extrabold text-slate-900">{totalRuntimeLabel}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Table */}
          <Card className="overflow-hidden rounded-3xl border-white/80 shadow-lg shadow-slate-900/5">
            <CardHeader className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Clock className="h-5 w-5 text-teal-600" />
                <span>Registro de Actividad</span>
                <button
                  type="button"
                  onClick={() => setShowFilters((isVisible) => !isVisible)}
                  className={`ml-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${showFilters ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-700'}`}
                  aria-label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                  title={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                >
                  <Filter className="h-4 w-4" />
                </button>
              </CardTitle>
              {showFilters && (
                <div className="grid w-full grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button type="button" onClick={() => setFilter('7days')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === '7days' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Últimos 7 días</button>
                      <button type="button" onClick={() => setFilter('30days')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === '30days' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Últimos 30 días</button>
                      <button type="button" onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Todo el tiempo</button>
                    </div>
                  </div>
                  <label className="text-sm text-gray-600">
                    Desde
                    <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-600">
                    Hasta
                    <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-600">
                    Duración mínima (min)
                    <input type="number" min="0" value={minDuration} onChange={(event) => setMinDuration(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" placeholder="Sin mínimo" />
                  </label>
                  <label className="text-sm text-gray-600">
                    Duración máxima (min)
                    <input type="number" min="0" value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" placeholder="Sin máximo" />
                  </label>
                  <Button type="button" variant="outline" className="self-end" onClick={clearFilters}>Limpiar filtros</Button>
                </div>
              )}
            </CardHeader>
            {error && (
              <div role="alert" className="mx-6 mt-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0" /> {error}
              </div>
            )}
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <Sprout className="mx-auto mb-3 h-12 w-12 text-teal-300" />
                  <p className="font-semibold text-slate-700">No se encontraron sesiones de riego</p>
                  <p className="mt-1 text-sm text-slate-500">Prueba otro periodo o activa el sistema para crear registros.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="font-semibold text-slate-800">Inicio</TableHead>
                        <TableHead className="font-semibold text-slate-800">Finalización</TableHead>
                        <TableHead className="font-semibold text-slate-800">Estado</TableHead>
                        <TableHead className="font-semibold text-slate-800">Duración</TableHead>
                        <TableHead className="font-semibold text-slate-800">Origen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id} className="transition-colors hover:bg-teal-50/40">
                          <TableCell className="font-medium text-gray-700">
                            {log.activationDate.toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell className="font-medium text-gray-700">
                            {log.closingDate ? log.closingDate.toLocaleString('es-ES') : 'En curso'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.status === 'ON' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {log.status === 'ON' ? 'Activo' : 'Cerrado'}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {log.durationStr}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {log.source === 'AUTOMATIC' ? 'Automático' : log.source === 'MANUAL' ? 'Manual' : 'Registro'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Mostrando {(page - 1) * itemsPerPage + 1} a {Math.min(page * itemsPerPage, logs.length)} de {logs.length} registros
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default IrrigationHistoryPage;
