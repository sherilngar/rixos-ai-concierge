import { useSyncExternalStore } from 'react';

/**
 * Which guest is signed in on this device. Kept per device (not in the shared
 * state), so a phone stays signed in as its own guest while staff use laptops.
 */
const KEY = 'rixos-guest-session';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current = typeof window === 'undefined' ? null : read();

export function setGuestSession(guestId: string | null) {
  current = guestId;
  try {
    if (guestId) localStorage.setItem(KEY, guestId);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
  listeners.forEach((l) => l());
}

export function useGuestSession(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => current,
  );
}
