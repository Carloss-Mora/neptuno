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

    if (waterLevel < 20) return { state: 'OFF', reason: 'low_water' };
    if (Number.isFinite(manualOverrideUntilMs) && nowMs < manualOverrideUntilMs) {
      return { state: current, reason: 'manual_override' };
    }

    if (current === 'ON') {
      if (Number.isFinite(activeSinceMs) && nowMs - activeSinceMs >= maxContinuousMs) {
        return { state: 'OFF', reason: 'maximum_runtime' };
      }
      if (humidity >= humidityMax) return { state: 'OFF', reason: 'humidity_recovered' };
      return { state: 'ON', reason: 'hysteresis_hold' };
    }

    if (Number.isFinite(lastStoppedAtMs) && nowMs - lastStoppedAtMs < minRestMs) {
      return { state: 'OFF', reason: 'minimum_rest' };
    }
    if (humidity < humidityMin) return { state: 'ON', reason: 'humidity_low' };
    return { state: 'OFF', reason: 'humidity_sufficient' };
  },
};
