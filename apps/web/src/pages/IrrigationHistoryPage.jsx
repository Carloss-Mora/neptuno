
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Clock, Power, Filter } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { formatDistanceStrict, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

const IrrigationHistoryPage = () => {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // '7days', '30days', 'all'
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let filterStr = `userId = "${currentUser.id}"`;
      
      if (filter === '7days') {
        const date = subDays(new Date(), 7).toISOString();
        filterStr += ` && created >= "${date}"`;
      } else if (filter === '30days') {
        const date = subDays(new Date(), 30).toISOString();
        filterStr += ` && created >= "${date}"`;
      }

      // Fetch all matching logs to calculate durations properly
      const records = await pb.collection('irrigation_logs').getFullList({
        filter: filterStr,
        sort: '-created',
        $autoCancel: false,
      });

      // Process records to calculate duration
      const processedLogs = [];
      let lastOffTime = null;

      // Since we sorted by -created (newest first), we iterate backwards in time
      for (let i = 0; i < records.length; i++) {
        const current = records[i];
        let duration = null;

        if (current.status === 'OFF') {
          lastOffTime = new Date(current.created);
          duration = 'N/A';
        } else if (current.status === 'ON') {
          if (lastOffTime) {
            const onTime = new Date(current.created);
            duration = formatDistanceStrict(lastOffTime, onTime, { locale: es });
            lastOffTime = null; // Reset after pairing
          } else {
            duration = 'En curso...';
          }
        }

        processedLogs.push({
          ...current,
          durationStr: duration
        });
      }

      setLogs(processedLogs);
      setPage(1);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching irrigation logs:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser, filter]);

  const totalActivations = logs.filter(l => l.status === 'ON').length;
  
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

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Historial de Riego</h1>
            <p className="text-lg text-gray-600">Registro de actividad del sistema de riego</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="rounded-xl shadow-md border-gray-100">
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                  <Power className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Activaciones</p>
                  <p className="text-3xl font-bold text-gray-900">{totalActivations}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-md border-gray-100">
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Registros Totales</p>
                  <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Table */}
          <Card className="rounded-xl shadow-lg border-gray-100">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <CardTitle className="text-xl flex items-center space-x-2">
                <Clock className="w-5 h-5 text-teal-600" />
                <span>Registro de Actividad</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setFilter('7days')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === '7days' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    onClick={() => setFilter('30days')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === '30days' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Últimos 30 días
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todo el tiempo
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No se encontraron registros de riego</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="font-semibold text-gray-900">Fecha / Hora</TableHead>
                        <TableHead className="font-semibold text-gray-900">Estado</TableHead>
                        <TableHead className="font-semibold text-gray-900">Duración</TableHead>
                        <TableHead className="font-semibold text-gray-900">Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-medium text-gray-700">
                            {new Date(log.created).toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.status === 'ON' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {log.status === 'ON' ? 'Activado' : 'Desactivado'}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {log.durationStr}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {currentUser.name || currentUser.email}
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
      </div>
    </>
  );
};

export default IrrigationHistoryPage;
