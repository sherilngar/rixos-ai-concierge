import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Footprints, MessageSquarePlus, Repeat2, ShieldAlert, Sparkles } from 'lucide-react';
import { DEPARTMENTS, DEPT_BY_ID } from '../../domain/departments';
import { standardMinutes, timerProgress } from '../../domain/escalation';
import type { DepartmentId, StaffSession, Ticket } from '../../domain/types';
import { addNote, reassignTicket, setTicketStatus, useStore } from '../../store/store';
import { StatusPill } from '../ui/Status';
import { TimerRing } from '../ui/TimerRing';
import { ago, mmss } from './hooks';

const PRIORITY: Record<Ticket['priority'], string> = {
  normal: 'border-line text-muted',
  high: 'border-st-progress/50 text-st-progress',
  urgent: 'border-st-escalated/60 bg-st-escalated/10 text-st-escalated',
};

export function TicketCard({
  ticket: t,
  now,
  session,
  fresh,
  compact = false,
  onOpen,
}: {
  ticket: Ticket;
  now: number;
  session: StaffSession;
  fresh: boolean;
  compact?: boolean;
  onOpen: () => void;
}) {
  const standards = useStore((s) => s.settings.standards);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [reassign, setReassign] = useState(false);
  const progress = timerProgress(t, standards, now);
  const elapsed = (t.acceptedAt ?? now) - t.createdAt;
  const escalated = t.status === 'new' && t.escalationLevel > 0;
  const closed = t.status === 'done' || t.status === 'cancelled';
  const by = session.name;
  const std = standardMinutes(t, standards);

  return (
    <motion.article
      layout="position"
      layoutId={`card-${t.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: closed ? 0.7 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      data-ticket={t.id}
      data-status={t.status}
      data-escalation={t.escalationLevel}
      className={`relative rounded-2xl border bg-surface p-3 shadow-soft ${escalated ? (t.escalationLevel === 2 ? 'border-st-escalated border-2' : 'border-st-escalated/60') : 'border-line/70'}`}
    >
      {fresh && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl ring-2 ring-accent"
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.2, 1, 0.2, 0] }}
          transition={{ duration: 4 }}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 text-start"
        aria-label={`Open ${t.id}: ${t.item}, room ${t.room}`}
      >
        {!closed ? (
          <TimerRing
            progress={progress}
            label={`${mmss(elapsed)} of ${std} min standard`}
            size={compact ? 38 : 44}
          />
        ) : (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-st-done/10 text-st-done">
            <Check size={16} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums">Rm {t.room}</span>
            <span className="truncate text-xs text-muted">{t.guestName}</span>
            {t.priority !== 'normal' && (
              <span
                className={`rounded-full border px-1.5 text-[11px] font-medium uppercase tracking-wide ${PRIORITY[t.priority]}`}
              >
                {t.priority}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium leading-snug">
            {t.quantity && t.kind === 'service' ? `${t.quantity} × ` : ''}
            {t.item}
          </p>
          {t.details && (
            <p className={`mt-0.5 text-xs text-muted ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
              {t.details}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <StatusPill status={t.status} escalation={t.escalationLevel} />
            <span>{ago(now - t.createdAt)}</span>
            {t.alsoNotify && <span>· copy to {DEPT_BY_ID[t.alsoNotify].short}</span>}
            {t.language === 'ar' && <span className="rounded bg-raised px-1">AR</span>}
            {t.kind === 'handover' || t.kind === 'recovery' ? (
              <span className="inline-flex items-center gap-0.5 text-accent">
                <ShieldAlert size={11} aria-hidden /> person needed
              </span>
            ) : null}
            {t.assignee && <span>· {t.assignee}</span>}
          </div>
          {escalated && (
            <p className="mt-1.5 text-xs font-medium text-st-escalated">
              {t.escalationLevel === 2
                ? 'Not accepted within 200% of standard → Rooms Controller'
                : `Not accepted within standard → ${DEPT_BY_ID[t.department].supervisor}`}
            </p>
          )}
        </div>
      </button>

      {!closed && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.status === 'new' && (
            <button
              className="btn-primary min-h-[36px] px-3 text-xs"
              onClick={() => setTicketStatus(t.id, 'accepted', by)}
              data-action="accept"
            >
              <Check size={14} aria-hidden /> Accept
            </button>
          )}
          {(t.status === 'new' || t.status === 'accepted') && (
            <button
              className="btn-ghost min-h-[36px] px-3 text-xs"
              onClick={() => setTicketStatus(t.id, 'on_the_way', by)}
              data-action="on-the-way"
            >
              <Footprints size={14} aria-hidden /> On the way
            </button>
          )}
          <button
            className="btn-ghost min-h-[36px] px-3 text-xs"
            onClick={() => setTicketStatus(t.id, 'done', by)}
            data-action="done"
          >
            <Sparkles size={14} aria-hidden /> Done
          </button>
          {!compact && (
            <>
              <button
                className="btn-ghost min-h-[36px] px-3 text-xs"
                onClick={() => setReassign((v) => !v)}
                aria-expanded={reassign}
              >
                <Repeat2 size={14} aria-hidden /> Reassign
              </button>
              <button
                className="btn-ghost min-h-[36px] px-3 text-xs"
                onClick={() => setNoteOpen((v) => !v)}
                aria-expanded={noteOpen}
              >
                <MessageSquarePlus size={14} aria-hidden /> Note
              </button>
            </>
          )}
        </div>
      )}
      {reassign && (
        <div className="mt-2">
          <label className="label" htmlFor={`re-${t.id}`}>
            Reassign to
          </label>
          <select
            id={`re-${t.id}`}
            className="field py-2 text-sm"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              reassignTicket(t.id, e.target.value as DepartmentId, by);
              setReassign(false);
            }}
          >
            <option value="">Choose a department…</option>
            {DEPARTMENTS.filter((d) => d.id !== t.department).map((d) => (
              <option key={d.id} value={d.id}>
                {d.en}
              </option>
            ))}
          </select>
        </div>
      )}
      {noteOpen && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addNote(t.id, by, note);
            setNote('');
            setNoteOpen(false);
          }}
        >
          <label htmlFor={`note-${t.id}`} className="sr-only">
            Note
          </label>
          <input
            id={`note-${t.id}`}
            className="field py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note"
            maxLength={300}
            autoFocus
          />
          <button className="btn-primary min-h-[40px] px-3 text-xs" disabled={!note.trim()}>
            Add
          </button>
        </form>
      )}
    </motion.article>
  );
}
