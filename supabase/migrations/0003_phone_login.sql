-- Residents identified by phone number (simulated SMS code in the prototype).
create table residents (
  phone       text primary key,
  created_at  timestamptz not null default now()
);

create table resident_sessions (
  token       uuid primary key default gen_random_uuid(),
  phone       text not null references residents (phone) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table submissions add column phone text references residents (phone) on delete set null;
create index submissions_phone_idx on submissions (phone, created_at desc);

alter table residents enable row level security;
alter table resident_sessions enable row level security;
-- No policies: only Edge Functions (service key) touch these tables.
