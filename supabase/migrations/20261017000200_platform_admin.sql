-- Platform admin: see every league, manage commissioners and staff, pause a
-- league, and look up users. Every function checks private.is_platform_admin().

-- The platform admin pages live at /admin/new and /admin/users.
alter table public.leagues add constraint leagues_slug_reserved_admin check (slug not in ('new', 'users'));

-- 1. Pausing a league hides it from the public and stops registration.
-- Nothing is deleted; members still see it and unpausing restores everything.
alter table public.leagues add column paused_at timestamptz;
alter table public.leagues add column paused_reason text not null default ''
  check (char_length(paused_reason) <= 500);

drop policy leagues_public_read on public.leagues;
create policy leagues_public_read on public.leagues for select to anon using (paused_at is null);
create policy leagues_signed_in_read on public.leagues for select to authenticated
using (paused_at is null or (select private.is_platform_admin()) or private.is_league_member(id));

create function private.league_paused(target_league uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leagues where id = target_league and paused_at is not null);
$$;

-- Team managers cannot register or change rosters while the league is paused.
create function private.guard_paused_league() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.league_paused(new.league_id) and not private.staffs_league(new.league_id) then
    raise exception 'league_paused' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger paused_league_registrations before insert or update on public.season_teams
  for each row execute function private.guard_paused_league();
create trigger paused_league_rosters before insert or update on public.roster_entries
  for each row execute function private.guard_paused_league();

-- 2. A permanent record of what the platform admin changed.
create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  action text not null check (action in ('member_added', 'member_removed', 'commissioner_replaced', 'league_paused', 'league_resumed')),
  target_user_id uuid references public.profiles(id) on delete restrict,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index platform_audit_log_league_idx on public.platform_audit_log(league_id, created_at desc);
create trigger platform_audit_log_append_only before update or delete on public.platform_audit_log
  for each row execute function private.append_only_history();
alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;
grant all on public.platform_audit_log to service_role;
create policy platform_audit_log_admin_read on public.platform_audit_log for select to authenticated
using ((select private.is_platform_admin()));

create function private.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
end;
$$;

-- 3. Overview numbers for the whole platform.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'leagues', (select count(*) from public.leagues),
    'pausedLeagues', (select count(*) from public.leagues where paused_at is not null),
    'teams', (select count(*) from public.teams),
    'players', (select count(*) from public.players),
    'users', (select count(*) from public.profiles),
    'gamesThisWeek', (select count(*) from public.games
      where status <> 'cancelled' and scheduled_at >= date_trunc('week', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
        and scheduled_at < (date_trunc('week', now() at time zone 'Asia/Riyadh') + interval '7 days') at time zone 'Asia/Riyadh'),
    'gamesLive', (select count(*) from public.games where status = 'in_progress'),
    'gamesWaiting', (select count(*) from public.games where status = 'submitted')
  );
end;
$$;

-- 4. Every league with its people and activity.
create function public.admin_leagues() returns table (
  id uuid, slug text, name text, sport text, created_at timestamptz,
  paused_at timestamptz, paused_reason text,
  commissioners jsonb, staff_count integer,
  current_season text, teams integer, games_played integer, games_live integer,
  last_activity timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select l.id, l.slug, l.name, l.sport, l.created_at, l.paused_at, l.paused_reason,
    coalesce((select jsonb_agg(jsonb_build_object('userId', u.id, 'email', u.email, 'name', p.display_name) order by m.created_at)
      from public.league_members m join auth.users u on u.id = m.user_id join public.profiles p on p.id = m.user_id
      where m.league_id = l.id and m.role = 'commissioner'), '[]'::jsonb),
    (select count(*)::integer from public.league_members m where m.league_id = l.id and m.role = 'league_staff'),
    (select s.name from public.seasons s where s.league_id = l.id
      order by (s.status = 'published') desc, s.start_date desc limit 1),
    (select count(*)::integer from public.teams t where t.league_id = l.id),
    (select count(*)::integer from public.games g where g.league_id = l.id and g.status = 'approved'),
    (select count(*)::integer from public.games g where g.league_id = l.id and g.status = 'in_progress'),
    greatest(l.created_at,
      (select max(e.created_at) from public.game_events e where e.league_id = l.id),
      (select max(g.updated_at) from public.games g where g.league_id = l.id),
      (select max(st.created_at) from public.season_teams st where st.league_id = l.id),
      (select max(s.created_at) from public.seasons s where s.league_id = l.id))
  from public.leagues l
  order by l.name;
end;
$$;

-- 5. Everyone with a role in one league.
create function public.admin_league_members(p_league_id uuid) returns table (
  user_id uuid, email text, display_name text, role public.league_role, created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select m.user_id, u.email::text, p.display_name, m.role, m.created_at, u.last_sign_in_at
  from public.league_members m
  join auth.users u on u.id = m.user_id
  join public.profiles p on p.id = m.user_id
  where m.league_id = p_league_id
  order by m.role, lower(p.display_name), u.email;
end;
$$;

create function private.user_by_email(p_email text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare found uuid;
begin
  select id into found from auth.users where lower(email) = lower(btrim(p_email));
  if found is null then raise exception 'user_not_found' using errcode = 'P0001'; end if;
  return found;
end;
$$;

-- 6. Adding and removing people.
create function public.admin_add_member(p_league_id uuid, p_email text, p_role public.league_role) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  perform private.require_platform_admin();
  if p_role not in ('commissioner', 'league_staff') then raise exception 'invalid_role' using errcode = '23514'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id) then raise exception 'league_not_found' using errcode = 'P0001'; end if;
  target := private.user_by_email(p_email);
  insert into public.league_members (league_id, user_id, role) values (p_league_id, target, p_role)
  on conflict do nothing;
  if found then
    insert into public.platform_audit_log (league_id, action, target_user_id, detail, actor_id)
    values (p_league_id, 'member_added', target, jsonb_build_object('role', p_role), auth.uid());
  end if;
  return target;
end;
$$;

create function public.admin_remove_member(p_league_id uuid, p_user_id uuid, p_role public.league_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_role = 'commissioner' and not exists (
    select 1 from public.league_members where league_id = p_league_id and role = 'commissioner' and user_id <> p_user_id
  ) then
    raise exception 'last_commissioner' using errcode = '23514';
  end if;
  delete from public.league_members where league_id = p_league_id and user_id = p_user_id and role = p_role;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  insert into public.platform_audit_log (league_id, action, target_user_id, detail, actor_id)
  values (p_league_id, 'member_removed', p_user_id, jsonb_build_object('role', p_role), auth.uid());
end;
$$;

-- Hands the league to a new commissioner in one step; the previous ones lose that role.
create function public.admin_replace_commissioner(p_league_id uuid, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid; previous jsonb;
begin
  perform private.require_platform_admin();
  if not exists (select 1 from public.leagues where id = p_league_id) then raise exception 'league_not_found' using errcode = 'P0001'; end if;
  target := private.user_by_email(p_email);
  select coalesce(jsonb_agg(user_id), '[]'::jsonb) into previous
  from public.league_members where league_id = p_league_id and role = 'commissioner' and user_id <> target;
  insert into public.league_members (league_id, user_id, role) values (p_league_id, target, 'commissioner')
  on conflict do nothing;
  delete from public.league_members where league_id = p_league_id and role = 'commissioner' and user_id <> target;
  insert into public.platform_audit_log (league_id, action, target_user_id, detail, actor_id)
  values (p_league_id, 'commissioner_replaced', target, jsonb_build_object('previous', previous), auth.uid());
  return target;
end;
$$;

-- 7. Pause and resume.
create function public.admin_set_league_paused(p_league_id uuid, p_paused boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_paused and char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '23514'; end if;
  update public.leagues set
    paused_at = case when p_paused then coalesce(paused_at, now()) end,
    paused_reason = case when p_paused then btrim(p_reason) else '' end
  where id = p_league_id;
  if not found then raise exception 'league_not_found' using errcode = 'P0001'; end if;
  insert into public.platform_audit_log (league_id, action, detail, actor_id)
  values (p_league_id, case when p_paused then 'league_paused' else 'league_resumed' end,
    jsonb_build_object('reason', btrim(coalesce(p_reason, ''))), auth.uid());
end;
$$;

-- 8. Look up users by email or name, with every league role they hold.
create function public.admin_find_users(p_query text) returns table (
  user_id uuid, email text, display_name text, created_at timestamptz,
  email_confirmed_at timestamptz, last_sign_in_at timestamptz, is_platform_admin boolean,
  memberships jsonb, managed_teams jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare needle text := lower(btrim(coalesce(p_query, '')));
begin
  perform private.require_platform_admin();
  if char_length(needle) < 3 then raise exception 'query_too_short' using errcode = '23514'; end if;
  return query
  select u.id, u.email::text, p.display_name, u.created_at, u.email_confirmed_at, u.last_sign_in_at, p.is_platform_admin,
    coalesce((select jsonb_agg(jsonb_build_object('leagueId', l.id, 'slug', l.slug, 'league', l.name, 'role', m.role) order by l.name, m.role)
      from public.league_members m join public.leagues l on l.id = m.league_id where m.user_id = u.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('team', t.name, 'league', l.name) order by l.name, t.name)
      from public.teams t join public.leagues l on l.id = t.league_id where t.manager_id = u.id), '[]'::jsonb)
  from auth.users u
  join public.profiles p on p.id = u.id
  where strpos(lower(u.email), needle) > 0 or strpos(lower(p.display_name), needle) > 0
  order by u.email
  limit 25;
end;
$$;

-- Recent admin changes for one league.
create function public.admin_league_log(p_league_id uuid) returns table (
  id uuid, action text, detail jsonb, created_at timestamptz, target_email text, actor_email text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select a.id, a.action, a.detail, a.created_at, tu.email::text, au.email::text
  from public.platform_audit_log a
  left join auth.users tu on tu.id = a.target_user_id
  left join auth.users au on au.id = a.actor_id
  where a.league_id = p_league_id
  order by a.created_at desc
  limit 30;
end;
$$;

revoke all on function private.league_paused(uuid), private.guard_paused_league(), private.require_platform_admin(), private.user_by_email(text) from public, anon, authenticated;
grant execute on function private.league_paused(uuid) to authenticated;
revoke all on function public.admin_overview(), public.admin_leagues(), public.admin_league_members(uuid),
  public.admin_add_member(uuid, text, public.league_role), public.admin_remove_member(uuid, uuid, public.league_role),
  public.admin_replace_commissioner(uuid, text), public.admin_set_league_paused(uuid, boolean, text),
  public.admin_find_users(text), public.admin_league_log(uuid) from public, anon;
grant execute on function public.admin_overview(), public.admin_leagues(), public.admin_league_members(uuid),
  public.admin_add_member(uuid, text, public.league_role), public.admin_remove_member(uuid, uuid, public.league_role),
  public.admin_replace_commissioner(uuid, text), public.admin_set_league_paused(uuid, boolean, text),
  public.admin_find_users(text), public.admin_league_log(uuid) to authenticated;
