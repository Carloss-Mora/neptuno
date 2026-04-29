
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import ConsumptionChart from '@/components/ConsumptionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const StatisticsPage = () => {
  const { currentUser } = useAuth();
  const [consumptionData, setConsumptionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    current: 0,
    previous: 0,
    change: 0,
  });

  const fetchConsumptionData = async () => {
    try {
      setLoading(true);

      // Fetch last 30 days of consumption data
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');

      const records = await pb.collection('water_consumption').getFullList({
        filter: `userId = "${currentUser.id}" && consumption_date >= "${thirtyDaysAgo}" && consumption_date <= "${today}" && period = "daily"`,
        sort: 'consumption_date',
        $autoCancel: false,
      });

      setConsumptionData(records);
      calculateStats(records);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching consumption data:', err);
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (data.length === 0) {
      setStats({ current: 0, previous: 0, change: 0 });
      return;
    }

    // Calculate current month consumption
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthData = data.filter(
      (item) => new Date(item.consumption_date) >= currentMonthStart
    );
    const currentTotal = currentMonthData.reduce((sum, item) => sum + item.consumption_liters, 0);

    // Calculate previous month consumption
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));
    const previousMonthData = data.filter(
      (item) =>
        new Date(item.consumption_date) >= previousMonthStart &&
        new Date(item.consumption_date) <= previousMonthEnd
    );
    const previousTotal = previousMonthData.reduce((sum, item) => sum + item.consumption_liters, 0);

    const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    setStats({
      current: currentTotal,
      previous: previousTotal,
      change: change,
    });
  };

  useEffect(() => {
    fetchConsumptionData();
  }, [currentUser]);

  const getAverageConsumption = () => {
    if (consumptionData.length === 0) return 0;
    const total = consumptionData.reduce((sum, item) => sum + item.consumption_liters, 0);
    return (total / consumptionData.length).toFixed(1);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-10 w-64 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Estadísticas - Neptuno</title>
        <meta name="description" content="Rastrea tu consumo de agua y analiza los patrones de riego" />
      </Helmet>

      <Header />

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Estadísticas de Consumo de Agua</h1>
            <p className="text-lg text-gray-600">Rastrea y analiza el uso de agua de tu riego</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Current Month */}
            <Card className="rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-gray-100">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                    <Droplets className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Mes Actual</p>
                <p className="text-3xl font-bold text-gray-900">{stats.current.toFixed(1)}</p>
                <p className="text-sm text-gray-500">Litros</p>
              </CardContent>
            </Card>

            {/* Average Daily */}
            <Card className="rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-gray-100">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Promedio Diario</p>
                <p className="text-3xl font-bold text-gray-900">{getAverageConsumption()}</p>
                <p className="text-sm text-gray-500">Litros/día</p>
              </CardContent>
            </Card>

            {/* Monthly Change */}
            <Card className="rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-gray-100">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-md ${
                    stats.change >= 0 
                      ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                      : 'bg-gradient-to-br from-green-500 to-emerald-600'
                  }`}>
                    {stats.change >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-white" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">vs Mes Anterior</p>
                <p className={`text-3xl font-bold ${
                  stats.change >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500">Cambio</p>
              </CardContent>
            </Card>
          </div>

          {/* Consumption Chart */}
          <Card className="rounded-xl shadow-lg border-gray-100">
            <CardHeader>
              <CardTitle className="text-xl">Tendencias de Consumo (Últimos 30 Días)</CardTitle>
            </CardHeader>
            <CardContent>
              {consumptionData.length > 0 ? (
                <ConsumptionChart data={consumptionData} />
              ) : (
                <div className="text-center py-12">
                  <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay datos de consumo disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Comparison */}
          <Card className="rounded-xl shadow-lg border-gray-100 mt-8">
            <CardHeader>
              <CardTitle className="text-xl">Comparación Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-teal-50 rounded-xl p-6 border border-teal-100">
                  <p className="text-sm font-medium text-gray-600 mb-2">Mes Actual</p>
                  <p className="text-4xl font-bold text-teal-700 mb-1">{stats.current.toFixed(1)}</p>
                  <p className="text-sm text-gray-600">Litros consumidos</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">Mes Anterior</p>
                  <p className="text-4xl font-bold text-gray-700 mb-1">{stats.previous.toFixed(1)}</p>
                  <p className="text-sm text-gray-600">Litros consumidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default StatisticsPage;
