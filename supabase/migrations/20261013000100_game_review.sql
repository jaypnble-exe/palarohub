-- Game review: the scorer submits, staff approve or reopen, approval snapshots
-- the official result and turns chosen ejections into suspensions.

create table public.game_results (
  game_id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  home_score integer not null check(home_score between 0 and 1000),
  away_score integer not null check(away_score between 0 and 1000),
  -- The approved result covers exactly the events up to this sequence.
  last_sequence integer not null check(last_sequence between 1 and 100000),
  -- Box score, fouls, and officials derived by the sport module at approval time.
  summary jsonb not null check(jsonb_typeof(summary)='object' and octet_length(summary::text)<=200000),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);

create table public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  game_id uuid not null,
  action text not null check(action in('submitted','reopened','approved')),
  comment text not null default '' check(char_length(comment)<=1000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);
create index game_reviews_game_idx on public.game_reviews(league_id,game_id,created_at);

create table public.suspensions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  player_id uuid not null,
  game_id uuid not null,
  reason text not null check(reason in('ejected')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(player_id,game_id),
  foreign key(player_id,league_id) references public.players(id,league_id) on delete restrict,
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);

create trigger game_results_append_only before update or delete on public.game_results for each row execute function private.append_only_history();
create trigger game_reviews_append_only before update or delete on public.game_reviews for each row execute function private.append_only_history();
create trigger suspensions_append_only before update or delete on public.suspensions for each row execute function private.append_only_history();

alter table public.game_results enable row level security;
alter table public.game_reviews enable row level security;
alter table public.suspensions enable row level security;
revoke all on public.game_results, public.game_reviews, public.suspensions from anon, authenticated;
grant select on public.game_results, public.game_reviews, public.suspensions to authenticated;
grant all on public.game_results, public.game_reviews, public.suspensions to service_role;
create policy game_results_read on public.game_results for select to authenticated
using(private.staffs_league(league_id) or (private.is_league_member(league_id) and not private.is_anonymous()));
-- The scorer device sees why its game was reopened.
create policy game_reviews_read on public.game_reviews for select to authenticated
using(private.staffs_league(league_id) or private.scores_game(game_id));
-- Discipline records are for the commissioner and staff only.
create policy suspensions_staff_read on public.suspensions for select to authenticated using(private.staffs_league(league_id));

-- Public schedule shows final scores only once a result is approved.
create or replace view public.published_games with(security_barrier=true) as
 select g.id,g.league_id,g.season_id,g.division_id,d.name as division_name,g.round,g.scheduled_at,g.venue,g.status,
  g.home_season_team_id,home.team_name as home_team_name,g.away_season_team_id,away.team_name as away_team_name,
  r.home_score,r.away_score
 from public.games g
 join public.seasons s on s.id=g.season_id and s.league_id=g.league_id
 join public.divisions d on d.id=g.division_id and d.league_id=g.league_id and d.season_id=g.season_id
 join public.season_teams home on home.id=g.home_season_team_id and home.league_id=g.league_id
 join public.season_teams away on away.id=g.away_season_team_id and away.league_id=g.league_id
 left join public.game_results r on r.game_id=g.id and r.league_id=g.league_id and g.status='approved'
 where s.status='published';

-- The scorer setup now flags suspended players so they cannot be marked present.
create or replace function public.scorer_game_setup(p_game_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
     'players',coalesce((select jsonb_agg(jsonb_build_object('playerId',re.player_id,'name',re.player_name,'jersey',re.jersey_number,
        'suspended',coalesce((select c.suspended from public.player_checks c where c.player_id=re.player_id and c.league_id=game.league_id),false)) order by re.jersey_number,re.player_name)
       from public.roster_entries re where re.registration_id=st.id and re.league_id=game.league_id and re.active and re.accepted_at is not null),'[]'::jsonb)))
    from (values('home',game.home_season_team_id),('away',game.away_season_team_id)) as side(name,season_team_id)
    join public.season_teams st on st.id=side.season_team_id and st.league_id=game.league_id));
 end;
$$;

-- The official scorer device sends the finished game for approval once every event is saved.
create function public.submit_game(p_game_id uuid,p_last_sequence integer) returns void language plpgsql security definer set search_path='' as $$
 declare game public.games;
 begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select * into game from public.games where id=p_game_id for update;
  if game.id is null or not private.scores_game(game.id) then raise exception 'scorer_required' using errcode='42501'; end if;
  if game.status<>'in_progress' then raise exception 'game_not_open' using errcode='23514'; end if;
  if p_last_sequence is distinct from (select max(sequence) from public.game_events where game_id=game.id) then raise exception 'events_not_synced' using errcode='23514'; end if;
  if not exists(select 1 from public.game_events where game_id=game.id and type='game_end') then raise exception 'game_not_finished' using errcode='23514'; end if;
  update public.games set status='submitted',updated_at=now() where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,actor_id) values(game.league_id,game.id,'submitted',auth.uid());
 end;
$$;

-- Sends a submitted game back to the scorer to fix, with the reason.
create function public.reopen_game(p_league_id uuid,p_game_id uuid,p_comment text) returns void language plpgsql security definer set search_path='' as $$
 declare game public.games;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_comment is null or char_length(btrim(p_comment)) not between 1 and 1000 then raise exception 'review_comment_required' using errcode='23514'; end if;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status<>'submitted' then raise exception 'game_not_submitted' using errcode='23514'; end if;
  update public.games set status='in_progress',updated_at=now() where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,comment,actor_id) values(p_league_id,game.id,'reopened',btrim(p_comment),auth.uid());
 end;
$$;

-- Records the official result. The server action derives scores and the
-- summary from the event log with the sport module; staff are the authority.
create function public.approve_game(p_league_id uuid,p_game_id uuid,p_last_sequence integer,p_home_score integer,p_away_score integer,p_summary jsonb,p_suspend_player_ids uuid[] default '{}') returns void language plpgsql security definer set search_path='' as $$
 declare game public.games; suspended_player uuid;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status<>'submitted' then raise exception 'game_not_submitted' using errcode='23514'; end if;
  if p_last_sequence is distinct from (select max(sequence) from public.game_events where game_id=game.id) then raise exception 'events_changed' using errcode='23514'; end if;
  insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by)
  values(game.id,p_league_id,p_home_score,p_away_score,p_last_sequence,p_summary,auth.uid());
  foreach suspended_player in array coalesce(p_suspend_player_ids,'{}') loop
   if not exists(select 1 from public.roster_entries re where re.league_id=p_league_id and re.player_id=suspended_player and re.active and re.accepted_at is not null
    and re.registration_id in(game.home_season_team_id,game.away_season_team_id)) then
    raise exception 'player_not_in_game' using errcode='23514';
   end if;
   insert into public.suspensions(league_id,player_id,game_id,reason,created_by) values(p_league_id,suspended_player,game.id,'ejected',auth.uid());
   insert into public.player_checks(league_id,player_id,suspended,checked_by) values(p_league_id,suspended_player,true,auth.uid())
   on conflict(player_id) do update set suspended=true,checked_by=excluded.checked_by,updated_at=now();
  end loop;
  update public.games set status='approved',updated_at=now() where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,actor_id) values(p_league_id,game.id,'approved',auth.uid());
 end;
$$;

do $$ declare signature text; begin
 foreach signature in array array[
  'public.submit_game(uuid,integer)','public.reopen_game(uuid,uuid,text)',
  'public.approve_game(uuid,uuid,integer,integer,integer,jsonb,uuid[])'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;
