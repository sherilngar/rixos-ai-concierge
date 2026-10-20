-- Applied to the "so-ai-concierge" Supabase project (Mumbai, ap-south-1). The Rixos copy uses the same table with its own record id (rixos-live).
-- Shared state for the proposal demo, so a guest phone and a staff laptop see the same data.
-- The browser holds only the publishable key: it can read the demo row and write through
-- commit_demo_state, which checks the revision (compare-and-swap), shape and size.

create table public.demo_state (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  rev bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.demo_state enable row level security;

create policy "demo state is readable" on public.demo_state
  for select to anon, authenticated using (true);

create or replace function public.commit_demo_state(p_id text, p_expected_rev bigint, p_state jsonb)
returns table (ok boolean, rev bigint, state jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'invalid demo id';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'state must be an object';
  end if;
  if pg_column_size(p_state) > 500000 then
    raise exception 'state too large';
  end if;

  insert into demo_state (id) values (p_id) on conflict (id) do nothing;

  update demo_state d
     set rev = d.rev + 1, state = p_state, updated_at = now()
   where d.id = p_id and d.rev = p_expected_rev;

  if found then
    return query select true, d.rev, null::jsonb from demo_state d where d.id = p_id;
  else
    return query select false, d.rev, d.state from demo_state d where d.id = p_id;
  end if;
end;
$$;

revoke all on function public.commit_demo_state(text, bigint, jsonb) from public;
grant execute on function public.commit_demo_state(text, bigint, jsonb) to anon, authenticated;

alter publication supabase_realtime add table public.demo_state;
