import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, CircleDot, Loader2, XCircle } from 'lucide-react';
import type { EscalationLevel, TicketStatus } from '../../domain/types';
import { STATUS_LABEL_EN } from './statusLabels';

const STYLE: Record<TicketStatus, { cls: string; Icon: typeof CircleDot }> = {
  new: { cls: 'text-st-new bg-st-new/10 border-st-new/30', Icon: CircleDot },
  accepted: { cls: 'text-st-progress bg-st-progress/10 border-st-progress/30', Icon: Loader2 },
  on_the_way: { cls: 'text-st-progress bg-st-progress/10 border-st-progress/30', Icon: Loader2 },
  done: { cls: 'text-st-done bg-st-done/10 border-st-done/30', Icon: CheckCircle2 },
  cancelled: { cls: 'text-muted bg-raised border-line', Icon: XCircle },
};

/** Colour is never the only signal: every status carries a text label and an icon. */
export function StatusPill({
  status,
  label,
  escalation = 0,
}: {
  status: TicketStatus;
  label?: string;
  escalation?: EscalationLevel;
}) {
  if (escalation > 0 && status === 'new') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-st-escalated/40 bg-st-escalated/10 px-2 py-0.5 text-xs font-medium text-st-escalated">
        <AlertTriangle size={12} aria-hidden />
        {escalation === 2 ? 'Escalated · Rooms Controller' : 'Escalated · Supervisor'}
      </span>
    );
  }
  const { cls, Icon } = STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon size={12} aria-hidden />
      {label ?? STATUS_LABEL_EN[status]}
    </span>
  );
}

const ORDER: TicketStatus[] = ['new', 'accepted', 'on_the_way', 'done'];

/** New → Accepted → On the way → Done, with a line that fills as the request progresses. */
export function StatusSteps({ status, labels }: { status: TicketStatus; labels: string[] }) {
  const idx = status === 'cancelled' ? -1 : ORDER.indexOf(status);
  const pct = idx <= 0 ? 0 : idx / (ORDER.length - 1);
  return (
    <div className="relative mt-3" aria-label={`Progress: ${labels[Math.max(0, idx)] ?? ''}`}>
      <div
        className="absolute inset-x-[12.5%] top-[7px] h-[2px] rounded-full bg-line"
        aria-hidden
      />
      <motion.div
        aria-hidden
        className="absolute top-[7px] h-[2px] w-3/4 rounded-full bg-accent ltr:left-[12.5%] ltr:origin-left rtl:right-[12.5%] rtl:origin-right"
        initial={false}
        animate={{ scaleX: pct }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
      <ol className="relative grid grid-cols-4">
        {labels.map((l, i) => {
          const reached = idx >= i;
          return (
            <li key={l} className="flex flex-col items-center gap-1.5">
              <motion.span
                initial={false}
                animate={{ scale: reached ? 1 : 0.8 }}
                className={`h-4 w-4 rounded-full border-2 ${reached ? 'border-accent bg-accent' : 'border-line bg-surface'}`}
                aria-hidden
              />
              <span className={`text-xs ${reached ? 'font-medium text-fg' : 'text-muted'}`}>
                {l}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
