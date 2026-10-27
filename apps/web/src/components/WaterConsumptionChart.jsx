import React, { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { volumeFromLiters, volumeUnitLabel } from '@/utils/units';

const COBALT = '#2468b6';
const AQUA = '#22a0b9';

const shortDate = (key) => {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
};

// Barras = consumo de cada día; línea = acumulado del periodo. Sin caudal configurado muestra minutos.
const WaterConsumptionChart = ({ daily, hasFlow, volumeUnit = 'L' }) => {
  const unit = volumeUnitLabel(volumeUnit);
  const data = useMemo(() => {
    let accumulated = 0;
    return daily.map((row) => {
      const value = hasFlow ? volumeFromLiters(row.liters, volumeUnit) : row.minutes;
      accumulated += value;
      return { date: row.date, value: Number(value.toFixed(2)), accumulated: Number(accumulated.toFixed(2)) };
    });
  }, [daily, hasFlow, volumeUnit]);
  const label = hasFlow ? `Consumo del día (${unit})` : 'Minutos de riego del día';
  const hasData = data.some((row) => row.value > 0);

  return (
    <div className="h-72 w-full" role="img" aria-label={hasData ? `Gráfica de ${label.toLowerCase()} y acumulado del periodo` : 'No hay riegos en el periodo'}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe7f5" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke="#6b7a90" fontSize={12} minTickGap={24} />
            <YAxis yAxisId="left" stroke="#6b7a90" fontSize={12} width={44} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" stroke={AQUA} fontSize={12} width={48} allowDecimals={false} />
            <Tooltip
              labelFormatter={shortDate}
              formatter={(value, name) => [`${Number(value).toLocaleString('es-CO')} ${hasFlow ? unit : 'min'}`, name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #dbe7f5' }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="value" name={label} fill={COBALT} radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Line yAxisId="right" type="monotone" dataKey="accumulated" name="Acumulado" stroke={AQUA} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 text-center text-slate-500">
          No hay riegos registrados en este periodo.
        </div>
      )}
    </div>
  );
};

export default WaterConsumptionChart;
