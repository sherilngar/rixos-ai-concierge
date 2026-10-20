import { describe, expect, it } from 'vitest';
import { computeEscalation, standardMinutes, timerProgress } from '../../src/domain/escalation';
import { DEFAULT_STANDARDS } from '../../src/domain/departments';

const MIN = 60_000;
const t0 = 1_000_000;

describe('response standards', () => {
  it('uses the brief defaults', () => {
    expect(standardMinutes({ department: 'ird', priority: 'normal' }, DEFAULT_STANDARDS)).toBe(3);
    expect(
      standardMinutes({ department: 'housekeeping', priority: 'normal' }, DEFAULT_STANDARDS),
    ).toBe(5);
    expect(
      standardMinutes({ department: 'engineering', priority: 'normal' }, DEFAULT_STANDARDS),
    ).toBe(5);
    expect(
      standardMinutes({ department: 'engineering', priority: 'urgent' }, DEFAULT_STANDARDS),
    ).toBe(2);
    expect(
      standardMinutes({ department: 'restaurants', priority: 'normal' }, DEFAULT_STANDARDS),
    ).toBe(10);
    expect(standardMinutes({ department: 'spa', priority: 'normal' }, DEFAULT_STANDARDS)).toBe(10);
    expect(
      standardMinutes({ department: 'concierge', priority: 'normal' }, DEFAULT_STANDARDS),
    ).toBe(5);
    expect(
      standardMinutes({ department: 'frontoffice', priority: 'normal' }, DEFAULT_STANDARDS),
    ).toBe(3);
    expect(standardMinutes({ department: 'security', priority: 'urgent' }, DEFAULT_STANDARDS)).toBe(
      1,
    );
  });
});

describe('escalation timing', () => {
  const ticket = {
    department: 'housekeeping' as const,
    priority: 'normal' as const,
    status: 'new' as const,
    createdAt: t0,
  };

  it('stays at level 0 within the standard', () => {
    expect(computeEscalation(ticket, DEFAULT_STANDARDS, t0 + 4 * MIN + 59_000)).toBe(0);
  });
  it('goes to the supervisor at exactly 100%', () => {
    expect(computeEscalation(ticket, DEFAULT_STANDARDS, t0 + 5 * MIN)).toBe(1);
  });
  it('goes to the Rooms Controller at 200%', () => {
    expect(computeEscalation(ticket, DEFAULT_STANDARDS, t0 + 10 * MIN - 1)).toBe(1);
    expect(computeEscalation(ticket, DEFAULT_STANDARDS, t0 + 10 * MIN)).toBe(2);
  });
  it('uses the urgent standard for urgent engineering tickets', () => {
    const urgent = { ...ticket, department: 'engineering' as const, priority: 'urgent' as const };
    expect(computeEscalation(urgent, DEFAULT_STANDARDS, t0 + 2 * MIN)).toBe(1);
    expect(computeEscalation(urgent, DEFAULT_STANDARDS, t0 + 4 * MIN)).toBe(2);
  });
  it('stops escalating once accepted', () => {
    expect(
      computeEscalation({ ...ticket, status: 'accepted' }, DEFAULT_STANDARDS, t0 + 60 * MIN),
    ).toBe(0);
  });
  it('respects edited standards', () => {
    const edited = { ...DEFAULT_STANDARDS, housekeeping: { normal: 2 } };
    expect(computeEscalation(ticket, edited, t0 + 2 * MIN)).toBe(1);
  });
  it('freezes the timer ring at acceptance', () => {
    const p = timerProgress(
      { ...ticket, acceptedAt: t0 + 2.5 * MIN },
      DEFAULT_STANDARDS,
      t0 + 30 * MIN,
    );
    expect(p).toBeCloseTo(0.5);
  });
});
