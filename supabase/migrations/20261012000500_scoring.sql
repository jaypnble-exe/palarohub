-- Scorer access and the append-only game event log.
-- Scorers need no account: their device signs in anonymously and a per-game PIN
-- makes it the official scorer device for that one game.

create function private.is_anonymous() returns boolean language sql stable set search_path='' as $$
 select coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
$$;
revoke all on function private.is_anonymous() from public,anon;
grant execute on function private.is_anonymous() to authenticated;

-- Anonymous scorer sessions must never enroll in a league.
create or replace function public.join_league_registration(p_league_id uuid,p_season_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
  if auth.uid() is null or private.is_anonymous() then raise exception 'sign_in_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.registration_settings rs join public.seasons s on s.id=rs.season_id and s.league_id=rs.league_id where rs.league_id=p_league_id and rs.season_id=p_season_id and rs.is_open and rs.deadline>statement_timestamp() and s.status='published') then raise exception 'registration_closed' using errcode='23514'; end if;
  insert into public.league_members(league_id,user_id,role) values(p_league_id,auth.uid(),'team_manager') on conflict(league_id,user_id,role) do nothing;
 end;
$$;

-- in_progress: events are being recorded. submitted/approved arrive with game review.
alter table public.games drop constraint games_status_check;
alter table public.games add constraint games_status_check check(status in('scheduled','postponed','cancelled','in_progress','submitted','approved'));

create table public.game_scorer_access (
  game_id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  pin_salt text not null,
  pin_hash text not null,
  expires_at timestamptz not null,
  failed_attempts smallint not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);

create table public.game_scorers (
  game_id uuid not null,
  league_id uuid not null references public.leagues(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(game_id,user_id),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);
-- One official scorer device per game.
create unique index game_scorers_one_active_idx on public.game_scorers(game_id) where revoked_at is null;

create table public.game_events (
  id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  game_id uuid not null,
  sequence integer not null check(sequence between 1 and 100000),
  type text not null check(type ~ '^[a-z][a-z_]{0,31}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8192),
  clock_ms integer check(clock_ms between 0 and 3600000),
  period smallint check(period between 0 and 50),
  -- Device time when the action happened; created_at is when the server stored it.
  occurred_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(game_id,sequence),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);
create index game_events_game_idx on public.game_events(league_id,game_id,sequence);
create trigger game_events_append_only before update or delete on public.game_events for each row execute function private.append_only_history();

create function private.scores_game(target_game uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.game_scorers s where s.game_id=target_game and s.user_id=auth.uid() and s.revoked_at is null);
$$;

alter table public.game_scorer_access enable row level security;
alter table public.game_scorers enable row level security;
alter table public.game_events enable row level security;
revoke all on public.game_scorer_access, public.game_scorers, public.game_events from anon, authenticated;
-- The PIN hash and salt are never readable by clients.
grant select(game_id,league_id,expires_at,failed_attempts,created_at) on public.game_scorer_access to authenticated;
grant select on public.game_scorers, public.game_events to authenticated;
grant all on public.game_scorer_access, public.game_scorers, public.game_events to service_role;

create policy scorer_access_staff_read on public.game_scorer_access for select to authenticated using(private.staffs_league(league_id));
create policy scorers_read on public.game_scorers for select to authenticated using(private.staffs_league(league_id) or user_id=auth.uid());
create policy game_events_read on public.game_events for select to authenticated
using(private.staffs_league(league_id) or (private.is_league_member(league_id) and not private.is_anonymous()) or private.scores_game(game_id));
create policy games_scorer_read on public.games for select to authenticated using(private.scores_game(id));

-- Returns the 6-digit PIN once; only a salted hash is stored. A new PIN
-- replaces the old one but does not remove the current scorer device.
create function public.create_scorer_pin(p_league_id uuid,p_game_id uuid) returns text language plpgsql security definer set search_path='' as $$
 declare game public.games; pin text; salt text;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status not in('scheduled','in_progress') then raise exception 'game_not_open' using errcode='23514'; end if;
  -- gen_random_uuid() uses a cryptographic random source.
  pin:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%1000000)::text,6,'0');
  salt:=replace(gen_random_uuid()::text,'-','');
  insert into public.game_scorer_access(game_id,league_id,pin_salt,pin_hash,expires_at,created_by)
  values(game.id,p_league_id,salt,encode(sha256(convert_to(salt||pin,'UTF8')),'hex'),now()+interval '24 hours',auth.uid())
  on conflict(game_id) do update set pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,expires_at=excluded.expires_at,failed_attempts=0,created_by=excluded.created_by,created_at=now();
  return pin;
 end;
$$;

-- Makes the caller's device the official scorer. Staff need no PIN. Returns
-- 'granted', 'invalid', 'locked', 'expired', or 'closed' (no exception, so a
-- failed attempt is still counted).
create function public.claim_scorer_access(p_game_id uuid,p_pin text default null) returns text language plpgsql security definer set search_path='' as $$
 declare game public.games; access public.game_scorer_access;
 begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select * into game from public.games where id=p_game_id for update;
  if game.id is null then return 'invalid'; end if;
  if game.status not in('scheduled','in_progress') then return 'closed'; end if;
  if not(private.staffs_league(game.league_id) and not private.is_anonymous()) then
   select * into access from public.game_scorer_access where game_id=game.id for update;
   if access.game_id is null then return 'invalid'; end if;
   if access.failed_attempts>=10 then return 'locked'; end if;
   if access.expires_at<=now() then return 'expired'; end if;
   if p_pin is null or p_pin !~ '^\d{6}$' or encode(sha256(convert_to(access.pin_salt||p_pin,'UTF8')),'hex')<>access.pin_hash then
    update public.game_scorer_access set failed_attempts=failed_attempts+1 where game_id=game.id;
    return case when access.failed_attempts+1>=10 then 'locked' else 'invalid' end;
   end if;
  end if;
  update public.game_scorers set revoked_at=now() where game_id=game.id and revoked_at is null and user_id<>auth.uid();
  insert into public.game_scorers(game_id,league_id,user_id) values(game.id,game.league_id,auth.uid())
  on conflict(game_id,user_id) do update set revoked_at=null,granted_at=now();
  return 'granted';
 end;
$$;

-- Everything the scorer screen caches for offline use: game, rules, and the
-- approved roster snapshot of both teams.
create function public.scorer_game_setup(p_game_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare game public.games; division public.divisions; season public.seasons;
 begin
  select * into game from public.games where id=p_game_id;
  if game.id is null or auth.uid() is null or not(private.scores_game(game.id) or private.staffs_league(game.league_id)) then raise exception 'scorer_required' using errcode='42501'; end if;
  select * into division from public.divisions where id=game.division_id and league_id=game.league_id;
  select * into season from public.seasons where id=game.season_id and league_id=game.league_id;
  return jsonb_build_object(
   'gameId',game.id,'leagueId',game.league_id,
   'leagueName',(select name from public.leagues where id=game.league_id),
   'seasonName',season.name,'divisionName',division.name,
   'sport',division.sport,'rules',coalesce(division.rules,season.rules),
   'scheduledAt',game.scheduled_at,'venue',game.venue,'status',game.status,
   'teams',(select jsonb_object_agg(side.name,jsonb_build_object(
     'seasonTeamId',st.id,'name',st.team_name,
     'players',coalesce((select jsonb_agg(jsonb_build_object('playerId',re.player_id,'name',re.player_name,'jersey',re.jersey_number) order by re.jersey_number,re.player_name)
       from public.roster_entries re where re.registration_id=st.id and re.league_id=game.league_id and re.active and re.accepted_at is not null),'[]'::jsonb)))
    from (values('home',game.home_season_team_id),('away',game.away_season_team_id)) as side(name,season_team_id)
    join public.season_teams st on st.id=side.season_team_id and st.league_id=game.league_id));
 end;
$$;

-- Saves a batch atomically. Re-sending the same events is harmless; an
-- event that reuses an id or sequence with different content is refused.
create function public.record_game_events(p_game_id uuid,p_events jsonb) returns integer language plpgsql security definer set search_path='' as $$
 declare game public.games; item jsonb; existing public.game_events; saved integer:=0;
 begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select * into game from public.games where id=p_game_id for update;
  if game.id is null or not private.scores_game(game.id) then raise exception 'scorer_required' using errcode='42501'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 500 then raise exception 'invalid_events' using errcode='23514'; end if;
  for item in select * from jsonb_array_elements(p_events) loop
   if jsonb_typeof(item) is distinct from 'object' or (item-array['id','sequence','type','payload','clockMs','period','occurredAt'])<>'{}'::jsonb
    or jsonb_typeof(item->'sequence') is distinct from 'number' or jsonb_typeof(item->'type') is distinct from 'string' or jsonb_typeof(item->'payload') is distinct from 'object'
    or jsonb_typeof(item->'occurredAt') is distinct from 'string' or coalesce(jsonb_typeof(item->'clockMs'),'null') not in('number','null') or coalesce(jsonb_typeof(item->'period'),'null') not in('number','null') then
    raise exception 'invalid_events' using errcode='23514';
   end if;
   select * into existing from public.game_events where id=(item->>'id')::uuid;
   if existing.id is not null then
    if existing.game_id<>game.id or existing.sequence<>(item->>'sequence')::integer or existing.type<>item->>'type' or existing.payload<>item->'payload' then
     raise exception 'event_conflict' using errcode='23505';
    end if;
    continue;
   end if;
   if game.status not in('scheduled','in_progress') then raise exception 'game_not_open' using errcode='23514'; end if;
   if exists(select 1 from public.game_events where game_id=game.id and sequence=(item->>'sequence')::integer) then raise exception 'sequence_conflict' using errcode='23505'; end if;
   insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
   values((item->>'id')::uuid,game.league_id,game.id,(item->>'sequence')::integer,item->>'type',item->'payload',(item->>'clockMs')::integer,(item->>'period')::smallint,(item->>'occurredAt')::timestamptz,auth.uid());
   saved:=saved+1;
  end loop;
  if saved>0 and game.status='scheduled' then update public.games set status='in_progress',updated_at=now() where id=game.id; end if;
  return saved;
 end;
$$;

do $$ declare signature text; begin
 revoke all on function private.scores_game(uuid) from public,anon,authenticated;
 grant execute on function private.scores_game(uuid) to authenticated;
 foreach signature in array array[
  'public.create_scorer_pin(uuid,uuid)','public.claim_scorer_access(uuid,text)',
  'public.scorer_game_setup(uuid)','public.record_game_events(uuid,jsonb)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;
