import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../../pocketbase/pb_hooks/flow-check.js'), 'utf8'), sandbox);
const { check } = sandbox.module.exports;

const now = 10 * 3600000;
const since = (minutesAgo) => now - minutesAgo * 60000;

describe('detección de fugas y obstrucciones', () => {
  it('avisa obstrucción con la válvula abierta y poco caudal', () => {
    expect(check({ measured: 3, expected: 10, valveOn: true, stateSinceMs: since(5), nowMs: now })).toBe('flow_low');
    expect(check({ measured: 8, expected: 10, valveOn: true, stateSinceMs: since(5), nowMs: now })).toBe('');
  });
  it('avisa fuga si pasa agua con la válvula cerrada', () => {
    expect(check({ measured: 2, expected: 10, valveOn: false, stateSinceMs: since(5), nowMs: now })).toBe('flow_leak');
    expect(check({ measured: 0.1, expected: 10, valveOn: false, stateSinceMs: since(5), nowMs: now })).toBe('');
  });
  it('espera 2 minutos tras abrir o cerrar', () => {
    expect(check({ measured: 0, expected: 10, valveOn: true, stateSinceMs: since(1), nowMs: now })).toBe('');
    expect(check({ measured: 5, expected: 10, valveOn: false, stateSinceMs: since(1), nowMs: now })).toBe('');
  });
  it('no hace nada sin caudal medido o sin caudal esperado', () => {
    expect(check({ measured: NaN, expected: 10, valveOn: true, stateSinceMs: since(9), nowMs: now })).toBe('');
    expect(check({ measured: 0, expected: NaN, valveOn: true, stateSinceMs: since(9), nowMs: now })).toBe('');
    expect(check({ measured: 0, expected: 10, valveOn: true, stateSinceMs: NaN, nowMs: now })).toBe('');
  });
});
