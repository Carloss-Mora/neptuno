import { describe, it, expect } from 'vitest';
import { formatDateTime, formatTemperature, formatVolume, volumeFromLiters } from '@/utils/units';
import { formatAge, layoutOf, sensorStatus, staleAfterMs } from '@/utils/sensorStatus';
import { buildReport, dailyBreakdown, sensorSummary } from '@/utils/reportData';
import { createPdf, createWorkbook, formatMinutes, reportFileName } from '@/utils/reportExport';

const local = (...parts) => new Date(...parts);
const log = (id, status, created, extra = {}) => ({ id, status, created: created.toISOString(), source: 'MANUAL', ...extra });

describe('unidades', () => {
  it('convierte litros a galones y °C a °F', () => {
    expect(volumeFromLiters(3.785411784, 'gal')).toBeCloseTo(1, 6);
    expect(formatVolume(100, 'L')).toBe('100 L');
    expect(formatVolume(37.85411784, 'gal')).toBe('10 gal');
    expect(formatTemperature(25, 'F')).toBe('77 °F');
    expect(formatTemperature(25, 'C')).toBe('25 °C');
    expect(formatVolume(Number.NaN, 'L')).toBe('—');
  });

  it('formatea fechas en la zona horaria elegida y sin espacios especiales', () => {
    const text = formatDateTime(new Date('2026-10-27T03:00:00Z'), 'America/Bogota');
    expect(text).toMatch(/22\/10\/26|26\/10\/26|26\/10\/2026/);
    expect(text).not.toMatch(/[  ]/);
    expect(formatDateTime('basura', 'America/Bogota')).toBe('—');
  });
});

describe('estado de sensores', () => {
  const now = Date.now();
  const crop = { humidity_min: 30, alert_water_min: 20, alert_temp_max: 35 };
  const read = (kind, value, ageMs = 5000) => ({ kind, last_value: value, last_reading_at: new Date(now - ageMs).toISOString() });

  it('distingue normal, alerta, sin señal y sin lecturas', () => {
    expect(sensorStatus({ kind: 'soil_humidity' }, crop, 15, now).state).toBe('never');
    expect(sensorStatus(read('soil_humidity', 45), crop, 15, now).state).toBe('ok');
    expect(sensorStatus(read('soil_humidity', 20), crop, 15, now).state).toBe('alert');
    expect(sensorStatus(read('water_level', 10), crop, 15, now).state).toBe('alert');
    expect(sensorStatus(read('temperature', 40), crop, 15, now).state).toBe('alert');
    expect(sensorStatus(read('temperature', 20), crop, 15, now).state).toBe('ok');
    expect(sensorStatus(read('soil_humidity', 45, 10 * 60000), crop, 15, now).state).toBe('stale');
  });

  it('un umbral sin configurar (0) no genera alertas', () => {
    expect(sensorStatus(read('soil_humidity', 5), { humidity_min: 0 }, 15, now).state).toBe('ok');
  });

  it('calcula el tiempo sin señal y la antigüedad', () => {
    expect(staleAfterMs(15)).toBe(60000);
    expect(staleAfterMs(300)).toBe(900000);
    expect(formatAge(5000)).toBe('5 s');
    expect(formatAge(5 * 60000)).toBe('5 min');
    expect(formatAge(3 * 3600000)).toBe('3 h');
  });

  it('usa un plano de 2x2 por defecto', () => {
    expect(layoutOf({})).toEqual({ rows: 2, cols: 2 });
    expect(layoutOf({ layout_rows: 3, layout_cols: 4 })).toEqual({ rows: 3, cols: 4 });
  });
});

describe('datos del reporte', () => {
  const from = local(2026, 9, 20);
  const to = local(2026, 9, 22, 23, 59, 59);
  const now = local(2026, 9, 23);
  const logs = [
    log('1', 'ON', local(2026, 9, 20, 8, 0)),
    log('2', 'OFF', local(2026, 9, 20, 8, 30)),
    log('3', 'ON', local(2026, 9, 21, 23, 30)),
    log('4', 'OFF', local(2026, 9, 22, 0, 30)),
    log('5', 'ON', local(2026, 9, 21, 10, 0), { is_demo: true }),
    log('6', 'OFF', local(2026, 9, 21, 11, 0), { is_demo: true }),
  ];

  it('reparte las sesiones por día y calcula litros con el caudal', () => {
    const report = buildReport({ crop: { name: 'Lote', flow_lpm: 10 }, logs, from, to, now });
    expect(report.days).toBe(3);
    expect(report.totals.sessions).toBe(2);
    expect(report.daily.map((row) => Math.round(row.minutes))).toEqual([30, 30, 30]);
    expect(report.totals.liters).toBeCloseTo(900, 5);
    expect(report.totals.averageLitersPerDay).toBeCloseTo(300, 5);
    expect(report.totals.averageMinutesPerSession).toBeCloseTo(45, 5);
    expect(report.sessions).toHaveLength(2);
  });

  it('ignora lo simulado y no inventa litros sin caudal', () => {
    const report = buildReport({ crop: { name: 'Lote' }, logs, from, to, now });
    expect(report.totals.liters).toBeNull();
    expect(report.daily[0].liters).toBeNull();
    expect(report.totals.minutes).toBeCloseTo(90, 5);
  });

  it('un periodo sin riegos devuelve ceros', () => {
    const rows = dailyBreakdown([], from, to, 10);
    expect(rows.every((row) => row.minutes === 0 && row.liters === 0)).toBe(true);
  });

  it('resume lecturas ponderando por muestras', () => {
    const [humidity, temperature] = sensorSummary([
      { humidity: 40, temperature: 20, water_level: 80, samples: 1 },
      { humidity: 60, temperature: 30, water_level: 60, samples: 3 },
    ]);
    expect(humidity.average).toBeCloseTo(55, 5);
    expect(humidity.minimum).toBe(40);
    expect(temperature.maximum).toBe(30);
    expect(sensorSummary([])[0].average).toBeNull();
  });
});

describe('exportación', () => {
  const from = local(2026, 9, 20);
  const to = local(2026, 9, 22, 23, 59, 59);
  const now = local(2026, 9, 23);
  const logs = [log('1', 'ON', local(2026, 9, 20, 8, 0)), log('2', 'OFF', local(2026, 9, 20, 8, 30))];
  const sensors = [{ name: 'Humedad norte', kind: 'soil_humidity', grid_row: 0, grid_col: 1, last_value: 41, last_reading_at: now.toISOString() }];
  const hours = [{ hour: '2026-10-20T13:00:00Z', humidity: 42, temperature: 21, water_level: 70, samples: 12 }];
  const report = buildReport({ crop: { name: 'Fresas lote 1', flow_lpm: 10, humidity_min: 30 }, logs, hours, sensors, deviceIntervalSeconds: 15, from, to, now });

  it('genera un PDF válido con contenido', async () => {
    const doc = await createPdf(report, { unit_volume: 'gal', unit_temp: 'F', timezone: 'America/Bogota' });
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(3000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genera un PDF también sin caudal ni sensores', async () => {
    const empty = buildReport({ crop: { name: 'Vacío' }, from, to, now });
    const doc = await createPdf(empty);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('genera un Excel con sus hojas, conversión de unidades y fórmulas de total', async () => {
    const workbook = await createWorkbook(report, { unit_volume: 'gal', unit_temp: 'F' });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Resumen', 'Consumo diario', 'Riegos', 'Lecturas por hora', 'Sensores']);
    const daily = workbook.getWorksheet('Consumo diario');
    expect(daily.getRow(1).getCell(4).value).toBe('Consumo (gal)');
    expect(daily.getRow(2).getCell(4).value).toBeCloseTo(300 / 3.785411784, 1);
    expect(daily.getRow(5).getCell(3).value.formula).toBe('SUM(C2:C4)');
    expect(workbook.getWorksheet('Lecturas por hora').getRow(2).getCell(3).value).toBeCloseTo(69.8, 1);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(String.fromCharCode(...new Uint8Array(buffer).slice(0, 2))).toBe('PK');
  });

  it('nombra los archivos con cultivo y periodo', () => {
    expect(reportFileName(report, 'pdf')).toBe('neptuno-informe-fresas-lote-1-2026-10-20_2026-10-22.pdf');
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(20)).toBe('20 min');
  });
});

describe('ahorro de agua', () => {
  const day = (d) => new Date(`2026-10-${d}T12:00:00`);
  const logs = [
    { id: '1', status: 'ON', source: 'THRESHOLD', created: '2026-10-10T06:00:00', cropId: 'c' },
    { id: '2', status: 'OFF', source: 'THRESHOLD', created: '2026-10-10T06:30:00', cropId: 'c' },
  ];
  const base = { logs, from: new Date('2026-10-10T00:00:00'), to: new Date('2026-10-11T23:59:59'), now: day(12) };
  it('compara con el riego fijo de referencia', () => {
    const report = buildReport({ ...base, crop: { name: 'A', flow_lpm: 10, reference_minutes_per_day: 60 } });
    expect(report.savings.referenceLiters).toBe(60 * 10 * report.days);
    expect(report.savings.savedLiters).toBe(60 * 10 * report.days - 300);
    expect(report.savings.savedPercent).toBeGreaterThan(50);
  });
  it('puede ser negativo y no aparece sin referencia o sin caudal', () => {
    expect(buildReport({ ...base, crop: { name: 'A', flow_lpm: 10, reference_minutes_per_day: 5 } }).savings.savedLiters).toBeLessThan(0);
    expect(buildReport({ ...base, crop: { name: 'A', flow_lpm: 10 } }).savings).toBeNull();
    expect(buildReport({ ...base, crop: { name: 'A', reference_minutes_per_day: 60 } }).savings).toBeNull();
  });
});
