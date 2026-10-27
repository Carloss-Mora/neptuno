import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import pb from '@/lib/pocketbaseClient';

const MAX_ZONES = 8;
const emptyForm = { name: '', valve_channel: '', flow_lpm: '' };

const describeError = (error) => error?.response?.message || error?.message || 'Ocurrió un error inesperado.';

// Estado ON/OFF de cada zona según su último registro de riego.
export const zoneStates = (logs) => {
  const states = new Map();
  logs.forEach((log) => { if (log.zoneId && !states.has(log.zoneId)) states.set(log.zoneId, log.status === 'ON'); });
  return states;
};

// Zonas de riego del cultivo: cada zona tiene su válvula (canal), su caudal y sus sensores de suelo.
const ZonesCard = ({ crop, userId, zones, reload, sensors }) => {
  const [states, setStates] = useState(new Map());
  const [editing, setEditing] = useState(null); // null | 'new' | zone id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cropId = crop?.id || '';

  const loadStates = useCallback(async () => {
    if (!cropId || zones.length === 0) { setStates(new Map()); return; }
    try {
      const logs = await pb.collection('irrigation_logs').getList(1, 60, { filter: `cropId = "${cropId}" && zoneId != ""`, sort: '-created', $autoCancel: false });
      setStates(zoneStates(logs.items || []));
    } catch (loadError) {
      console.error('Could not load zone states:', loadError);
    }
  }, [cropId, zones.length]);

  useEffect(() => {
    loadStates();
    const refresh = window.setInterval(loadStates, 15000);
    return () => window.clearInterval(refresh);
  }, [loadStates]);

  const usedChannels = new Set(zones.filter((zone) => zone.id !== editing).map((zone) => Number(zone.valve_channel)));
  const nextChannel = () => { for (let channel = 1; channel <= MAX_ZONES; channel += 1) if (!usedChannels.has(channel)) return String(channel); return ''; };

  const startNew = () => { setEditing('new'); setConfirmDelete(false); setError(''); setForm({ name: '', valve_channel: nextChannel(), flow_lpm: '' }); };
  const startEdit = (zone) => {
    setEditing(zone.id); setConfirmDelete(false); setError('');
    setForm({ name: zone.name, valve_channel: String(zone.valve_channel), flow_lpm: Number(zone.flow_lpm) > 0 ? String(zone.flow_lpm) : '' });
  };
  const close = () => { setEditing(null); setConfirmDelete(false); setError(''); };

  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const channel = Number(form.valve_channel);
    if (!name) { setError('Ponle un nombre a la zona, por ejemplo «Lote norte».'); return; }
    if (!Number.isInteger(channel) || channel < 1 || channel > MAX_ZONES) { setError(`El canal de la válvula va de 1 a ${MAX_ZONES}.`); return; }
    if (usedChannels.has(channel)) { setError(`El canal ${channel} ya lo usa otra zona.`); return; }
    const flow = form.flow_lpm === '' ? 0 : Number(form.flow_lpm);
    if (!Number.isFinite(flow) || flow < 0) { setError('El caudal debe ser un número positivo.'); return; }
    setSaving(true);
    setError('');
    try {
      const data = { name, valve_channel: channel, flow_lpm: flow };
      if (editing === 'new') await pb.collection('zones').create({ userId, cropId, ...data }, { $autoCancel: false });
      else await pb.collection('zones').update(editing, data, { $autoCancel: false });
      close();
      await reload();
    } catch (saveError) {
      console.error('Could not save zone:', saveError);
      setError(`No se pudo guardar la zona. ${describeError(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await pb.collection('zones').delete(editing, { $autoCancel: false });
      close();
      await reload();
    } catch (deleteError) {
      setError(`No se pudo eliminar la zona. ${describeError(deleteError)}`);
    } finally {
      setSaving(false);
    }
  };

  const sensorCount = (zoneId) => sensors.filter((sensor) => sensor.zoneId === zoneId).length;

  return (
    <Card className="rounded-3xl border-teal-100">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Zonas de riego</CardTitle>
            <CardDescription>
              {zones.length === 0
                ? 'Divide el cultivo en zonas si cada una tiene su propia válvula. Sin zonas, todo se riega junto.'
                : 'Cada zona se riega según la humedad de sus propios sensores.'}
            </CardDescription>
          </div>
          {editing === null && zones.length < MAX_ZONES && (
            <Button type="button" variant="outline" onClick={startNew}><Plus className="mr-2 h-4 w-4" /> Agregar zona</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {zones.map((zone) => {
              const on = states.get(zone.id) === true;
              return (
                <li key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{zone.name}</p>
                    <p className="text-xs text-slate-500">
                      Válvula {zone.valve_channel}
                      {Number(zone.flow_lpm) > 0 ? ` · ${Number(zone.flow_lpm)} L/min` : ''}
                      {` · ${sensorCount(zone.id)} ${sensorCount(zone.id) === 1 ? 'sensor' : 'sensores'}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{on ? 'Regando' : 'En reposo'}</span>
                    <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${zone.name}`} onClick={() => startEdit(zone)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editing !== null && (
          <form onSubmit={save} className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="zone-name">Nombre de la zona</Label>
                <Input id="zone-name" value={form.name} maxLength={60} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Lote norte" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zone-channel">Canal de la válvula (1-{MAX_ZONES})</Label>
                <Input id="zone-channel" type="number" min="1" max={MAX_ZONES} step="1" value={form.valve_channel} onChange={(event) => setForm((current) => ({ ...current, valve_channel: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zone-flow">Caudal de la zona (L/min)</Label>
                <Input id="zone-flow" type="number" min="0" step="any" value={form.flow_lpm} onChange={(event) => setForm((current) => ({ ...current, flow_lpm: event.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <p className="text-xs text-slate-500">Si no indicas el caudal, se reparte en partes iguales el caudal del cultivo. El canal es la salida del controlador que abre esa válvula. Asigna los sensores de suelo a la zona desde el panel de cada sensor.</p>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving} className="bg-teal-700 hover:bg-teal-800">{saving ? 'Guardando…' : 'Guardar zona'}</Button>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancelar</Button>
              {editing !== 'new' && (confirmDelete ? (
                <>
                  <span className="self-center text-sm text-slate-700">Se borrará la zona y su historial de riego.</span>
                  <Button type="button" onClick={remove} disabled={saving} className="bg-rose-600 text-white hover:bg-rose-700">Sí, eliminar</Button>
                </>
              ) : (
                <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar zona</Button>
              ))}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default ZonesCard;
