
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const SensorCard = ({ icon: Icon, label, value, unit, progress, color = 'teal' }) => {
  const colorClasses = {
    teal: 'bg-teal-100 text-teal-700',
    blue: 'bg-cyan-100 text-cyan-700',
    green: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <Card className="rounded-3xl border-white/80 bg-white shadow-lg shadow-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
            <p className="text-sm font-medium text-slate-500">{unit}</p>
          </div>
        </div>
        <p className="mb-3 text-sm font-semibold text-slate-600">{label}</p>
        {progress !== undefined && (
          <Progress value={progress} className="h-2" />
        )}
      </CardContent>
    </Card>
  );
};

export default SensorCard;
