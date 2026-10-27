import React, { useCallback, useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbaseClient';
import { zoneStates } from '@/components/ZonesCard';

// Riego manual por zona: abre o cierra la válvula de una sola zona.
const ZoneControls = ({ crop, zones }) => {
  const { toast } = useToast();
  const [states, setStates] = useState(new Map());
  const [busy, setBusy] = useState('');
  const cropId = crop?.id || '';

  const loadStates = useCallback(async () => {
    if (!cropId || zones.length === 0) return;
    try {
      const logs = await pb.collection('irrigation_logs').getList(1, 60, { filter: `cropId = "${cropId}" && zoneId != ""`, sort: '-created', $autoCancel: false });
      setStates(zoneStates(logs.items || []));
    } catch (error) {
      console.error('Could not load zone states:', error);
    }
  }, [cropId, zones.length]);

  useEffect(() => {
    loadStates();
    const refresh = window.setInterval(loadStates, 10000);
    return () => window.clearInterval(refresh);
  }, [loadStates]);

  if (zones.length === 0) return null;

  const toggle = async (zone) => {
    const next = states.get(zone.id) === true ? 'OFF' : 'ON';
    setBusy(zone.id);
    try {
      await pb.send(`/api/neptuno/zones/${zone.id}/irrigation`, { method: 'POST', body: { status: next } });
      setStates((current) => new Map(current).set(zone.id, next === 'ON'));
      toast({ title: next === 'ON' ? `Riego encendido en ${zone.name}` : `Riego apagado en ${zone.name}` });
    } catch (error) {
      console.error('Could not toggle zone:', error);
      toast({ title: 'Error', description: 'No se pudo cambiar el riego de la zona.', variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  return (
    <Card className="rounded-3xl border-teal-100">
      <CardHeader>
        <CardTitle>Riego por zona</CardTitle>
        <CardDescription>Enciende o apaga la válvula de una sola zona.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {zones.map((zone) => {
          const on = states.get(zone.id) === true;
          return (
            <div key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{zone.name}</p>
                <p className={`text-xs font-medium ${on ? 'text-emerald-700' : 'text-slate-500'}`}>{on ? 'Regando' : 'En reposo'}</p>
              </div>
              <Button type="button" variant={on ? 'default' : 'outline'} disabled={busy === zone.id} onClick={() => toggle(zone)} aria-label={`${on ? 'Apagar' : 'Encender'} ${zone.name}`} className={on ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                <Power className="mr-2 h-4 w-4" />{on ? 'Apagar' : 'Encender'}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ZoneControls;
