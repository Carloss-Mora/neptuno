
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ConsumptionChart = ({ data }) => {
  const chartData = data.map(item => ({
    date: format(new Date(item.consumption_date), 'dd MMM', { locale: es }),
    consumption: item.consumption_liters,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={{ value: 'Litros', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
          formatter={(value) => [`${value} Litros`, 'Consumo']}
        />
        <Line 
          type="monotone" 
          dataKey="consumption" 
          name="Consumo"
          stroke="#2468b6" 
          strokeWidth={3}
          dot={{ fill: '#2468b6', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default ConsumptionChart;
