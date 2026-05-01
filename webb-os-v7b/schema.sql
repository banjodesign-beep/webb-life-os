-- Webb Life OS — Database Schema
-- Run this once in your Supabase SQL Editor

create table if not exists app_data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Allow all access (single user, no auth required)
alter table app_data enable row level security;

create policy "Allow all" on app_data
  for all
  using (true)
  with check (true);
