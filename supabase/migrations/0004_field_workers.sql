-- Field workers: the city panel assigns a report, the worker fixes it in the field,
-- adds an "after" photo and closes it. Workers sign in with their phone number.

create table workers (
  phone       text primary key,
  name        text not null,
  unit_id     text not null,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table reports
  add column assigned_to     text references workers (phone) on delete set null,
  add column assigned_at     timestamptz,
  add column resolution_photo_path text,
  add column resolution_note text,
  add column resolved_at     timestamptz;

create index reports_assigned_idx on reports (assigned_to, status);

alter table workers enable row level security;
-- No policies: only Edge Functions (service key) read or write workers.

-- Demo crew (sign in at /pracownik with code 123-123).
insert into workers (phone, name, unit_id, is_seed) values
  ('+48500100100', 'Jan Kowalski', 'zdmk', true),
  ('+48500200200', 'Anna Nowak', 'sm', true),
  ('+48500300300', 'Piotr Wiśniewski', 'mpo', true)
on conflict (phone) do nothing;
