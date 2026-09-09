-- Locations table + security.
-- Readings are inserted ONLY by the Edge Function (service role, which bypasses
-- RLS). The public page never talks to this table directly.

create table if not exists public.locations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  lat              double precision not null,
  lng              double precision not null,
  accuracy         double precision,
  address          text,
  map_url          text,
  is_vpn           boolean,
  inside_bangalore boolean,
  ip_city          text,
  ip_country       text,
  user_agent       text
);

alter table public.locations enable row level security;

-- Anyone not logged in gets nothing. Only authenticated dashboard users can read.
-- (Disable public sign-ups in Auth settings so only YOUR account exists.)
drop policy if exists "authenticated can read locations" on public.locations;
create policy "authenticated can read locations"
  on public.locations for select
  to authenticated
  using (true);

-- No insert/update/delete policies => anon and authenticated clients cannot
-- write. Inserts come from the Edge Function using the service-role key.

-- Live updates on the dashboard.
alter publication supabase_realtime add table public.locations;
