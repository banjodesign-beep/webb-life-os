-- Meridian database schema (v2.0)
-- Run once in the Supabase SQL editor. v2.0 uses the same single table as v1;
-- nothing needs to change for the upgrade.

create table if not exists app_data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Single user, no sign-in yet. Locking this to a user id needs sign-in and is
-- planned for v2.1 so it is not bundled with the v2.0 rewrite.
alter table app_data enable row level security;

do $$ begin
  create policy "Allow all" on app_data for all using (true) with check (true);
exception when duplicate_object then null; end $$;
