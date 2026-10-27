import { useCallback, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

// Caudal efectivo de cada zona: el suyo, o el del cultivo repartido en partes iguales.
export const zoneFlowMap = (zones, crop) => {
  const map = new Map();
  const cropFlow = Number(crop?.flow_lpm) > 0 ? Number(crop.flow_lpm) : null;
  zones.forEach((zone) => {
    const own = Number(zone.flow_lpm);
    if (own > 0) map.set(zone.id, own);
    else if (cropFlow && zones.length > 0) map.set(zone.id, cropFlow / zones.length);
    else map.set(zone.id, null);
  });
  return map;
};

export const zoneFlowTotal = (flows) => (flows instanceof Map ? [...flows.values()].reduce((total, value) => total + (Number(value) || 0), 0) : 0);

// Zonas del cultivo seleccionado (vacío si no usa zonas o si no se pueden cargar).
export function useZones(crop) {
  const cropId = crop?.id || '';
  const [zones, setZones] = useState([]);

  const reload = useCallback(async () => {
    if (!cropId) {
      setZones([]);
      return [];
    }
    try {
      const records = await pb.collection('zones').getFullList({ filter: `cropId = "${cropId}"`, sort: 'valve_channel', $autoCancel: false });
      setZones(Array.isArray(records) ? records : []);
      return records;
    } catch (error) {
      console.error('Could not load zones:', error);
      setZones([]);
      return [];
    }
  }, [cropId]);

  useEffect(() => { reload(); }, [reload]);

  const flows = useMemo(() => zoneFlowMap(zones, crop), [zones, crop]);
  return { zones, flows, reload };
}
