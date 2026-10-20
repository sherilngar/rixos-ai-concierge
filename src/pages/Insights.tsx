import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SiteHeader } from '../components/ui/SiteHeader';
import { DEPARTMENTS } from '../domain/departments';
import type { Ticket } from '../domain/types';
import { useStore } from '../store/store';

/** Reads theme tokens so SVG charts follow light and dark mode. */
function useTokens() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => `rgb(${cs.getPropertyValue(n).trim().split(' ').join(',')})`;
    return {
      accent: v('--accent'),
      line: v('--line'),
      muted: v('--muted'),
      fg: v('--fg'),
      surface: v('--surface'),
      raised: v('--raised'),
    };
  };
  const [t, setT] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setT(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return t;
}

function CountUp({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return (
    <>
      <span className="sr-only">{`${value.toFixed(decimals)}${suffix}`}</span>
      <motion.span ref={ref} aria-hidden className="tabular-nums">
        {text}
      </motion.span>
    </>
  );
}

const mins = (ms: number) => ms / 60_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Tile({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="card p-5"
    >
      <p className="eyebrow mb-2">{label}</p>
      <p className="display text-4xl">{children}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </motion.div>
  );
}

interface Row {
  name: string;
  value: number;
}

function ChartCard({
  title,
  subtitle,
  rows,
  unit,
  decimals = 0,
  height = 280,
  vertical = true,
}: {
  title: string;
  subtitle?: string;
  rows: Row[];
  unit: string;
  decimals?: number;
  height?: number;
  vertical?: boolean;
}) {
  const tk = useTokens();
  const [table, setTable] = useState(false);
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <button
          className="rounded-full px-3 py-1.5 text-xs text-muted hover:bg-raised"
          onClick={() => setTable((v) => !v)}
          aria-pressed={table}
        >
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No data yet. Run the guided demo to generate activity.
        </p>
      ) : table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-line/60">
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          style={{ height: vertical ? Math.max(height, rows.length * 30 + 20) : height }}
          role="img"
          aria-label={`${title}: ${rows.map((r) => `${r.name} ${fmt(r.value)}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {vertical ? (
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                barCategoryGap={6}
              >
                <CartesianGrid horizontal={false} stroke={tk.line} strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  tick={{ fill: tk.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: tk.fg, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: tk.raised, opacity: 0.6 }}
                  contentStyle={{
                    background: tk.surface,
                    border: `1px solid ${tk.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmt(v), title]}
                />
                <Bar
                  dataKey="value"
                  fill={tk.accent}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  animationDuration={900}
                  label={{
                    position: 'right',
                    fill: tk.muted,
                    fontSize: 11,
                    formatter: (v: number) => v.toFixed(decimals),
                  }}
                />
              </BarChart>
            ) : (
              <BarChart
                data={rows}
                margin={{ top: 16, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="28%"
              >
                <CartesianGrid vertical={false} stroke={tk.line} strokeOpacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: tk.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: tk.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: tk.raised, opacity: 0.6 }}
                  contentStyle={{
                    background: tk.surface,
                    border: `1px solid ${tk.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmt(v), title]}
                />
                <Bar
                  dataKey="value"
                  fill={tk.accent}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  animationDuration={900}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </motion.section>
  );
}

export default function Insights() {
  const tickets = useStore((s) => s.tickets);
  const standards = useStore((s) => s.settings.standards);
  const [range, setRange] = useState<'7d' | 'live'>('7d');
  useEffect(() => {
    document.title = 'Insights · Rixos AI Concierge';
  }, []);

  const data = useMemo(() => {
    const set: Ticket[] = range === 'live' ? tickets.filter((t) => !t.sample) : tickets;
    const open = set.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
    const done = set.filter((t) => t.status === 'done');
    const accepted = set.filter((t) => t.acceptedAt);
    const perDept = DEPARTMENTS.map((d) => {
      const a = accepted
        .filter((t) => t.department === d.id)
        .map((t) => mins(t.acceptedAt! - t.createdAt));
      const c = done
        .filter((t) => t.department === d.id && t.doneAt)
        .map((t) => mins(t.doneAt! - t.createdAt));
      return { d, accept: avg(a), complete: avg(c), n: a.length, standard: standards[d.id].normal };
    }).filter((x) => x.n > 0);
    const counts = new Map<string, number>();
    set.forEach((t) => counts.set(t.item, (counts.get(t.item) ?? 0) + 1));
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
    const ratings = set.filter((t) => t.rating).map((t) => t.rating!);
    const dist = [1, 2, 3, 4, 5].map((n) => ({
      name: `${n} ★`,
      value: ratings.filter((r) => r === n).length,
    }));
    const escalations = set.filter((t) => t.escalationLevel > 0);
    const escByDept = DEPARTMENTS.map((d) => ({
      name: d.short,
      value: escalations.filter((t) => t.department === d.id).length,
    })).filter((r) => r.value);
    const dining = set.filter((t) => t.kind === 'dining');
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - i));
      const start = day.getTime();
      const end = start + 86_400_000;
      return {
        name: day.toLocaleDateString('en-GB', { weekday: 'short' }),
        value: dining.filter((t) => t.createdAt >= start && t.createdAt < end).length,
      };
    });
    return {
      open: open.length,
      done: done.length,
      accept: avg(accepted.map((t) => mins(t.acceptedAt! - t.createdAt))),
      complete: avg(done.filter((t) => t.doneAt).map((t) => mins(t.doneAt! - t.createdAt))),
      withinStd: accepted.length
        ? (accepted.filter(
            (t) => mins(t.acceptedAt! - t.createdAt) <= standards[t.department].normal,
          ).length /
            accepted.length) *
          100
        : 0,
      escalations: escalations.length,
      escalationsDm: escalations.filter((t) => t.escalationLevel === 2).length,
      rating: avg(ratings),
      ratingsN: ratings.length,
      recovery: set.filter((t) => t.kind === 'recovery').length,
      dining: dining.length,
      perDept,
      top,
      dist,
      escByDept,
      days,
    };
  }, [tickets, standards, range]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Management view</p>
            <h1 className="display text-4xl sm:text-5xl">Service insights</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {range === '7d'
                ? 'Last 7 days, including generated sample history so the charts are readable before the live demo.'
                : 'Only requests created live in this demo session.'}
            </p>
          </div>
          <div
            className="inline-flex rounded-full border border-line bg-surface p-1"
            role="group"
            aria-label="Data range"
          >
            {(
              [
                ['7d', 'Last 7 days (with sample history)'],
                ['live', 'Live demo only'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRange(id)}
                aria-pressed={range === id}
                className={`rounded-full px-4 py-2 text-xs transition-colors ${range === id ? 'bg-fg text-bg' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Open requests">
            <CountUp value={data.open} />
          </Tile>
          <Tile label="Completed">
            <CountUp value={data.done} />
          </Tile>
          <Tile
            label="Average time to accept"
            note={`${data.withinStd.toFixed(0)}% within standard`}
          >
            <CountUp value={data.accept} decimals={1} suffix=" min" />
          </Tile>
          <Tile label="Average time to complete">
            <CountUp value={data.complete} decimals={1} suffix=" min" />
          </Tile>
          <Tile label="Escalations" note={`${data.escalationsDm} reached the Rooms Controller`}>
            <CountUp value={data.escalations} />
          </Tile>
          <Tile label="Average rating" note={`${data.ratingsN} ratings`}>
            <CountUp value={data.rating} decimals={2} suffix=" / 5" />
          </Tile>
          <Tile label="Service recoveries" note="Opened by ratings of 2 or below">
            <CountUp value={data.recovery} />
          </Tile>
          <Tile label="In-room dining orders">
            <CountUp value={data.dining} />
          </Tile>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Average time to accept, by department"
            subtitle="Minutes from request to acceptance"
            rows={data.perDept.map((x) => ({ name: x.d.short, value: x.accept }))}
            unit="min"
            decimals={1}
          />
          <ChartCard
            title="Average time to complete, by department"
            subtitle="Minutes from request to done"
            rows={data.perDept
              .filter((x) => x.complete)
              .map((x) => ({ name: x.d.short, value: x.complete }))}
            unit="min"
            decimals={1}
          />
          <ChartCard title="Top 10 requests" rows={data.top} unit="" />
          <ChartCard
            title="Escalations by department"
            subtitle="Requests not accepted within the response standard"
            rows={data.escByDept}
            unit=""
          />
          <ChartCard
            title="Guest ratings"
            subtitle="Number of ratings at each score"
            rows={data.dist}
            unit=""
            vertical={false}
            height={240}
          />
          <ChartCard
            title="In-room dining orders per day"
            rows={data.days}
            unit=""
            vertical={false}
            height={240}
          />
        </div>
      </main>
    </>
  );
}
