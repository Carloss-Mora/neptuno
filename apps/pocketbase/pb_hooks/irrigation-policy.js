module.exports = {
  decide({
    humidity,
    humidityMin,
    humidityMax,
    waterLevel,
    currentState,
    nowMs,
    activeSinceMs,
    lastStoppedAtMs,
    maxContinuousMs,
    minRestMs,
    manualOverrideUntilMs,
    pulseOnMs,
    pulseOffMs,
    inPulseCycle,
    cycleOnMs,
  }) {
    const current = currentState === 'ON' ? 'ON' : 'OFF';
    if (
      !Number.isFinite(humidity)
      || !Number.isFinite(humidityMin)
      || !Number.isFinite(humidityMax)
      || humidityMin >= humidityMax
      || !Number.isFinite(waterLevel)
      || !Number.isFinite(nowMs)
      || !Number.isFinite(maxContinuousMs)
      || maxContinuousMs <= 0
      || !Number.isFinite(minRestMs)
      || minRestMs < 0
    ) {
      return { state: 'OFF', reason: 'configuration_missing' };
    }

    const pulses = Number(pulseOnMs) > 0 && Number(pulseOffMs) > 0;
    const cycleOn = Number.isFinite(cycleOnMs) && cycleOnMs > 0 ? cycleOnMs : 0;

    if (waterLevel < 20) return { state: 'OFF', reason: 'low_water' };
    // El máximo cuenta el tiempo regado de todo el ciclo (varios pulsos), no solo el pulso actual.
    if (current === 'ON' && Number.isFinite(activeSinceMs) && cycleOn + (nowMs - activeSinceMs) >= maxContinuousMs) {
      return { state: 'OFF', reason: 'maximum_runtime' };
    }
    if (Number.isFinite(manualOverrideUntilMs) && nowMs < manualOverrideUntilMs) {
      return { state: current, reason: 'manual_override' };
    }

    if (current === 'ON') {
      if (humidity >= humidityMax) return { state: 'OFF', reason: 'humidity_recovered' };
      if (pulses && Number.isFinite(activeSinceMs) && nowMs - activeSinceMs >= Number(pulseOnMs)) {
        return { state: 'OFF', reason: 'pulse_pause', pulse: 'pause' };
      }
      return { state: 'ON', reason: 'hysteresis_hold' };
    }

    // Ciclo de pulsos en curso: pausa, y luego otro pulso hasta llegar a la humedad máxima o al límite total.
    if (pulses && inPulseCycle) {
      if (cycleOn >= maxContinuousMs) return { state: 'OFF', reason: 'maximum_runtime', endCycle: true };
      if (humidity >= humidityMax) return { state: 'OFF', reason: 'humidity_recovered', endCycle: true };
      if (Number.isFinite(lastStoppedAtMs) && nowMs - lastStoppedAtMs < Number(pulseOffMs)) {
        return { state: 'OFF', reason: 'pulse_pause' };
      }
      return { state: 'ON', reason: 'pulse_resume', pulse: 'resume' };
    }

    if (Number.isFinite(lastStoppedAtMs) && nowMs - lastStoppedAtMs < minRestMs) {
      return { state: 'OFF', reason: 'minimum_rest' };
    }
    if (humidity < humidityMin) return { state: 'ON', reason: 'humidity_low' };
    return { state: 'OFF', reason: 'humidity_sufficient' };
  },

  // Reconstruye el ciclo de pulsos desde los últimos registros (el más nuevo primero):
  // [{ status: 'ON'|'OFF', source, createdMs }]. Los pulsos usan la fuente 'PULSE' al pausar y reanudar.
  cycleFromLogs(logs) {
    const none = { inPulseCycle: false, cycleOnMs: 0 };
    if (!Array.isArray(logs) || logs.length === 0) return none;
    const first = logs[0];
    if (first.source !== 'PULSE') return none;
    let index = first.status === 'ON' ? 1 : 0;
    const inPulseCycle = first.status === 'OFF';
    let cycleOnMs = 0;
    while (index + 1 < logs.length + 1) {
      const off = logs[index];
      const on = logs[index + 1];
      if (!off || !on || off.status !== 'OFF' || off.source !== 'PULSE' || on.status !== 'ON') break;
      cycleOnMs += Math.max(0, off.createdMs - on.createdMs);
      index += 2;
      if (on.source !== 'PULSE') break;
    }
    return { inPulseCycle, cycleOnMs };
  },
};
