create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.league_role as enum ('commissioner', 'league_staff', 'team_manager');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  is_platform_admin boolean not null default false
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  sport text not null default 'basketball' check (sport in ('basketball')),
  logo_url text,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  constraint leagues_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 63),
  constraint leagues_slug_reserved check (slug not in ('admin', 'team', 'score', 'tv', 'api', 'login', 'auth', 'leagues'))
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.league_role not null,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, role)
);
create index league_members_user_id_idx on public.league_members(user_id, league_id);

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_platform_admin);
$$;

create function private.is_league_member(league_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.league_members m where m.league_id = $1 and m.user_id = (select auth.uid()));
$$;

create function private.has_league_role(league_id uuid, role public.league_role)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.league_members m where m.league_id = $1 and m.user_id = (select auth.uid()) and m.role = $2);
$$;

create function private.shares_league(user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.league_members own_member
    join public.league_members other_member on other_member.league_id = own_member.league_id
    where own_member.user_id = (select auth.uid()) and other_member.user_id = $1
  );
$$;

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- Backfill safely if auth users existed before this first application migration.
insert into public.profiles (id, display_name, avatar_url)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''), raw_user_meta_data ->> 'avatar_url'
from auth.users on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

-- Explicit table and column privileges prevent self-promotion and changes to row identity.
revoke all on public.profiles, public.leagues, public.league_members from anon, authenticated;
grant select on public.leagues to anon, authenticated;
grant insert, delete on public.leagues to authenticated;
grant update (slug, name, sport, logo_url, settings) on public.leagues to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.league_members to authenticated;
grant all on public.profiles, public.leagues, public.league_members to service_role;
grant usage on type public.league_role to authenticated, service_role;

create policy leagues_public_read on public.leagues for select to anon, authenticated using (true);
create policy leagues_admin_insert on public.leagues for insert to authenticated with check ((select private.is_platform_admin()));
create policy leagues_authorized_update on public.leagues for update to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(id, 'commissioner'))
with check ((select private.is_platform_admin()) or private.has_league_role(id, 'commissioner'));
create policy leagues_admin_delete on public.leagues for delete to authenticated using ((select private.is_platform_admin()));

create policy members_read on public.league_members for select to authenticated
using ((select private.is_platform_admin()) or private.is_league_member(league_id));
create policy members_insert on public.league_members for insert to authenticated
with check ((select private.is_platform_admin()) or private.has_league_role(league_id, 'commissioner'));
create policy members_update on public.league_members for update to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(league_id, 'commissioner'))
with check ((select private.is_platform_admin()) or private.has_league_role(league_id, 'commissioner'));
create policy members_delete on public.league_members for delete to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(league_id, 'commissioner'));

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_platform_admin()) or private.shares_league(id));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_platform_admin()))
with check (id = (select auth.uid()) or (select private.is_platform_admin()));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_platform_admin(), private.is_league_member(uuid), private.has_league_role(uuid, public.league_role), private.shares_league(uuid) to authenticated;

-- This deliberately exposed RPC authorizes the caller before reading auth.users.
-- It is the only privileged application mutation and assigns the exact newly-created league.
create function public.create_league_with_commissioner(
  league_name text, league_slug text, league_sport text, commissioner_email text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  commissioner_id uuid;
  new_league_id uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  select id into commissioner_id from auth.users where lower(email) = lower(btrim(commissioner_email));
  if commissioner_id is null then
    raise exception 'commissioner_not_found' using errcode = 'P0001';
  end if;
  insert into public.leagues (name, slug, sport)
  values (btrim(league_name), league_slug, league_sport) returning id into new_league_id;
  insert into public.league_members (league_id, user_id, role)
  values (new_league_id, commissioner_id, 'commissioner');
  return new_league_id;
end;
$$;
revoke all on function public.create_league_with_commissioner(text, text, text, text) from public, anon;
grant execute on function public.create_league_with_commissioner(text, text, text, text) to authenticated;
