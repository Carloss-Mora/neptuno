import { formatDateTime, formatTemperature, formatVolume, tempFromCelsius, tempUnitLabel, volumeFromLiters, volumeUnitLabel } from '@/utils/units';
import { SENSOR_KINDS } from '@/utils/sensorStatus';
import { dateKey } from '@/utils/reportData';

const COBALT = [28, 81, 149];
const INK = [23, 52, 93];
const PALE = [226, 239, 251];
const AQUA = [34, 160, 185];

const SOURCE_LABELS = { MANUAL: 'Manual', AUTOMATIC: 'Programado', THRESHOLD: 'Automático por humedad' };
const sourceLabel = (source) => SOURCE_LABELS[source] || source || '';

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

export const formatMinutes = (minutes) => {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, '0')} min`;
};

// La fuente estándar del PDF no incluye la raya larga ni los espacios especiales.
const pdfText = (value) => String(value ?? '').replace(/—/g, '-').replace(/[  ]/g, ' ');

const slug = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'cultivo';
export const reportFileName = (report, extension) => `neptuno-informe-${slug(report.cropName)}-${dateKey(report.from)}_${dateKey(report.to)}.${extension}`;

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const periodLabel = (report) => `${dateKey(report.from)} al ${dateKey(report.to)} (${report.days} ${report.days === 1 ? 'día' : 'días'})`;

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------
export const createPdf = async (report, preferences = {}) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { unit_volume: volumeUnit = 'L', unit_temp: tempUnit = 'C', timezone = '' } = preferences;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = width - margin * 2;
  const hasFlow = report.flowLpm !== null;

  doc.setFillColor(...COBALT);
  doc.rect(0, 0, width, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Informe de riego', margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(pdfText(`${report.cropName}  |  ${periodLabel(report)}`), margin, 60);

  // Indicadores
  const kpis = [
    ['Consumo estimado', hasFlow ? formatVolume(report.totals.liters, volumeUnit) : 'Sin caudal'],
    ['Riegos', String(report.totals.sessions)],
    ['Tiempo de riego', formatMinutes(report.totals.minutes)],
    ['Promedio por día', hasFlow ? formatVolume(report.totals.averageLitersPerDay, volumeUnit) : formatMinutes(report.totals.minutes / Math.max(1, report.days))],
    ...(report.savings ? [[report.savings.savedLiters >= 0 ? 'Agua ahorrada' : 'Sobre el riego fijo', `${formatVolume(Math.abs(report.savings.savedLiters), volumeUnit)} (${Math.abs(report.savings.savedPercent).toFixed(0)} %)`]] : []),
  ];
  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + boxGap);
    doc.setFillColor(...PALE);
    doc.roundedRect(x, 104, boxWidth, 56, 6, 6, 'F');
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(pdfText(label), x + 10, 121);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(kpis.length > 4 ? 11 : 14);
    doc.text(pdfText(value), x + 10, 143);
  });

  // Gráfica de barras: consumo (o minutos de riego si no hay caudal) por día
  const chartTop = 196;
  const chartHeight = 140;
  const chartLeft = margin + 38;
  const chartWidth = contentWidth - 38;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(hasFlow ? `Consumo de agua por día (${volumeUnitLabel(volumeUnit)})` : 'Minutos de riego por día', margin, chartTop - 12);
  const series = report.daily.map((row) => (hasFlow ? volumeFromLiters(row.liters, volumeUnit) : row.minutes));
  const maximum = Math.max(...series, 0);
  const top = maximum > 0 ? maximum * 1.1 : 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setDrawColor(210, 222, 238);
  doc.setLineWidth(0.5);
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = chartTop + chartHeight - (chartHeight * tick) / 4;
    doc.line(chartLeft, y, chartLeft + chartWidth, y);
    doc.setTextColor(95, 112, 140);
    doc.text(pdfText(round((top * tick) / 4, top >= 10 ? 0 : 1).toLocaleString('es-CO')), chartLeft - 6, y + 2.5, { align: 'right' });
  }
  const slot = chartWidth / Math.max(1, series.length);
  const barWidth = Math.max(1, Math.min(22, slot * 0.7));
  doc.setFillColor(...COBALT);
  series.forEach((value, index) => {
    if (value <= 0) return;
    const barHeight = (value / top) * chartHeight;
    doc.rect(chartLeft + index * slot + (slot - barWidth) / 2, chartTop + chartHeight - barHeight, barWidth, barHeight, 'F');
  });
  doc.setTextColor(95, 112, 140);
  const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  labelIndexes.forEach((index) => {
    const row = report.daily[index];
    if (!row) return;
    const [, month, day] = row.date.split('-');
    doc.text(`${day}/${month}`, chartLeft + index * slot + slot / 2, chartTop + chartHeight + 12, { align: 'center' });
  });
  if (maximum === 0) {
    doc.setFontSize(10);
    doc.text('No hay riegos registrados en este periodo.', chartLeft + chartWidth / 2, chartTop + chartHeight / 2, { align: 'center' });
  }

  let cursor = chartTop + chartHeight + 34;
  doc.setFontSize(8);
  doc.setTextColor(95, 112, 140);
  doc.text(
    pdfText(hasFlow
      ? `Consumo estimado = caudal configurado (${round(volumeFromLiters(report.flowLpm, volumeUnit), 2)} ${volumeUnitLabel(volumeUnit)}/min) x minutos reales de riego.`
      : 'El consumo en litros requiere configurar el caudal del cultivo (L/min).'),
    margin,
    cursor,
  );
  cursor += 18;

  const tableStyle = {
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 4 },
    headStyles: { fillColor: COBALT, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 249, 254] },
  };
  const title = (text) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(pdfText(text), margin, cursor);
    cursor += 8;
  };

  title('Lecturas de sensores en el periodo');
  autoTable(doc, {
    ...tableStyle,
    startY: cursor,
    head: [['Medida', 'Promedio', 'Mínimo horario', 'Máximo horario', 'Muestras']],
    body: report.sensorSummary.map((metric) => {
      const isTemp = metric.key === 'temperature';
      const show = (value) => (value === null ? '-' : isTemp ? formatTemperature(value, tempUnit) : `${round(value, 1)} %`);
      return [metric.label, show(metric.average), show(metric.minimum), show(metric.maximum), String(metric.samples)];
    }),
  });
  cursor = doc.lastAutoTable.finalY + 24;

  title('Estado de los sensores');
  autoTable(doc, {
    ...tableStyle,
    startY: cursor,
    head: [['Sensor', 'Tipo', 'Posición', 'Última lectura', 'Estado']],
    body: report.sensors.length === 0
      ? [['Aún no hay sensores registrados', '', '', '', '']]
      : report.sensors.map((sensor) => [
        sensor.name,
        SENSOR_KINDS[sensor.kind]?.short || sensor.kind,
        `Fila ${sensor.row}, col. ${sensor.col}`,
        sensor.lastValue === null
          ? '-'
          : `${sensor.kind === 'temperature' ? formatTemperature(sensor.lastValue, tempUnit) : `${round(sensor.lastValue, 1)} %`} (${formatDateTime(sensor.lastReadingAt, timezone)})`,
        sensor.status.label,
      ]),
  });
  cursor = doc.lastAutoTable.finalY + 24;

  const activeDays = report.daily.filter((row) => row.minutes > 0);
  title(`Detalle por día${activeDays.length > 0 ? '' : ' (sin riegos)'}`);
  autoTable(doc, {
    ...tableStyle,
    startY: cursor,
    head: [['Fecha', 'Riegos', 'Tiempo de riego', hasFlow ? `Consumo (${volumeUnitLabel(volumeUnit)})` : 'Consumo']],
    body: activeDays.length === 0
      ? [['Sin riegos en el periodo', '', '', '']]
      : activeDays.map((row) => [row.date, String(row.sessions), formatMinutes(row.minutes), hasFlow ? String(round(volumeFromLiters(row.liters, volumeUnit), 1)) : '-']),
    foot: activeDays.length === 0 ? undefined : [['Total', String(report.totals.sessions), formatMinutes(report.totals.minutes), hasFlow ? String(round(volumeFromLiters(report.totals.liters, volumeUnit), 1)) : '-']],
    footStyles: { fillColor: PALE, textColor: INK, fontStyle: 'bold' },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(95, 112, 140);
    const height = doc.internal.pageSize.getHeight();
    doc.text(pdfText(`Neptuno  |  Generado el ${formatDateTime(report.generatedAt, timezone)}`), margin, height - 22);
    doc.text(`Página ${page} de ${pages}`, width - margin, height - 22, { align: 'right' });
  }
  return doc;
};

export const downloadPdf = async (report, preferences) => {
  const doc = await createPdf(report, preferences);
  saveBlob(doc.output('blob'), reportFileName(report, 'pdf'));
};

// ---------------------------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------------------------
export const createWorkbook = async (report, preferences = {}) => {
  const ExcelJS = (await import('exceljs')).default;
  const { unit_volume: volumeUnit = 'L', unit_temp: tempUnit = 'C', timezone = '' } = preferences;
  const volumeLabel = volumeUnitLabel(volumeUnit);
  const tempLabel = tempUnitLabel(tempUnit);
  const hasFlow = report.flowLpm !== null;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Neptuno';
  workbook.created = report.generatedAt;

  const styleHeader = (sheet) => {
    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C5195' } };
    row.alignment = { vertical: 'middle' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const summary = workbook.addWorksheet('Resumen');
  summary.columns = [{ header: 'Concepto', key: 'k', width: 34 }, { header: 'Valor', key: 'v', width: 40 }];
  [
    ['Cultivo', report.cropName],
    ['Periodo', periodLabel(report)],
    ['Generado', formatDateTime(report.generatedAt, timezone)],
    ['Caudal configurado', hasFlow ? `${round(volumeFromLiters(report.flowLpm, volumeUnit), 2)} ${volumeLabel}/min` : 'Sin configurar'],
    ['Área del cultivo', report.areaM2 ? `${report.areaM2} m²` : 'Sin configurar'],
    ['Riegos en el periodo', report.totals.sessions],
    ['Tiempo total de riego (min)', round(report.totals.minutes, 1)],
    [`Consumo estimado (${volumeLabel})`, hasFlow ? round(volumeFromLiters(report.totals.liters, volumeUnit)) : 'Requiere caudal'],
    [`Promedio diario (${volumeLabel})`, hasFlow ? round(volumeFromLiters(report.totals.averageLitersPerDay, volumeUnit)) : 'Requiere caudal'],
    ['Duración promedio por riego (min)', report.totals.averageMinutesPerSession === null ? '-' : round(report.totals.averageMinutesPerSession, 1)],
    ['Día de mayor riego', report.totals.peakDay ? `${report.totals.peakDay.date} (${formatMinutes(report.totals.peakDay.minutes)})` : '-'],
    ...(report.savings ? [
      [`Riego fijo de referencia (${volumeLabel})`, round(volumeFromLiters(report.savings.referenceLiters, volumeUnit))],
      [`Agua ahorrada (${volumeLabel})`, round(volumeFromLiters(report.savings.savedLiters, volumeUnit))],
      ['Ahorro (%)', round(report.savings.savedPercent, 1)],
    ] : []),
    ['Nota', 'El consumo es una estimación: caudal configurado x minutos reales de riego.'],
  ].forEach((row) => summary.addRow({ k: row[0], v: row[1] }));
  styleHeader(summary);

  const daily = workbook.addWorksheet('Consumo diario');
  daily.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Riegos', key: 'sessions', width: 10 },
    { header: 'Minutos de riego', key: 'minutes', width: 18 },
    { header: `Consumo (${volumeLabel})`, key: 'volume', width: 18 },
  ];
  report.daily.forEach((row) => daily.addRow({
    date: row.date,
    sessions: row.sessions,
    minutes: round(row.minutes, 1),
    volume: hasFlow ? round(volumeFromLiters(row.liters, volumeUnit)) : null,
  }));
  const last = report.daily.length + 1;
  const totalRow = daily.addRow({ date: 'Total' });
  totalRow.getCell(2).value = { formula: `SUM(B2:B${last})`, result: report.totals.sessions };
  totalRow.getCell(3).value = { formula: `SUM(C2:C${last})`, result: round(report.totals.minutes, 1) };
  totalRow.getCell(4).value = { formula: `SUM(D2:D${last})`, result: hasFlow ? round(volumeFromLiters(report.totals.liters, volumeUnit)) : 0 };
  totalRow.font = { bold: true };
  styleHeader(daily);

  const sessions = workbook.addWorksheet('Riegos');
  const hasZones = report.sessions.some((row) => row.zone);
  sessions.columns = [
    ...(hasZones ? [{ header: 'Zona', key: 'zone', width: 18 }] : []),
    { header: 'Inicio', key: 'start', width: 20 },
    { header: 'Fin', key: 'end', width: 20 },
    { header: 'Minutos', key: 'minutes', width: 12 },
    { header: `Consumo (${volumeLabel})`, key: 'volume', width: 16 },
    { header: 'Origen', key: 'source', width: 24 },
  ];
  report.sessions.forEach((row) => sessions.addRow({
    zone: row.zone || '',
    start: formatDateTime(row.start, timezone),
    end: row.end ? formatDateTime(row.end, timezone) : 'En curso',
    minutes: round(row.minutes, 1),
    volume: hasFlow ? round(volumeFromLiters(row.liters, volumeUnit)) : null,
    source: sourceLabel(row.source),
  }));
  styleHeader(sessions);

  const readings = workbook.addWorksheet('Lecturas por hora');
  readings.columns = [
    { header: 'Hora', key: 'hour', width: 20 },
    { header: 'Humedad del suelo (%)', key: 'humidity', width: 22 },
    { header: `Temperatura (${tempLabel})`, key: 'temperature', width: 20 },
    { header: 'Nivel de agua (%)', key: 'water', width: 18 },
    { header: 'Muestras', key: 'samples', width: 10 },
  ];
  report.hours.forEach((row) => readings.addRow({
    hour: formatDateTime(row.hour, timezone),
    humidity: round(Number(row.humidity), 1),
    temperature: round(tempFromCelsius(Number(row.temperature), tempUnit), 1),
    water: round(Number(row.water_level), 1),
    samples: Number(row.samples) || 1,
  }));
  styleHeader(readings);

  const sensors = workbook.addWorksheet('Sensores');
  sensors.columns = [
    { header: 'Sensor', key: 'name', width: 26 },
    { header: 'Tipo', key: 'kind', width: 20 },
    { header: 'Fila', key: 'row', width: 8 },
    { header: 'Columna', key: 'col', width: 10 },
    { header: 'Última lectura', key: 'value', width: 16 },
    { header: 'Fecha de la lectura', key: 'at', width: 20 },
    { header: 'Estado', key: 'status', width: 14 },
  ];
  report.sensors.forEach((sensor) => sensors.addRow({
    name: sensor.name,
    kind: SENSOR_KINDS[sensor.kind]?.label || sensor.kind,
    row: sensor.row,
    col: sensor.col,
    value: sensor.lastValue === null ? '-' : sensor.kind === 'temperature' ? `${round(tempFromCelsius(sensor.lastValue, tempUnit), 1)} ${tempLabel}` : `${round(sensor.lastValue, 1)} %`,
    at: sensor.lastReadingAt ? formatDateTime(sensor.lastReadingAt, timezone) : '-',
    status: sensor.status.label,
  }));
  styleHeader(sensors);
  return workbook;
};

export const downloadExcel = async (report, preferences) => {
  const workbook = await createWorkbook(report, preferences);
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    reportFileName(report, 'xlsx'),
  );
};
