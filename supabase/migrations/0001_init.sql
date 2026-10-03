-- Halo Miasto: initial schema.
-- Writes go through Next.js API routes using the service role key;
-- the browser only reads (status page, city panel) and listens via Realtime.

create type report_status as enum ('new', 'sent', 'accepted', 'resolved');

create sequence report_no_seq;

create table reports (
  id               uuid primary key default gen_random_uuid(),
  public_no        text not null unique
                   default ('KR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('report_no_seq')::text, 6, '0')),
  category         text not null,
  summary          text not null,
  priority         smallint not null check (priority between 1 and 10),
  priority_reason  text,
  confidence       real,
  has_faces        boolean not null default false,
  has_plates       boolean not null default false,
  plates_needed    boolean not null default false,
  lat              double precision not null,
  lng              double precision not null,
  address          text,
  unit_id          text not null,
  report_text      text not null,
  photo_path       text,
  status           report_status not null default 'new',
  reporters_count  int not null default 1,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index reports_category_created_idx on reports (category, created_at desc);
create index reports_status_idx on reports (status);

-- One row per citizen submission; several submissions can merge into one report.
create table submissions (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references reports (id) on delete cascade,
  user_id          uuid not null,
  photo_path       text,
  consent_version  text not null,
  created_at       timestamptz not null default now()
);

create index submissions_user_created_idx on submissions (user_id, created_at desc);

create table status_history (
  id          bigint generated always as identity primary key,
  report_id   uuid not null references reports (id) on delete cascade,
  status      report_status not null,
  note        text,
  changed_at  timestamptz not null default now()
);

create index status_history_report_idx on status_history (report_id, changed_at);

-- Log the initial status and every later status change; bump updated_at.
create function log_report_status() returns trigger language plpgsql set search_path = public as $$
begin
  insert into status_history (report_id, status) values (new.id, new.status);
  return null;
end $$;

create trigger reports_status_log
  after insert on reports
  for each row execute function log_report_status();

create function touch_report() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into status_history (report_id, status) values (new.id, new.status);
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger reports_status_update
  before update on reports
  for each row execute function touch_report();

-- Open duplicate of the same category within radius_m metres and window_h hours.
create function find_duplicate(p_category text, p_lat double precision, p_lng double precision,
                               radius_m double precision, window_h int)
returns uuid language sql stable set search_path = public as $$
  select id from reports
  where category = p_category
    and status <> 'resolved'
    and created_at > now() - make_interval(hours => window_h)
    and 6371000 * 2 * asin(sqrt(
          power(sin(radians(lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(lat)) * power(sin(radians(lng - p_lng) / 2), 2)
        )) <= radius_m
  order by created_at desc
  limit 1
$$;

-- RLS: public read for the prototype (status page + panel), no client writes.
alter table reports enable row level security;
alter table submissions enable row level security;
alter table status_history enable row level security;

create policy "reports readable" on reports for select using (true);
create policy "history readable" on status_history for select using (true);
-- submissions: no policies → only the service role can read/write.

alter publication supabase_realtime add table reports, status_history;

-- Private bucket for photos; served via signed URLs from the server.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;
