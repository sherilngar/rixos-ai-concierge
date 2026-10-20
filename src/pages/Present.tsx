import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, FastForward, Pause, Play, RotateCcw } from 'lucide-react';
import { GuestApp } from '../components/guest/GuestApp';
import { DEMO_GUEST_ID } from '../data/demo';
import { markAllMessagesSeen } from '../components/guest/seen';
import { StaffBoard } from '../components/staff/StaffBoard';
import { Logo } from '../components/ui/Logo';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { SampleBadge } from '../components/ui/SampleBadge';
import { SyncBadge } from '../components/ui/SyncBadge';
import { DEPT_ICON } from '../components/ui/icons';
import { DEPT_BY_ID } from '../domain/departments';
import type { DepartmentId } from '../domain/types';
import { DEMO_STEPS, resetForDemo } from '../demo/script';
import { advanceClock, getState, onStoreEvent } from '../store/store';

const SESSION = { department: 'dutymanager' as const, name: 'Ahmed' };

interface Flight {
  key: string;
  label: string;
  dept: DepartmentId;
  from: DOMRect;
  to: DOMRect;
}

export default function Present() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const autoRef = useRef(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Present · Rixos AI Concierge';
  }, []);

  // A new ticket visibly flies from the guest's phone into its department lane.
  useEffect(
    () =>
      onStoreEvent((e) => {
        if (e.type !== 'tickets-created') return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;
        window.setTimeout(() => {
          const root = stage.current;
          if (!root) return;
          const phone = root.querySelector('[data-phone]')?.getBoundingClientRect();
          const next: Flight[] = [];
          for (const id of e.ids) {
            const t = getState().tickets.find((x) => x.id === id);
            if (!t) continue;
            const src = root
              .querySelector(`[data-phone] [data-ticket-chip="${id}"]`)
              ?.getBoundingClientRect();
            const dst = root
              .querySelector(`[data-board] [data-dept-lane="${t.department}"]`)
              ?.getBoundingClientRect();
            const from =
              src && src.top > (phone?.top ?? 0) && src.bottom < (phone?.bottom ?? Infinity)
                ? src
                : phone;
            if (!from || !dst) continue;
            next.push({
              key: `${id}-${Date.now()}`,
              label: `${t.quantity && t.kind === 'service' ? `${t.quantity} × ` : ''}${t.item}`,
              dept: t.department,
              from,
              to: dst,
            });
          }
          if (next.length) setFlights((f) => [...f, ...next]);
        }, 420);
      }),
    [],
  );

  const sleep = useCallback((ms: number) => new Promise<void>((r) => window.setTimeout(r, ms)), []);

  const runStep = useCallback(
    async (i: number) => {
      const s = DEMO_STEPS[i];
      if (!s) return;
      setRunning(true);
      setStep(i);
      try {
        await s.run({ sleep });
      } finally {
        setRunning(false);
        setStep(i + 1);
      }
    },
    [sleep],
  );

  const reset = useCallback(() => {
    autoRef.current = false;
    setAuto(false);
    resetForDemo();
    markAllMessagesSeen([]);
    setStep(0);
    setFlights([]);
  }, []);

  const playAll = useCallback(async () => {
    autoRef.current = true;
    setAuto(true);
    let i = step >= DEMO_STEPS.length ? 0 : step;
    if (i === 0) reset();
    autoRef.current = true;
    setAuto(true);
    while (autoRef.current && i < DEMO_STEPS.length) {
      await runStep(i);
      i += 1;
      if (autoRef.current) await sleep(1800);
    }
    autoRef.current = false;
    setAuto(false);
  }, [step, runStep, reset, sleep]);

  const done = step >= DEMO_STEPS.length;
  const current = DEMO_STEPS[Math.min(step, DEMO_STEPS.length - 1)]!;

  return (
    <div className="flex min-h-[100dvh] flex-col lg:h-[100dvh]" ref={stage}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-2.5 sm:px-6">
        <Link to="/" aria-label="Home" className="shrink-0">
          <Logo className="h-8" />
        </Link>
        <span className="hidden text-xs text-muted sm:inline">
          Present mode · same live data on both sides
        </span>
        <SyncBadge />
        <SampleBadge />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <button
            className="btn-ghost min-h-[40px] px-3 text-xs"
            onClick={() => advanceClock(1)}
            title="Move the demo clock forward one minute"
          >
            <FastForward size={14} aria-hidden /> +1 min
          </button>
          <button
            className="btn-ghost min-h-[40px] px-3 text-xs"
            onClick={reset}
            data-testid="demo-reset"
          >
            <RotateCcw size={14} aria-hidden /> Reset
          </button>
          {auto ? (
            <button
              className="btn-ghost min-h-[40px] px-4 text-xs"
              onClick={() => (autoRef.current = false)}
            >
              <Pause size={14} aria-hidden /> Pause after this step
            </button>
          ) : (
            <button
              className="btn-ghost min-h-[40px] px-4 text-xs"
              onClick={() => void playAll()}
              disabled={running}
              data-testid="demo-play"
            >
              <Play size={14} aria-hidden /> Play all
            </button>
          )}
          <button
            className="btn-primary min-h-[40px] px-4 text-xs"
            onClick={() => void runStep(done ? 0 : step)}
            disabled={running || auto || done}
            data-testid="demo-next"
          >
            {step === 0 ? 'Start guided demo' : done ? 'Demo complete' : 'Next step'}{' '}
            <ChevronRight size={14} aria-hidden className="rtl:-scale-x-100" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b border-line/60 bg-surface/70 px-4 py-3 sm:px-6">
        <ol className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto" aria-label="Demo steps">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${i < step ? 'border-st-done/40 text-st-done' : i === step && !done ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="tabular-nums">{i + 1}</span> {s.title}
              </span>
            </li>
          ))}
        </ol>
        <AnimatePresence mode="wait">
          <motion.p
            key={done ? 'done' : current.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            aria-live="polite"
            data-testid="demo-narration"
          >
            {done
              ? 'That’s the full journey. Reset to run it again, or take questions with the live screens.'
              : step === 0 && !running
                ? 'Press “Start guided demo” to begin, or type in the phone yourself. Everything you see is the real app, not a recording.'
                : current.narration}
            {running && (
              <span
                className="ms-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle"
                aria-label="Running"
              />
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(380px,440px)_1fr]">
        <div className="flex items-center justify-center bg-sand/60 p-4 dark:bg-raised/30 lg:p-6">
          <div
            data-phone
            className="relative h-[min(820px,calc(100dvh-170px))] min-h-[640px] w-[min(390px,100%)] overflow-hidden rounded-[48px] border-[10px] border-ink bg-bg shadow-2xl dark:border-[#3a3631]"
          >
            <div
              className="absolute left-1/2 top-2 z-30 h-6 w-28 -translate-x-1/2 rounded-full bg-ink"
              aria-hidden
            />
            <GuestApp embedded guestId={DEMO_GUEST_ID} />
          </div>
        </div>
        <div
          data-board
          className="min-h-[600px] border-line/60 lg:min-h-0 lg:overflow-hidden lg:border-s"
        >
          <StaffBoard session={SESSION} embedded />
        </div>
      </div>

      {flights.map((f) => (
        <FlyingTicket
          key={f.key}
          flight={f}
          onDone={() => setFlights((x) => x.filter((y) => y.key !== f.key))}
        />
      ))}
    </div>
  );
}

function FlyingTicket({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const Icon = DEPT_ICON[flight.dept];
  const startX = flight.from.left + flight.from.width / 2 - 110;
  const startY = flight.from.top + flight.from.height / 2 - 22;
  const endX = flight.to.left + Math.min(flight.to.width, 320) / 2 - 110;
  const endY = flight.to.top + 6;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 flex w-[220px] items-center gap-2 rounded-xl border border-accent/50 bg-surface px-3 py-2 text-xs font-medium shadow-2xl"
      initial={{ x: startX, y: startY, scale: 0.9, opacity: 0 }}
      animate={{
        x: [startX, (startX + endX) / 2, endX],
        y: [startY, Math.min(startY, endY) - 60, endY],
        scale: [0.9, 1.05, 0.9],
        opacity: [0, 1, 0],
      }}
      transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], times: [0, 0.55, 1] }}
      onAnimationComplete={onDone}
    >
      <Icon size={14} className="shrink-0 text-accent" />
      <span className="truncate">{flight.label}</span>
      <span className="ms-auto shrink-0 text-[11px] text-muted">
        → {DEPT_BY_ID[flight.dept].short}
      </span>
    </motion.div>
  );
}
