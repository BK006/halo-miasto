-- Demo data is flagged so it can be wiped in one statement:
--   delete from reports where is_seed;
alter table reports add column is_seed boolean not null default false;
