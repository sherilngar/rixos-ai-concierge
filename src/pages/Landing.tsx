import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ClipboardList,
  Languages,
  MessageSquareText,
  MonitorPlay,
  Route,
  ShieldCheck,
  Smartphone,
  Star,
  UsersRound,
} from 'lucide-react';
import { SiteHeader } from '../components/ui/SiteHeader';
import { Logo } from '../components/ui/Logo';
import { QrCode } from '../components/ui/QrCode';
import { SampleBadge } from '../components/ui/SampleBadge';

const ENTRIES = [
  {
    to: '/guest',
    title: 'Guest app',
    body: 'What a guest sees on their phone: chat in any words, tap services, track every request live.',
    Icon: Smartphone,
  },
  {
    to: '/staff',
    title: 'Staff board',
    body: 'Each department receives, accepts and closes its tickets, with response timers and escalation.',
    Icon: ClipboardList,
  },
  {
    to: '/present',
    title: 'Present mode',
    body: 'Guest phone and staff board side by side, with a guided five-scenario demo.',
    Icon: MonitorPlay,
  },
];

const STEPS = [
  {
    Icon: MessageSquareText,
    title: 'The guest writes freely',
    body: '“The AC is loud, send two towels and book dinner for 8.” English, Arabic or any language.',
  },
  {
    Icon: Route,
    title: 'The concierge understands and routes',
    body: 'One message becomes three tickets: Engineering, Housekeeping and Restaurants. Missing details are asked, never guessed.',
  },
  {
    Icon: UsersRound,
    title: 'Departments act, the guest is kept informed',
    body: 'Accepted, on the way, done: every step appears in the guest’s chat. Late tickets escalate to the supervisor, then the Rooms Controller.',
  },
  {
    Icon: Star,
    title: 'Every request ends with a rating',
    body: 'A score of 2 or below opens a service-recovery ticket for the ambassador automatically.',
  },
];

const fade = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
};

export default function Landing() {
  useEffect(() => {
    document.title = 'Rixos AI Concierge · Proposal demo';
  }, []);
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:pt-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Logo className="mb-8 h-16 sm:h-20" />
              <p className="eyebrow mb-4">Al Marjan Island · Ras Al Khaimah · Proposal</p>
              <h1 className="display mb-5 text-[44px] leading-[1.02] sm:text-6xl">
                One concierge, in every guest’s own words.
              </h1>
              <p className="mb-8 max-w-xl text-lg text-muted">
                An AI concierge that answers from approved hotel information, turns free-text
                requests into tickets for the right team, and keeps every guest updated until the
                job is done.
              </p>
            </motion.div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/present" className="btn-primary">
                Start the live demo{' '}
                <ArrowRight size={16} aria-hidden className="rtl:-scale-x-100" />
              </Link>
              <Link to="/guest" className="btn-ghost">
                Open the guest app
              </Link>
              <SampleBadge />
            </div>
          </div>
          <motion.div {...fade} className="card flex flex-col items-center gap-4 p-6 text-center">
            <p className="eyebrow">Scan with your phone</p>
            <QrCode />
            <p className="max-w-[240px] text-sm text-muted">
              Open the guest app on a phone while the staff board runs on this screen. Both update
              live.
            </p>
          </motion.div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="entry-heading">
          <h2 id="entry-heading" className="sr-only">
            Entry points
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ENTRIES.map(({ to, title, body, Icon }, i) => (
              <motion.div key={to} {...fade} transition={{ delay: i * 0.06 }}>
                <Link
                  to={to}
                  className="card group flex h-full flex-col gap-4 p-6 transition-transform hover:-translate-y-0.5"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-raised text-accent">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="display text-2xl">{title}</span>
                  <span className="text-sm text-muted">{body}</span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent">
                    Open{' '}
                    <ArrowRight
                      size={14}
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                    />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-y border-line/60 bg-surface/60" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="eyebrow mb-3">How it works</p>
            <h2 id="how-heading" className="display mb-12 max-w-2xl text-4xl">
              From a guest’s sentence to a closed ticket, with a person always in reach.
            </h2>
            <ol className="grid gap-8 md:grid-cols-4">
              {STEPS.map(({ Icon, title, body }, i) => (
                <motion.li
                  key={title}
                  {...fade}
                  transition={{ delay: i * 0.08 }}
                  className="relative"
                >
                  <span className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg text-accent">
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="font-display text-3xl text-accent">0{i + 1}</span>
                  </span>
                  <h3 className="mb-2 font-medium">{title}</h3>
                  <p className="text-sm text-muted">{body}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            {
              Icon: ShieldCheck,
              title: 'Never guesses',
              body: 'Answers only from the approved knowledge base. Anything else goes to the ambassador.',
            },
            {
              Icon: UsersRound,
              title: 'People for what matters',
              body: 'Complaints, medical, safety, refunds and other guests always go to a person, immediately.',
            },
            {
              Icon: Languages,
              title: 'English and Arabic',
              body: 'Full right-to-left layout. Staff always receive English tickets with the original message attached.',
            },
          ].map(({ Icon, title, body }) => (
            <motion.div key={title} {...fade} className="flex gap-4">
              <Icon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div>
                <h3 className="mb-1 font-medium">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </motion.div>
          ))}
        </section>
      </main>
      <footer className="border-t border-line/60 py-8 text-center text-xs text-muted">
        Proposal demo for Rixos Bab Al Bahr · Prepared by Sherif El Naggar · Hotel details marked as
        sample are placeholders.
      </footer>
    </>
  );
}
