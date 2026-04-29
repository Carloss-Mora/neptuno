
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import Header from '@/components/Header';
import SensorCard from '@/components/SensorCard';
import GaugeChart from '@/components/GaugeChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, Thermometer, Waves, Clock, AlertCircle, Bell } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { alerts } = useAlert();
  const [sensorData, setSensorData] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setError('');
      
      // Fetch latest sensor reading
      const readings = await pb.collection('sensor_readings').getList(1, 1, {
        filter: `userId = "${currentUser.id}"`,
        sort: '-created',
        $autoCancel: false,
      });

      if (readings.items.length > 0) {
        setSensorData(readings.items[0]);
      }

      // Fetch user settings for schedule
      const settings = await pb.collection('user_settings').getList(1, 1, {
        filter: `userId = "${currentUser.id}"`,
        $autoCancel: false,
      });

      if (settings.items.length > 0) {
        setScheduleData(settings.items[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos de los sensores. Por favor, inténtalo de nuevo.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const getScheduleTimes = () => {
    if (!scheduleData?.irrigation_schedule_times) return [];
    const times = scheduleData.irrigation_schedule_times.split(',');
    return times.slice(0, 3); // Show next 3 scheduled times
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-6 w-96" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Inicio - Neptuno</title>
        <meta name="description" content="Monitorea tu sistema de riego en tiempo real con datos de sensores y análisis en vivo" />
      </Helmet>

      <Header />

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Panel Principal</h1>
              <p className="text-lg text-gray-600">Monitoreo en tiempo real de tu sistema de riego</p>
            </div>
            {alerts.length > 0 && (
              <div className="flex items-center space-x-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg border border-red-200 shadow-sm">
                <Bell className="w-5 h-5 animate-pulse" />
                <span className="font-medium">{alerts.length} Alerta{alerts.length !== 1 ? 's' : ''} Activa{alerts.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error al Cargar Datos</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Sensor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <SensorCard
              icon={Droplets}
              label="Humedad del Suelo"
              value={sensorData?.soil_humidity?.toFixed(1) || '0'}
              unit="%"
              progress={sensorData?.soil_humidity || 0}
              color="teal"
            />

            <SensorCard
              icon={Waves}
              label="Nivel de Agua"
              value={sensorData?.water_level?.toFixed(1) || '0'}
              unit="%"
              progress={sensorData?.water_level || 0}
              color="blue"
            />

            <Card className="rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-gray-100">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md">
                    <Thermometer className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-4">Temperatura</p>
                <GaugeChart value={sensorData?.temperature || 0} min={0} max={50} unit="°C" />
              </CardContent>
            </Card>
          </div>

          {/* Irrigation Schedule Card */}
          <Card className="rounded-xl shadow-lg border-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Clock className="w-6 h-6 text-teal-600" />
                <span>Horario de Riego</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getScheduleTimes().length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">Próximos horarios programados:</p>
                  {getScheduleTimes().map((time, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-teal-50 rounded-lg border border-teal-100"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{time}</p>
                          <p className="text-sm text-gray-600">Riego diario</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No hay horarios de riego configurados</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Updated */}
          {sensorData && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Última actualización: {new Date(sensorData.created).toLocaleString('es-ES')}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
