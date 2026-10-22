import {
  estimateDailyConsumption,
  getDisplayedIrrigationStatus,
} from '@/utils/irrigationMetrics';

describe('Irrigation metrics', () => {
  it('keeps an active schedule on when the manual stop is older than its start', () => {
    const scheduleStart = new Date('2026-10-20T10:00:00');
    const activeSchedule = { startDate: scheduleStart };
    const previousManualStop = {
      status: 'OFF',
      source: 'MANUAL',
      created: new Date(scheduleStart.getTime() - 60 * 60 * 1000).toISOString(),
    };

    expect(getDisplayedIrrigationStatus('OFF', previousManualStop, activeSchedule)).toBe('ON');
  });

  it('honors a manual stop made after the active schedule started', () => {
    const scheduleStart = new Date('2026-10-20T10:00:00');
    const manualStop = {
      status: 'OFF',
      source: 'MANUAL',
      created: new Date(scheduleStart.getTime() + 5 * 60 * 1000).toISOString(),
    };

    expect(getDisplayedIrrigationStatus('ON', manualStop, { startDate: scheduleStart })).toBe('OFF');
  });

  it('estimates 0.1 liters per square meter for each irrigation session', () => {
    const sessionStart = new Date(2026, 9, 20, 23, 30);
    const sessionEnd = new Date(2026, 9, 21, 0, 30);
    const dailyConsumption = estimateDailyConsumption(
      [
        { activationDate: sessionStart, closingDate: sessionEnd, durationMs: 60 * 60 * 1000 },
        { activationDate: new Date(2026, 9, 20, 23, 45), closingDate: new Date(2026, 9, 20, 23, 50), durationMs: 5 * 60 * 1000 },
      ],
      sessionStart,
      sessionEnd,
      120,
    );

    expect(dailyConsumption.get('2026-10-20')).toBe(24);
    expect(dailyConsumption.get('2026-10-21')).toBe(0);
  });
});
