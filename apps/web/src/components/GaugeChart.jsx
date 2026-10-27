
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const GaugeChart = ({ value, min = 0, max = 50, unit = '°C' }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  const data = [
    { name: 'value', value: percentage },
    { name: 'remaining', value: 100 - percentage },
  ];

  const COLORS = ['#2468b6', '#e5e7eb'];

  return (
    <div className="relative w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '20%' }}>
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{unit}</p>
        </div>
      </div>
    </div>
  );
};

export default GaugeChart;
