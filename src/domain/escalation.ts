import type { EscalationLevel, Standards, Ticket } from './types';

/** Response standard in minutes for this ticket's department and priority. */
export function standardMinutes(
  ticket: Pick<Ticket, 'department' | 'priority'>,
  standards: Standards,
): number {
  const s = standards[ticket.department];
  if (ticket.priority === 'urgent' && s.urgent) return s.urgent;
  return s.normal;
}

/**
 * Escalation is driven by time-to-accept: supervisor at 100% of the standard,
 * Rooms Controller at 200%. Once accepted (or closed) a ticket stops escalating.
 */
export function computeEscalation(
  ticket: Pick<Ticket, 'department' | 'priority' | 'status' | 'createdAt'>,
  standards: Standards,
  now: number,
): EscalationLevel {
  if (ticket.status !== 'new') return 0;
  const limit = standardMinutes(ticket, standards) * 60_000;
  const elapsed = now - ticket.createdAt;
  if (elapsed >= limit * 2) return 2;
  if (elapsed >= limit) return 1;
  return 0;
}

/** Fraction of the standard used so far (0..2+), for the response-timer ring. */
export function timerProgress(
  ticket: Pick<Ticket, 'department' | 'priority' | 'createdAt' | 'acceptedAt'>,
  standards: Standards,
  now: number,
): number {
  const limit = standardMinutes(ticket, standards) * 60_000;
  const end = ticket.acceptedAt ?? now;
  return Math.max(0, (end - ticket.createdAt) / limit);
}

export function escalationLabel(level: EscalationLevel): string {
  return level === 2
    ? 'Escalated to Rooms Controller'
    : level === 1
      ? 'Escalated to Supervisor'
      : 'Within standard';
}
