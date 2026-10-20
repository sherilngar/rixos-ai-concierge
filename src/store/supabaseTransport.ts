import type { Transport } from './remote';

/**
 * Public project settings. The publishable key is designed to be shipped to
 * browsers; the database only allows reading the demo row and writing through
 * the checked commit function (see supabase/migrations/0002_demo_state_sync.sql).
 */
export const SUPABASE_URL = 'https://lqgygvswwkskkkyzimni.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Bz68qiXjRyGGMac6eeEClw_GNvBw8ox';
// Bumped with each change to the data's shape, so tabs still running an older version cannot overwrite it.
export const DEMO_ID = 'rixos-live-2';

/** Cross-device sync is on unless the build or the URL turns it off (`?local`). */
export function syncEnabled(): boolean {
  if (import.meta.env.VITE_SYNC === 'off') return false;
  if (typeof window === 'undefined') return false;
  return !new URLSearchParams(window.location.search).has('local');
}

export async function createSupabaseTransport(): Promise<Transport> {
  // Loaded on demand so the first paint does not wait for the database client.
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async load() {
      const { data, error } = await client
        .from('demo_state')
        .select('rev, state')
        .eq('id', DEMO_ID)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { rev: 0, state: null };
      const empty = !data.state || Object.keys(data.state as object).length === 0;
      return { rev: Number(data.rev), state: empty ? null : data.state };
    },
    async commit(expectedRev, state) {
      const { data, error } = await client.rpc('commit_demo_state', {
        p_id: DEMO_ID,
        p_expected_rev: expectedRev,
        p_state: state,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { ok: boolean; rev: number; state: unknown }
        | undefined;
      if (!row) throw new Error('No response from commit_demo_state');
      return { ok: row.ok, rev: Number(row.rev), state: row.state ?? null };
    },
    subscribe(onChange, onStatus) {
      const channel = client
        .channel(`demo-${DEMO_ID}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'demo_state', filter: `id=eq.${DEMO_ID}` },
          (payload) => {
            const row = payload.new as { rev?: number; state?: unknown } | undefined;
            // Large rows can arrive without their fields; force a reload in that case.
            if (row?.rev === undefined) return onChange(Number.MAX_SAFE_INTEGER, null);
            const hasState =
              row.state && typeof row.state === 'object' && Object.keys(row.state).length > 0;
            onChange(Number(row.rev), hasState ? row.state! : null);
          },
        )
        .subscribe((status) => onStatus(status === 'SUBSCRIBED'));
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
