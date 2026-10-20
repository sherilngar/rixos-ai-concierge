-- Pilot (phase 2) schema for the Rixos AI Concierge. NOT APPLIED: kept as the design for real per-guest data.
-- Not used by the GitHub Pages proposal demo, which keeps data on the device.
-- Mirrors the in-browser store in src/store/store.ts so screens need no changes.

create extension if not exists pgcrypto;

create table guests (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  title text,
  first_name text not null,
  last_name text not null,
  arrival date not null,
  departure date not null,
  ambassador text,
  language text not null default 'en' check (language in ('en', 'ar')),
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  human_name text,
  handover_reason text,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender text not null check (sender in ('guest', 'ai', 'staff', 'system')),
  staff_name text,
  body text not null,            -- stored after card/passport/ID masking
  lang text not null default 'en',
  cards jsonb,
  created_at timestamptz not null default now()
);

create sequence ticket_number start 1001;

create table tickets (
  id text primary key default ('T-' || nextval('ticket_number')),
  guest_id uuid references guests (id) on delete set null,
  room text not null,
  guest_name text not null,
  department text not null check (department in (
    'frontoffice', 'housekeeping', 'laundry', 'engineering', 'ird', 'restaurants',
    'spa', 'recreation', 'concierge', 'security', 'it', 'dutymanager')),
  also_notify text,
  kind text not null default 'service',
  category text not null,
  item text not null,
  quantity int check (quantity between 1 and 20),
  details text,
  preferred_time text,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'accepted', 'on_the_way', 'done', 'cancelled')),
  assignee text,
  escalation_level smallint not null default 0 check (escalation_level between 0 and 2),
  original_message text,
  language text not null default 'en',
  payload jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  on_the_way_at timestamptz,
  done_at timestamptz,
  cancelled_at timestamptz
);

create table ticket_notes (
  id bigint generated always as identity primary key,
  ticket_id text not null references tickets (id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table ratings (
  ticket_id text primary key references tickets (id) on delete cascade,
  value smallint not null check (value between 1 and 5),
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,          -- 'knowledge', 'standards'
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index tickets_open_by_dept on tickets (department, status) where status not in ('done', 'cancelled');
create index messages_by_conversation on messages (conversation_id, created_at);

-- Row-level security: browsers read only their own guest's data (guest id in the
-- signed JWT claim "guest_id"); staff read through an authenticated "staff" role.
-- All writes go through server functions holding the service-role key.
alter table guests enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table tickets enable row level security;
alter table ticket_notes enable row level security;
alter table ratings enable row level security;
alter table settings enable row level security;

create policy guest_reads_self on guests for select
  using (id::text = auth.jwt() ->> 'guest_id');
create policy guest_reads_conversation on conversations for select
  using (guest_id::text = auth.jwt() ->> 'guest_id');
create policy guest_reads_messages on messages for select
  using (conversation_id in (select id from conversations where guest_id::text = auth.jwt() ->> 'guest_id'));
create policy guest_reads_tickets on tickets for select
  using (guest_id::text = auth.jwt() ->> 'guest_id');

create policy staff_reads_all_tickets on tickets for select
  using (auth.jwt() ->> 'role_name' = 'staff');
create policy staff_reads_notes on ticket_notes for select
  using (auth.jwt() ->> 'role_name' = 'staff');
create policy staff_reads_messages on messages for select
  using (auth.jwt() ->> 'role_name' = 'staff');
create policy anyone_reads_settings on settings for select using (true);

-- Live updates for phones and staff boards.
alter publication supabase_realtime add table messages, tickets, conversations;
