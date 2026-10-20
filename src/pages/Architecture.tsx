import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Bot,
  Building2,
  Database,
  KeyRound,
  Lock,
  Network,
  ScanEye,
  ShieldCheck,
  Smartphone,
  Timer,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { SiteHeader } from '../components/ui/SiteHeader';

const LAYERS = [
  {
    Icon: Smartphone,
    title: 'Channels',
    items: [
      'Guest web app (QR code in room)',
      'Staff board on desktop and tablet',
      'Later: WhatsApp, in-room TV',
    ],
  },
  {
    Icon: Bot,
    title: 'AI concierge',
    items: [
      'Claude, called only from a secure server function',
      'Answers from the approved knowledge base',
      'Structured tools, validated on the server',
    ],
  },
  {
    Icon: Network,
    title: 'Router',
    items: [
      'Department and priority',
      'Response standards per team',
      'Escalation: supervisor at 100%, Duty Manager at 200%',
    ],
  },
  {
    Icon: UsersRound,
    title: 'Departments',
    items: [
      '12 teams, each with its own board',
      'Accept, on the way, done, reassign, notes',
      'Human takeover of any chat',
    ],
  },
  {
    Icon: Building2,
    title: 'Hotel systems',
    items: [
      'Property management system: profile, folio',
      'Work-order and point-of-sale systems',
      'Integration through existing interfaces, with IT',
    ],
  },
];

const SECURITY = [
  {
    Icon: KeyRound,
    title: 'No secrets in the browser',
    body: 'The AI key and the database service key live only in server-side environment variables. Nothing sensitive is in the code repository.',
  },
  {
    Icon: ShieldCheck,
    title: 'Every input validated',
    body: 'Each request the AI proposes is checked against a strict schema before a ticket exists. Invalid requests are rejected, not guessed.',
  },
  {
    Icon: ScanEye,
    title: 'Card and ID numbers masked',
    body: 'Card, passport and Emirates ID numbers are masked before storage or AI processing, and the guest is reminded not to share them.',
  },
  {
    Icon: UserCheck,
    title: 'People for sensitive matters',
    body: 'Complaints, medical, safety, refunds, compensation, valuables and other guests always go to a person. Emergencies alert Security and the Duty Manager immediately.',
  },
  {
    Icon: Lock,
    title: 'Prompt-injection resistant',
    body: 'Guest messages are treated as data. Attempts to change the rules are declined, and the AI can only act through the defined tools.',
  },
  {
    Icon: Timer,
    title: 'Limits and fallbacks',
    body: 'Per-session rate limits, capped reply length and a timeout. If the AI is unavailable, the guest is handed to the ambassador automatically.',
  },
  {
    Icon: Database,
    title: 'Data minimisation',
    body: 'Only what service needs: room, name, requests, ratings. Row-level security separates guests. Retention and compliance with UAE PDPL (Federal Decree-Law 45 of 2021) to be agreed with the data protection lead.',
  },
];

const PHASES = [
  {
    n: '1',
    title: 'Proposal',
    when: 'Now',
    points: [
      'This demo: full guest and staff journey',
      'Approve the knowledge base and response standards',
      'Agree departments, owners and escalation paths',
    ],
  },
  {
    n: '2',
    title: 'Pilot',
    when: 'Selected rooms',
    points: [
      'Live Claude through a server function',
      'Shared real-time database for phones and boards',
      'Staff boards on tablets; measure response times and ratings',
    ],
  },
  {
    n: '3',
    title: 'Scale and integrate',
    when: 'All rooms',
    points: [
      'Connect PMS, work-order and point-of-sale systems',
      'Add WhatsApp and in-room TV channels',
      'Staff single sign-on and full audit reporting',
    ],
  },
];

export default function Architecture() {
  useEffect(() => {
    document.title = 'For IT · Rixos AI Concierge';
  }, []);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="eyebrow mb-2">For IT</p>
        <h1 className="display mb-3 text-4xl sm:text-5xl">How it fits together</h1>
        <p className="mb-10 max-w-2xl text-muted">
          Five layers, each replaceable on its own. Guests reach the concierge through any channel,
          the AI turns messages into validated requests, the router applies the hotel’s standards,
          departments act, and hotel systems are connected step by step.
        </p>

        <section aria-label="Architecture diagram" className="card mb-6 overflow-hidden p-5 sm:p-8">
          <ol className="grid gap-4 lg:grid-cols-5 lg:gap-0">
            {LAYERS.map(({ Icon, title, items }, i) => (
              <li key={title} className="relative flex lg:flex-col">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="relative z-10 flex-1 rounded-2xl border border-line bg-bg p-4 lg:mx-2"
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg text-bg">
                    <Icon size={18} aria-hidden />
                  </span>
                  <p className="eyebrow mb-1">Layer {i + 1}</p>
                  <h2 className="mb-2 font-medium">{title}</h2>
                  <ul className="space-y-1.5 text-xs text-muted">
                    {items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </motion.div>
                {i < LAYERS.length - 1 && <Connector index={i} />}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-muted">
            This proposal demo runs entirely in the browser: a scripted offline concierge stands in
            for Claude, and data stays on the device. The pilot (phase 2) swaps both for the
            server-side AI function and a shared database without changing the screens.
          </p>
        </section>

        <section
          className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-labelledby="sec-heading"
        >
          <h2 id="sec-heading" className="display col-span-full mt-6 text-3xl">
            Security and privacy
          </h2>
          {SECURITY.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.06 }}
              className="card p-5"
            >
              <Icon size={20} className="mb-3 text-accent" aria-hidden />
              <h3 className="mb-1 font-medium">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </motion.div>
          ))}
        </section>

        <section aria-labelledby="phase-heading">
          <h2 id="phase-heading" className="display mb-6 text-3xl">
            Three-phase rollout
          </h2>
          <ol className="relative grid gap-6 md:grid-cols-3">
            <motion.span
              aria-hidden
              className="absolute left-0 right-0 top-6 hidden h-px origin-left bg-accent md:block"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {PHASES.map((p, i) => (
              <motion.li
                key={p.n}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.2 }}
                className="relative"
              >
                <span className="relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-accent bg-bg font-display text-2xl text-accent">
                  {p.n}
                </span>
                <p className="eyebrow">{p.when}</p>
                <h3 className="display mb-2 text-2xl">{p.title}</h3>
                <ul className="space-y-1.5 text-sm text-muted">
                  {p.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </motion.li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}

/** A connector with a pulse travelling along it, showing the flow of a request. */
function Connector({ index }: { index: number }) {
  return (
    <div
      aria-hidden
      className="relative flex w-8 shrink-0 items-center justify-center lg:absolute lg:-right-3 lg:top-1/2 lg:z-20 lg:h-4 lg:w-6 lg:-translate-y-1/2"
    >
      <span className="h-full w-px bg-line lg:h-px lg:w-full lg:bg-accent/60" />
      <motion.span
        className="absolute h-2.5 w-2.5 rounded-full bg-accent"
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.6] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.45, ease: 'easeInOut' }}
      />
    </div>
  );
}
