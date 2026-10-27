/// <reference path="../pb_data/types.d.ts" />

// Límites de los sensores individuales de un cultivo (los handlers son aislados: sin helpers de archivo).
onRecordCreateRequest((e) => {
  const cropId = String(e.record.get('cropId'));
  const existing = $app.findRecordsByFilter('sensors', 'cropId = {:cropId}', '', 50, 0, { cropId });
  if (existing.length >= 12) {
    throw new BadRequestError('Un cultivo admite como máximo 12 sensores.');
  }
  const crop = $app.findRecordById('crops', cropId);
  const rows = Number(crop.get('layout_rows')) || 2;
  const cols = Number(crop.get('layout_cols')) || 2;
  const row = Number(e.record.get('grid_row'));
  const col = Number(e.record.get('grid_col'));
  if (row >= rows || col >= cols) {
    throw new BadRequestError('La posición del sensor queda fuera del plano del cultivo.');
  }
  e.next();
}, 'sensors');
