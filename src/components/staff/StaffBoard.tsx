import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { BellOff, BellRing, Inbox, LogOut, Search } from 'lucide-react';
import { DEPARTMENTS, DEPT_BY_ID } from '../../domain/departments';
import type { DepartmentId, Priority, StaffSession, Ticket } from '../../domain/types';
import { useStore } from '../../store/store';
import { DEPT_ICON } from '../ui/icons';
import { chime, useNewIds, useNow } from './hooks';
import { TicketCard } from './TicketCard';
import { TicketDrawer } from './TicketDrawer';

type TabId = 'all' | DepartmentId;
type StatusFilter = 'all' | 'new' | 'progress' | 'done';

const isOpen = (t: Ticket) => t.status !== 'done' && t.status !== 'cancelled';

function belongsTo(t: Ticket, tab: TabId) {
  if (tab === 'all') return true;
  if (tab === 'dutymanager') return t.department === 'dutymanager' || t.escalationLevel === 2;
  return t.department === tab || t.alsoNotify === tab;
}

function sortTickets(a: Ticket, b: Ticket) {
  const pr = { urgent: 0, high: 1, normal: 2 };
  if (a.escalationLevel !== b.escalationLevel) return b.escalationLevel - a.escalationLevel;
  if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
  return a.createdAt - b.createdAt;
}

export function StaffBoard({
  session,
  embedded = false,
  onSignOut,
}: {
  session: StaffSession;
  embedded?: boolean;
  onSignOut?: () => void;
}) {
  const all = useStore((s) => s.tickets.filter((t) => !t.sample));
  const [tab, setTab] = useState<TabId>(embedded ? 'all' : session.department);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [priority, setPriority] = useState<'all' | Priority>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('rixos-sound') !== 'off';
    } catch {
      return true;
    }
  });
  const now = useNow();

  const ids = useMemo(() => all.map((t) => t.id), [all]);
  const onNew = useCallback(() => {
    if (sound) chime();
  }, [sound]);
  const fresh = useNewIds(ids, onNew);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const t of all.filter(isOpen)) {
      c.all = (c.all ?? 0) + 1;
      for (const d of DEPARTMENTS) if (belongsTo(t, d.id)) c[d.id] = (c[d.id] ?? 0) + 1;
    }
    return c;
  }, [all]);
  const escalatedCount = all.filter(
    (t) => isOpen(t) && t.status === 'new' && t.escalationLevel > 0,
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((t) => belongsTo(t, tab))
      .filter((t) => priority === 'all' || t.priority === priority)
      .filter((t) =>
        status === 'all'
          ? t.status !== 'cancelled'
          : status === 'new'
            ? t.status === 'new'
            : status === 'progress'
              ? t.status === 'accepted' || t.status === 'on_the_way'
              : t.status === 'done',
      )
      .filter(
        (t) =>
          !q ||
          [t.id, t.room, t.guestName, t.item, t.details ?? '', t.originalMessage ?? ''].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort(sortTickets);
  }, [all, tab, query, status, priority]);

  const toggleSound = () => {
    setSound((v) => {
      try {
        localStorage.setItem('rixos-sound', v ? 'off' : 'on');
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  return (
    <LayoutGroup>
      <div
        className={`flex flex-col ${embedded ? 'h-full' : 'min-h-[calc(100dvh-4rem)]'}`}
        data-testid="staff-board"
      >
        <div
          className={`border-b border-line/60 bg-bg/90 ${embedded ? '' : 'sticky top-16 z-20 backdrop-blur'}`}
        >
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
            {!embedded && (
              <p className="me-auto text-sm">
                <span className="text-muted">Signed in as</span>{' '}
                <span className="font-medium">{session.name}</span>
                <span className="text-muted"> · {DEPT_BY_ID[session.department].en}</span>
              </p>
            )}
            {embedded && <p className="eyebrow me-auto">Staff board · live</p>}
            {escalatedCount > 0 && (
              <span
                className="rounded-full border border-st-escalated/50 bg-st-escalated/10 px-2.5 py-1 text-xs font-medium text-st-escalated"
                role="status"
              >
                {escalatedCount} escalated
              </span>
            )}
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised"
              onClick={toggleSound}
              aria-pressed={sound}
              aria-label={sound ? 'Mute new-ticket sound' : 'Turn on new-ticket sound'}
            >
              {sound ? <BellRing size={16} aria-hidden /> : <BellOff size={16} aria-hidden />}
            </button>
            {onSignOut && (
              <button className="btn-ghost min-h-[40px] px-3 text-xs" onClick={onSignOut}>
                <LogOut size={14} aria-hidden /> Sign out
              </button>
            )}
          </div>
          <div
            className="scrollbar-none flex gap-1 overflow-x-auto px-4 py-2 sm:px-6"
            role="tablist"
            aria-label="Departments"
          >
            {[{ id: 'all' as const, short: 'All departments' }, ...DEPARTMENTS].map((d) => {
              const Icon = d.id === 'all' ? Inbox : DEPT_ICON[d.id];
              const n = counts[d.id] ?? 0;
              const active = tab === d.id;
              return (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(d.id)}
                  className={`relative inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${active ? 'text-bg' : 'text-muted hover:bg-raised hover:text-fg'}`}
                >
                  {active && (
                    <motion.span
                      layoutId={embedded ? 'dept-pill-e' : 'dept-pill'}
                      className="absolute inset-0 rounded-full bg-fg"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <Icon size={14} aria-hidden className="relative" />
                  <span className="relative whitespace-nowrap">{d.short}</span>
                  <motion.span
                    key={n}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    className={`relative min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${active ? 'bg-bg/20' : n ? 'bg-accent/15 text-accent' : 'bg-raised'}`}
                    aria-label={`${n} open`}
                  >
                    {n}
                  </motion.span>
                </button>
              );
            })}
          </div>
          {!embedded && (
            <div className="flex flex-wrap items-end gap-2 px-4 pb-3 sm:px-6">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ltr:left-3 rtl:right-3"
                  aria-hidden
                />
                <label htmlFor="board-search" className="sr-only">
                  Search tickets
                </label>
                <input
                  id="board-search"
                  className="field py-2 ps-9 text-sm"
                  placeholder="Search room, guest, request or ticket id"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="f-status" className="sr-only">
                  Status
                </label>
                <select
                  id="f-status"
                  className="field py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-priority" className="sr-only">
                  Priority
                </label>
                <select
                  id="f-priority"
                  className="field py-2 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'all' | Priority)}
                >
                  <option value="all">All priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className={`flex-1 px-4 py-4 sm:px-6 ${embedded ? 'overflow-y-auto' : ''}`}>
          {tab === 'all' ? (
            <AllLanes
              tickets={filtered}
              now={now}
              session={session}
              fresh={fresh}
              compact={embedded}
              onOpen={setOpenId}
            />
          ) : (
            <Columns
              tickets={filtered}
              now={now}
              session={session}
              fresh={fresh}
              onOpen={setOpenId}
            />
          )}
        </div>
      </div>
      <TicketDrawer ticketId={openId} session={session} onClose={() => setOpenId(null)} />
    </LayoutGroup>
  );
}

interface ViewProps {
  tickets: Ticket[];
  now: number;
  session: StaffSession;
  fresh: Set<string>;
  compact?: boolean;
  onOpen: (id: string) => void;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
      <Inbox size={20} aria-hidden />
      {text}
    </div>
  );
}

function AllLanes({ tickets, now, session, fresh, compact, onOpen }: ViewProps) {
  const visible = tickets.filter(
    (t) => t.status !== 'done' || (t.doneAt && now - t.doneAt < 30 * 60_000),
  );
  const lanes = DEPARTMENTS.map((d) => ({
    d,
    items: visible.filter((t) => t.department === d.id),
  })).filter((l) => l.items.length);
  if (!lanes.length)
    return <Empty text="No open requests. New tickets appear here the moment a guest asks." />;
  return (
    <div
      className={`grid gap-4 ${compact ? 'grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}
    >
      <AnimatePresence initial={false}>
        {lanes.map(({ d, items }) => {
          const Icon = DEPT_ICON[d.id];
          return (
            <motion.section
              key={d.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-raised/50 p-3"
              data-dept-lane={d.id}
              aria-label={d.en}
            >
              <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
                <Icon size={14} className="text-accent" aria-hidden /> {d.en}
                <span className="ms-auto text-xs text-muted">
                  {items.filter(isOpen).length} open
                </span>
              </h3>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      now={now}
                      session={session}
                      fresh={fresh.has(t.id)}
                      compact={compact}
                      onOpen={() => onOpen(t.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Columns({ tickets, now, session, fresh, onOpen }: ViewProps) {
  const cols = [
    { id: 'new', title: 'New', items: tickets.filter((t) => t.status === 'new') },
    {
      id: 'progress',
      title: 'In progress',
      items: tickets.filter((t) => t.status === 'accepted' || t.status === 'on_the_way'),
    },
    {
      id: 'done',
      title: 'Done',
      items: tickets
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
        .slice(0, 15),
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cols.map((c) => (
        <section key={c.id} aria-label={c.title} className="min-w-0">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <span
              className={`h-2 w-2 rounded-full ${c.id === 'new' ? 'bg-st-new' : c.id === 'progress' ? 'bg-st-progress' : 'bg-st-done'}`}
              aria-hidden
            />
            {c.title}
            <span className="text-muted">{c.items.length}</span>
          </h3>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {c.items.map((t) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  now={now}
                  session={session}
                  fresh={fresh.has(t.id)}
                  onOpen={() => onOpen(t.id)}
                />
              ))}
            </AnimatePresence>
            {c.items.length === 0 && (
              <Empty
                text={
                  c.id === 'new'
                    ? 'Nothing waiting. Well done.'
                    : c.id === 'progress'
                      ? 'Nothing in progress.'
                      : 'Nothing completed yet today.'
                }
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
