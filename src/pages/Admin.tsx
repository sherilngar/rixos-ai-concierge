import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Check, Download, Lock, RotateCcw, Save } from 'lucide-react';
import { SiteHeader } from '../components/ui/SiteHeader';
import { DEFAULT_STANDARDS, DEPARTMENTS, PLACEHOLDER_STANDARDS } from '../domain/departments';
import type { Standards } from '../domain/types';
import { DEFAULT_KNOWLEDGE, KnowledgeSchema, type Knowledge } from '../data/knowledge';
import { resetDemo, setKnowledge, setStandards, useStore } from '../store/store';

/**
 * Demo-only gate: the static proposal has no server, so this keeps casual viewers
 * out of Settings but is not real security. The pilot uses staff single sign-on.
 * SHA-256 of the demo password (see README).
 */
const PASSWORD_HASH = 'ed47241ec703411d790397ead521bc59eb49d0d57a618dd0b6fce067a5b508a0';
const KEY = 'rixos-admin-unlocked';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.title = 'Settings · Rixos AI Concierge';
  }, []);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {unlocked ? (
          <Settings />
        ) : (
          <Gate
            onUnlock={() => {
              setUnlocked(true);
              try {
                sessionStorage.setItem(KEY, '1');
              } catch {
                /* ignore */
              }
            }}
          />
        )}
      </main>
    </>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if ((await sha256(pw)) === PASSWORD_HASH) onUnlock();
    else setError('That password is not correct.');
  };
  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm p-6">
      <Lock size={20} className="mb-3 text-accent" aria-hidden />
      <h1 className="display mb-1 text-3xl">Settings</h1>
      <p className="mb-5 text-sm text-muted">
        For the hotel team. Edit the knowledge base, response standards and outlet hours without
        touching code.
      </p>
      <label className="label" htmlFor="admin-pw">
        Password
      </label>
      <input
        id="admin-pw"
        type="password"
        className="field mb-3"
        value={pw}
        onChange={(e) => {
          setPw(e.target.value);
          setError('');
        }}
        autoComplete="current-password"
        aria-invalid={!!error}
        aria-describedby={error ? 'pw-error' : undefined}
      />
      {error && (
        <p id="pw-error" role="alert" className="mb-3 text-sm text-st-escalated">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={!pw}>
        Unlock
      </button>
    </form>
  );
}

function Saved({ show }: { show: boolean }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      className="inline-flex items-center gap-1 text-sm text-st-done"
      role="status"
    >
      {show && (
        <>
          <Check size={14} aria-hidden /> Saved
        </>
      )}
    </motion.span>
  );
}

function useFlash() {
  const [on, setOn] = useState(false);
  return [
    on,
    () => {
      setOn(true);
      window.setTimeout(() => setOn(false), 1800);
    },
  ] as const;
}

function Settings() {
  return (
    <>
      <p className="eyebrow mb-2">Settings</p>
      <h1 className="display mb-8 text-4xl sm:text-5xl">Hotel configuration</h1>
      <div className="space-y-8">
        <StandardsEditor />
        <HoursEditor />
        <KnowledgeEditor />
        <DemoData />
      </div>
    </>
  );
}

function StandardsEditor() {
  const current = useStore((s) => s.settings.standards);
  const [draft, setDraft] = useState<Standards>(current);
  const [saved, flash] = useFlash();
  useEffect(() => setDraft(current), [current]);
  const set = (id: keyof Standards, field: 'normal' | 'urgent', v: string) => {
    const n = Number(v);
    setDraft((d) => ({
      ...d,
      [id]: {
        ...d[id],
        [field]:
          v === '' && field === 'urgent' ? undefined : Math.max(0.5, Math.min(120, n || 0.5)),
      },
    }));
  };
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="std-h">
      <h2 id="std-h" className="display mb-1 text-2xl">
        Response standards
      </h2>
      <p className="mb-5 text-sm text-muted">
        Minutes to accept a request. Tickets escalate to the supervisor at 100% and the Rooms
        Controller at 200%.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Department</th>
              <th className="pb-2 font-medium">Normal (min)</th>
              <th className="pb-2 font-medium">Urgent (min, optional)</th>
            </tr>
          </thead>
          <tbody>
            {DEPARTMENTS.map((d) => (
              <tr key={d.id} className="border-t border-line/60">
                <td className="py-2 pe-3">
                  {d.en}
                  {PLACEHOLDER_STANDARDS.includes(d.id) && (
                    <span className="ms-2 rounded-full border border-dashed border-accent/60 px-1.5 text-[11px] text-accent">
                      placeholder
                    </span>
                  )}
                </td>
                <td className="py-2 pe-3">
                  <label
                    className="sr-only"
                    htmlFor={`n-${d.id}`}
                  >{`${d.en} normal minutes`}</label>
                  <input
                    id={`n-${d.id}`}
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="field w-24 py-1.5"
                    value={draft[d.id].normal}
                    onChange={(e) => set(d.id, 'normal', e.target.value)}
                  />
                </td>
                <td className="py-2">
                  <label
                    className="sr-only"
                    htmlFor={`u-${d.id}`}
                  >{`${d.en} urgent minutes`}</label>
                  <input
                    id={`u-${d.id}`}
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="field w-24 py-1.5"
                    value={draft[d.id].urgent ?? ''}
                    placeholder="—"
                    onChange={(e) => set(d.id, 'urgent', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          onClick={() => {
            setStandards(draft);
            flash();
          }}
        >
          <Save size={16} aria-hidden /> Save standards
        </button>
        <button className="btn-ghost" onClick={() => setDraft(structuredClone(DEFAULT_STANDARDS))}>
          <RotateCcw size={16} aria-hidden /> Brief defaults
        </button>
        <Saved show={saved} />
      </div>
    </section>
  );
}

function HoursEditor() {
  const k = useStore((s) => s.settings.knowledge);
  const [draft, setDraft] = useState<Knowledge>(k);
  const [saved, flash] = useFlash();
  useEffect(() => setDraft(k), [k]);
  const facilities: Array<[string, () => string, (v: string) => Knowledge]> = [
    [
      'Check-in time',
      () => draft.policies.checkIn,
      (v) => ({ ...draft, policies: { ...draft.policies, checkIn: v } }),
    ],
    [
      'Check-out time',
      () => draft.policies.checkOut,
      (v) => ({ ...draft, policies: { ...draft.policies, checkOut: v } }),
    ],
    ['Spa', () => draft.spa.hours, (v) => ({ ...draft, spa: { ...draft.spa, hours: v } })],
    ['Gym', () => draft.gym.hours, (v) => ({ ...draft, gym: { ...draft.gym, hours: v } })],
    [
      'Sauna and steam',
      () => draft.sauna.hours,
      (v) => ({ ...draft, sauna: { ...draft.sauna, hours: v } }),
    ],
    [
      'Pool and beach',
      () => draft.pool.hours,
      (v) => ({ ...draft, pool: { ...draft.pool, hours: v } }),
    ],
    [
      "Kids' club",
      () => draft.kidsClub.hours,
      (v) => ({ ...draft, kidsClub: { ...draft.kidsClub, hours: v } }),
    ],
    [
      'In-room dining',
      () => draft.ird.hours,
      (v) => ({ ...draft, ird: { ...draft.ird, hours: v } }),
    ],
  ];
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="hours-h">
      <h2 id="hours-h" className="display mb-1 text-2xl">
        Outlet and facility hours
      </h2>
      <p className="mb-5 text-sm text-muted">
        The concierge quotes these exactly. Untick “sample” once a value is confirmed by the hotel.
      </p>
      <div className="space-y-3">
        {draft.outlets.map((o, i) => (
          <div key={o.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor={`on-${o.id}`}>
                Outlet name
              </label>
              <input
                id={`on-${o.id}`}
                className="field py-2"
                value={o.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    outlets: draft.outlets.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor={`oh-${o.id}`}>
                Hours
              </label>
              <input
                id={`oh-${o.id}`}
                className="field py-2"
                value={o.hours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    outlets: draft.outlets.map((x, j) =>
                      j === i ? { ...x, hours: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--accent))]"
                checked={!!o.sample}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    outlets: draft.outlets.map((x, j) =>
                      j === i ? { ...x, sample: e.target.checked } : x,
                    ),
                  })
                }
              />
              sample
            </label>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {facilities.map(([label, get, put]) => (
          <div key={label}>
            <label className="label" htmlFor={`f-${label}`}>
              {label}
            </label>
            <input
              id={`f-${label}`}
              className="field py-2"
              value={get()}
              onChange={(e) => setDraft(put(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          className="btn-primary"
          onClick={() => {
            setKnowledge(draft);
            flash();
          }}
        >
          <Save size={16} aria-hidden /> Save hours
        </button>
        <Saved show={saved} />
      </div>
    </section>
  );
}

function KnowledgeEditor() {
  const k = useStore((s) => s.settings.knowledge);
  const [text, setText] = useState(() => JSON.stringify(k, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, flash] = useFlash();
  useEffect(() => setText(JSON.stringify(k, null, 2)), [k]);
  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setErrors([`Not valid JSON: ${(e as Error).message}`]);
      return;
    }
    const r = KnowledgeSchema.safeParse(parsed);
    if (!r.success) {
      setErrors(r.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`));
      return;
    }
    setErrors([]);
    setKnowledge(r.data);
    flash();
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="kb-h">
      <h2 id="kb-h" className="display mb-1 text-2xl">
        Knowledge base
      </h2>
      <p className="mb-4 text-sm text-muted">
        Everything the concierge is allowed to say: outlets, policies, Wi-Fi, transport, spa and
        dining menus, kids’ club and contacts. It is checked against the schema before saving. Set{' '}
        <code className="rounded bg-raised px-1">"sample": false</code> on a section once its
        content is approved.
      </p>
      <label htmlFor="kb-json" className="sr-only">
        Knowledge base JSON
      </label>
      <textarea
        id="kb-json"
        spellCheck={false}
        className="field h-96 font-mono text-xs leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length ? 'kb-errors' : undefined}
      />
      {errors.length > 0 && (
        <ul
          id="kb-errors"
          role="alert"
          className="mt-3 space-y-1 rounded-xl bg-st-escalated/10 p-3 text-xs text-st-escalated"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={save}>
          <Save size={16} aria-hidden /> Validate and save
        </button>
        <button className="btn-ghost" onClick={download}>
          <Download size={16} aria-hidden /> Download JSON
        </button>
        <button
          className="btn-ghost"
          onClick={() => setText(JSON.stringify(DEFAULT_KNOWLEDGE, null, 2))}
        >
          <RotateCcw size={16} aria-hidden /> Load defaults
        </button>
        <Saved show={saved} />
      </div>
    </section>
  );
}

function DemoData() {
  const [done, flash] = useFlash();
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="demo-h">
      <h2 id="demo-h" className="display mb-1 text-2xl">
        Demo data
      </h2>
      <p className="mb-4 text-sm text-muted">
        Clears the conversation, live tickets and ratings on this device and in every open tab. Your
        settings above are kept.
      </p>
      <div className="flex items-center gap-3">
        <button
          className="btn-ghost"
          onClick={() => {
            resetDemo({ keepSettings: true });
            flash();
          }}
        >
          <RotateCcw size={16} aria-hidden /> Reset demo data
        </button>
        <Saved show={done} />
      </div>
    </section>
  );
}
