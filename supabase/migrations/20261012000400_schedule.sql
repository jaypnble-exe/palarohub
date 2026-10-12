-- Division schedules and league announcements.
-- Games pair two approved season teams from the same division. Sport comes from the division.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null,
  division_id uuid not null,
  -- season_teams.id: a team's approved participation in this season, not teams.id.
  home_season_team_id uuid not null,
  away_season_team_id uuid not null,
  round smallint check(round between 1 and 200),
  scheduled_at timestamptz,
  venue text not null default '' check(char_length(venue)<=80 and venue=btrim(venue)),
  status text not null default 'scheduled' check(status in('scheduled','postponed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,league_id),
  check(home_season_team_id<>away_season_team_id),
  -- Only a postponed game may wait for a new date.
  check(status='postponed' or scheduled_at is not null),
  foreign key(division_id,league_id,season_id) references public.divisions(id,league_id,season_id) on delete restrict,
  foreign key(home_season_team_id,league_id,season_id) references public.season_teams(id,league_id,season_id) on delete restrict,
  foreign key(away_season_team_id,league_id,season_id) references public.season_teams(id,league_id,season_id) on delete restrict
);
create index games_division_time_idx on public.games(league_id,division_id,scheduled_at);
create index games_season_time_idx on public.games(league_id,season_id,scheduled_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  -- Both null for the whole league; both set for one division.
  season_id uuid,
  division_id uuid,
  title text not null check(char_length(btrim(title)) between 1 and 120),
  body text not null check(char_length(btrim(body)) between 1 and 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((season_id is null)=(division_id is null)),
  foreign key(division_id,league_id,season_id) references public.divisions(id,league_id,season_id) on delete restrict
);
create index announcements_league_recent_idx on public.announcements(league_id,created_at desc);

create function private.guard_game() returns trigger language plpgsql security definer set search_path='' as $$
 begin
  if tg_op='UPDATE' and (new.id<>old.id or new.league_id<>old.league_id or new.season_id<>old.season_id or new.division_id<>old.division_id
   or new.home_season_team_id<>old.home_season_team_id or new.away_season_team_id<>old.away_season_team_id
   or new.round is distinct from old.round or new.created_by<>old.created_by or new.created_at<>old.created_at) then
   raise exception 'game_identity_locked' using errcode='23514';
  end if;
  if tg_op='INSERT' then
   if not exists(select 1 from public.seasons where id=new.season_id and league_id=new.league_id and status='published') then
    raise exception 'published_season_required' using errcode='23514';
   end if;
   if (select count(*) from public.season_teams st where st.league_id=new.league_id and st.season_id=new.season_id and st.division_id=new.division_id
    and st.status='approved' and st.id in(new.home_season_team_id,new.away_season_team_id))<>2 then
    raise exception 'team_not_in_division' using errcode='23514';
   end if;
  end if;
  return new;
 end;
$$;
create trigger games_integrity before insert or update on public.games for each row execute function private.guard_game();

alter table public.games enable row level security;
alter table public.announcements enable row level security;
revoke all on public.games, public.announcements from anon, authenticated;
grant select on public.games to authenticated;
grant select on public.announcements to anon, authenticated;
grant insert(league_id,season_id,division_id,title,body,created_by), update(season_id,division_id,title,body,updated_at), delete on public.announcements to authenticated;
grant all on public.games, public.announcements to service_role;

-- Members see every game; the public reads games through published_games below.
create policy games_member_read on public.games for select to authenticated using(private.staffs_league(league_id) or private.is_league_member(league_id));
create policy announcements_public_read on public.announcements for select to anon, authenticated
using(season_id is null or exists(select 1 from public.seasons s where s.id=season_id and s.league_id=announcements.league_id and s.status='published'));
create policy announcements_member_read on public.announcements for select to authenticated using(private.staffs_league(league_id) or private.is_league_member(league_id));
create policy announcements_staff_insert on public.announcements for insert to authenticated with check(private.staffs_league(league_id) and created_by=(select auth.uid()));
create policy announcements_staff_update on public.announcements for update to authenticated using(private.staffs_league(league_id)) with check(private.staffs_league(league_id));
create policy announcements_staff_delete on public.announcements for delete to authenticated using(private.staffs_league(league_id));

-- Narrow public projection: team-name snapshots only, no creator IDs, published seasons only.
create view public.published_games with(security_barrier=true) as
 select g.id,g.league_id,g.season_id,g.division_id,d.name as division_name,g.round,g.scheduled_at,g.venue,g.status,
  g.home_season_team_id,home.team_name as home_team_name,g.away_season_team_id,away.team_name as away_team_name
 from public.games g
 join public.seasons s on s.id=g.season_id and s.league_id=g.league_id
 join public.divisions d on d.id=g.division_id and d.league_id=g.league_id and d.season_id=g.season_id
 join public.season_teams home on home.id=g.home_season_team_id and home.league_id=g.league_id
 join public.season_teams away on away.id=g.away_season_team_id and away.league_id=g.league_id
 where s.status='published';
revoke all on public.published_games from public, anon, authenticated;
grant select on public.published_games to anon, authenticated;

create function private.validate_game_fields(p_scheduled_at timestamptz,p_venue text) returns void language plpgsql immutable set search_path='' as $$
 begin
  if p_venue is null or char_length(btrim(p_venue))>80 then raise exception 'invalid_venue' using errcode='23514'; end if;
  if p_scheduled_at is not null and p_scheduled_at not between '2000-01-01'::timestamptz and '2200-01-01'::timestamptz then raise exception 'invalid_game_time' using errcode='23514'; end if;
 end;
$$;

-- Saves a whole generated schedule atomically. Replacing is allowed only while
-- every existing game is still unplayed (later game statuses block it).
create function public.save_division_schedule(p_league_id uuid,p_division_id uuid,p_games jsonb,p_replace boolean default false) returns integer language plpgsql security definer set search_path='' as $$
 declare division public.divisions; item jsonb; saved integer:=0; rounds numeric;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into division from public.divisions where id=p_division_id and league_id=p_league_id;
  if division.id is null then raise exception 'division_league_mismatch' using errcode='23503'; end if;
  if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games) not between 1 and 2000 then raise exception 'invalid_schedule' using errcode='23514'; end if;
  if exists(select 1 from public.games where division_id=division.id and league_id=p_league_id) then
   if not coalesce(p_replace,false) then raise exception 'schedule_exists' using errcode='23514'; end if;
   if exists(select 1 from public.games where division_id=division.id and league_id=p_league_id and status not in('scheduled','postponed','cancelled')) then raise exception 'schedule_has_results' using errcode='23514'; end if;
   delete from public.games where division_id=division.id and league_id=p_league_id;
  end if;
  for item in select * from jsonb_array_elements(p_games) loop
   if jsonb_typeof(item) is distinct from 'object' or (item-array['homeTeamId','awayTeamId','round','scheduledAt','venue'])<>'{}'::jsonb
    or jsonb_typeof(item->'round') is distinct from 'number' or jsonb_typeof(item->'scheduledAt') is distinct from 'string' or jsonb_typeof(item->'venue') is distinct from 'string' then
    raise exception 'invalid_schedule' using errcode='23514';
   end if;
   rounds:=(item->>'round')::numeric;
   if rounds<>trunc(rounds) or rounds not between 1 and 200 then raise exception 'invalid_schedule' using errcode='23514'; end if;
   perform private.validate_game_fields((item->>'scheduledAt')::timestamptz,item->>'venue');
   insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,scheduled_at,venue,created_by)
   values(p_league_id,division.season_id,division.id,(item->>'homeTeamId')::uuid,(item->>'awayTeamId')::uuid,rounds::smallint,(item->>'scheduledAt')::timestamptz,btrim(item->>'venue'),auth.uid());
   saved:=saved+1;
  end loop;
  return saved;
 end;
$$;

-- A single extra game, e.g. a make-up game.
create function public.add_game(p_league_id uuid,p_division_id uuid,p_home_season_team_id uuid,p_away_season_team_id uuid,p_scheduled_at timestamptz,p_venue text) returns uuid language plpgsql security definer set search_path='' as $$
 declare division public.divisions; game_id uuid;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into division from public.divisions where id=p_division_id and league_id=p_league_id;
  if division.id is null then raise exception 'division_league_mismatch' using errcode='23503'; end if;
  if p_scheduled_at is null then raise exception 'invalid_game_time' using errcode='23514'; end if;
  perform private.validate_game_fields(p_scheduled_at,p_venue);
  insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,created_by)
  values(p_league_id,division.season_id,division.id,p_home_season_team_id,p_away_season_team_id,p_scheduled_at,btrim(p_venue),auth.uid()) returning id into game_id;
  return game_id;
 end;
$$;

-- Move, postpone, cancel, or restore an unplayed game. Teams never change.
create function public.update_game(p_league_id uuid,p_game_id uuid,p_scheduled_at timestamptz,p_venue text,p_status text) returns void language plpgsql security definer set search_path='' as $$
 declare game public.games;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_status is null or p_status not in('scheduled','postponed','cancelled') then raise exception 'invalid_game_status' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status not in('scheduled','postponed','cancelled') then raise exception 'game_locked' using errcode='23514'; end if;
  perform private.validate_game_fields(p_scheduled_at,p_venue);
  update public.games set scheduled_at=p_scheduled_at,venue=btrim(p_venue),status=p_status,updated_at=now() where id=game.id and league_id=p_league_id;
 end;
$$;

do $$ declare signature text; begin
 foreach signature in array array['private.guard_game()','private.validate_game_fields(timestamptz,text)'] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
 end loop;
 foreach signature in array array[
  'public.save_division_schedule(uuid,uuid,jsonb,boolean)',
  'public.add_game(uuid,uuid,uuid,uuid,timestamptz,text)',
  'public.update_game(uuid,uuid,timestamptz,text,text)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;
