import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { AREA_UNITS, fromM2, toM2 } from '@/utils/area';

// Campo de área que se escribe en m² o hectáreas; siempre entrega el valor en m² (texto).
export default function AreaInput({ id, valueM2, onChangeM2, placeholder, required }) {
  const [unit, setUnit] = useState('m2');
  const [text, setText] = useState(fromM2(valueM2, 'm2'));

  // Si el valor cambia desde fuera (editar otro cultivo, limpiar), se vuelve a mostrar.
  useEffect(() => {
    const current = toM2(text, unit);
    const incoming = Number(valueM2);
    if (valueM2 === '' || valueM2 == null) {
      if (text !== '') setText('');
    } else if (!Number.isFinite(current) || Math.abs(current - incoming) > 1e-6) {
      setText(fromM2(valueM2, unit));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueM2]);

  const handleText = (event) => {
    const next = event.target.value;
    setText(next);
    const m2 = toM2(next, unit);
    onChangeM2(next === '' || !Number.isFinite(m2) ? '' : String(Number(m2.toFixed(4))));
  };

  const handleUnit = (event) => {
    const nextUnit = event.target.value;
    const m2 = toM2(text, unit);
    setUnit(nextUnit);
    if (Number.isFinite(m2) && text !== '') setText(fromM2(m2, nextUnit));
  };

  return (
    <div className="flex gap-2">
      <Input id={id} type="number" min="0.0001" step="any" inputMode="decimal" value={text} onChange={handleText} placeholder={placeholder} required={required} className="h-10 min-w-0" />
      <select aria-label="Unidad del área" value={unit} onChange={handleUnit} className="h-10 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm">
        {Object.entries(AREA_UNITS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </div>
  );
}
