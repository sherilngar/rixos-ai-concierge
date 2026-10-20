import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Languages, Lock } from 'lucide-react';
import { strings } from '../../i18n/strings';
import { DEMO_GUEST_ID } from '../../data/demo';
import { findStay, guestById, signInGuest, useStore } from '../../store/store';
import { setGuestSession } from '../../store/guestSession';
import { Logo } from '../ui/Logo';
import { SyncBadge } from '../ui/SyncBadge';
import { ThemeToggle } from '../ui/ThemeToggle';

const LANG_KEY = 'rixos-guest-lang';

function initialLang(): 'en' | 'ar' {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('ar') ? 'ar' : 'en';
}

/**
 * How a guest gets in: room number + surname, checked against the in-house list the
 * front office keeps (and, later, the property management system). A QR code in the
 * room can carry the room number (#/guest?room=1207) so only the surname is typed.
 */
export function GuestSignIn({ stayEnded = false }: { stayEnded?: boolean }) {
  const [params] = useSearchParams();
  const [lang, setLang] = useState<'en' | 'ar'>(initialLang);
  const [room, setRoom] = useState(() => params.get('room') ?? '');
  const [surname, setSurname] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const t = strings(lang);
  // The demo shortcut disappears once the front office checks the sample guest out.
  const demoAvailable = useStore((s) => {
    const g = guestById(s, DEMO_GUEST_ID);
    return !!g && !g.checkedOutAt;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, [lang]);

  const enter = (guestId: string) => {
    signInGuest(guestId, lang);
    setGuestSession(guestId);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError(t.needConsent);
      return;
    }
    const guest = findStay(room, surname);
    if (!guest) {
      setError(t.notFound);
      return;
    }
    enter(guest.id);
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      lang={lang}
      data-testid="guest-sign-in"
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-bg px-5 safe-top sm:border-x sm:border-line/60"
    >
      <header className="flex items-center gap-2 pt-3">
        <Logo className="h-8" />
        <div className="ms-auto flex items-center gap-1">
          <SyncBadge compact />
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-muted hover:bg-raised hover:text-fg"
            aria-label={`${t.language}: ${t.languageLabel}`}
          >
            <Languages size={16} aria-hidden /> {t.language}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-1 flex-col justify-center py-10"
      >
        <h1 className="display mb-3 text-4xl">{t.signInTitle}</h1>
        {stayEnded ? (
          <p className="mb-8 rounded-xl bg-raised px-4 py-3 text-sm" role="status">
            {t.stayEnded}
          </p>
        ) : (
          <p className="mb-8 text-muted">{t.signInIntro}</p>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="si-room">
              {t.roomNumber}
            </label>
            <input
              id="si-room"
              className="field text-lg tracking-wide"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={room}
              dir="ltr"
              onChange={(e) => {
                setRoom(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="si-surname">
              {t.surname}
            </label>
            <input
              id="si-surname"
              className="field text-lg"
              autoComplete="family-name"
              autoCapitalize="words"
              maxLength={60}
              value={surname}
              onChange={(e) => {
                setSurname(e.target.value);
                setError('');
              }}
              required
            />
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setError('');
              }}
            />
            <span>{t.consent}</span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-st-escalated/10 px-3 py-2 text-sm text-st-escalated"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary w-full text-base"
            disabled={!room || !surname}
          >
            {t.signInButton} <ArrowRight size={16} aria-hidden className="rtl:-scale-x-100" />
          </button>
        </form>

        <p className="mt-6 flex gap-2 rounded-xl bg-raised/70 px-3 py-3 text-xs leading-relaxed text-muted">
          <Lock size={14} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          {t.privacyLong}
        </p>
      </motion.main>

      <footer className="pb-6 text-center safe-bottom">
        {demoAvailable && (
          <button
            type="button"
            onClick={() => enter(DEMO_GUEST_ID)}
            className="min-h-[44px] text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            data-testid="demo-guest"
          >
            {t.demoShortcut}
          </button>
        )}
      </footer>
    </div>
  );
}
