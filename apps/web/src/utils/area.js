export const AREA_UNITS = { m2: { label: 'm²', factor: 1 }, ha: { label: 'ha', factor: 10000 } };

const trim = (n) => String(Number(n.toFixed(6)));

export function toM2(value, unit) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  return n * AREA_UNITS[unit].factor;
}

export function fromM2(m2, unit) {
  const n = Number(m2);
  if (!Number.isFinite(n)) return '';
  return trim(n / AREA_UNITS[unit].factor);
}

export function formatArea(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 10000) return `${(n / 10000).toLocaleString('es-CO', { maximumFractionDigits: 4 })} ha`;
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²`;
}
