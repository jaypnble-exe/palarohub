-- Forfeits and defaults, correcting an approved result, closing a season, and
-- suspensions that are served automatically. History is never overwritten:
-- a corrected result is archived word for word before it is replaced, and a
-- season's final standings are kept as a snapshot when it closes.

-- 1. Results can be won by forfeit (no-show, 20-0) or by default (a team runs
--    out of players: the score stands if the winner leads, otherwise 2-0).
alter table public.game_results drop constraint game_results_last_sequence_check;
alter table public.game_results add constraint game_results_last_sequence_check check(last_sequence between 0 and 100000);
alter table public.game_results add column outcome text not null default 'played' check(outcome in('played','forfeit','default'));
alter table public.game_results add column forfeited_by text check(forfeited_by in('home','away','both'));
alter table public.game_results add constraint game_results_forfeit_side check((outcome='played')=(forfeited_by is null) and (forfeited_by<>'both' or outcome='forfeit'));

alter table public.game_reviews drop constraint game_reviews_action_check;
alter table public.game_reviews add constraint game_reviews_action_check check(action in('submitted','reopened','approved','forfeited','corrected'));

-- 2. Corrections: the replaced result (and its Player of the Game) is copied
--    here first. Only then may the current row be removed.
create table public.game_result_history (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  game_id uuid not null,
  result jsonb not null,
  award jsonb,
  reason text not null check(char_length(reason) between 1 and 1000),
  reopened_by uuid not null references public.profiles(id) on delete restrict,
  reopened_at timestamptz not null default now(),
  foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict
);
create index game_result_history_game_idx on public.game_result_history(league_id,game_id,reopened_at);
create trigger game_result_history_append_only before update or delete on public.game_result_history for each row execute function private.append_only_history();
alter table public.game_result_history enable row level security;
revoke all on public.game_result_history from anon,authenticated;
grant select on public.game_result_history to authenticated;
grant all on public.game_result_history to service_role;
create policy game_result_history_staff_read on public.game_result_history for select to authenticated using(private.staffs_league(league_id));

create function private.guard_archived_row() returns trigger language plpgsql set search_path='' as $$
 begin
  if tg_op='UPDATE' then raise exception 'history_is_append_only' using errcode='23514'; end if;
  if tg_table_name='game_results' and exists(select 1 from public.game_result_history h where h.game_id=old.game_id and h.result=to_jsonb(old)) then return old; end if;
  if tg_table_name='game_player_awards' and exists(select 1 from public.game_result_history h where h.game_id=old.game_id and h.award=to_jsonb(old)) then return old; end if;
  raise exception 'history_is_append_only' using errcode='23514';
 end;
$$;
revoke all on function private.guard_archived_row() from public,anon,authenticated;
drop trigger game_results_append_only on public.game_results;
create trigger game_results_append_only before update or delete on public.game_results for each row execute function private.guard_archived_row();
drop trigger game_player_awards_append_only on public.game_player_awards;
create trigger game_player_awards_append_only before update or delete on public.game_player_awards for each row execute function private.guard_archived_row();

-- 3. Closing a season keeps its final standings. A published season itself
--    is locked against edits, so the closing is its own permanent record.
create table public.season_closures (
  season_id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  standings jsonb not null check(jsonb_typeof(standings)='array' and octet_length(standings::text)<=500000),
  closed_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz not null default now(),
  foreign key(season_id,league_id) references public.seasons(id,league_id) on delete restrict
);
create trigger season_closures_append_only before update or delete on public.season_closures for each row execute function private.append_only_history();
alter table public.season_closures enable row level security;
revoke all on public.season_closures from anon,authenticated;
grant select on public.season_closures to anon,authenticated;
grant all on public.season_closures to service_role;
-- Final standings are public, like the season's live standings.
create policy season_closures_read on public.season_closures for select to anon,authenticated
 using(exists(select 1 from public.seasons s where s.id=season_id and s.league_id=season_closures.league_id and s.status='published'));

create function private.season_closed(target_season uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.season_closures where season_id=target_season);
$$;
revoke all on function private.season_closed(uuid) from public,anon,authenticated;

-- Nothing in a closed season changes: no games, actions, results or rosters.
create function private.guard_closed_season() returns trigger language plpgsql security definer set search_path='' as $$
 declare target uuid;
 begin
  if tg_table_name='game_events' then
   select season_id into target from public.games where id=new.game_id and league_id=new.league_id;
  elsif tg_op='DELETE' then target:=old.season_id;
  else target:=new.season_id;
  end if;
  if private.season_closed(target) then raise exception 'season_closed' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
 end;
$$;
revoke all on function private.guard_closed_season() from public,anon,authenticated;
create trigger closed_season_games before insert or update or delete on public.games for each row execute function private.guard_closed_season();
create trigger closed_season_events before insert on public.game_events for each row execute function private.guard_closed_season();
create trigger closed_season_registrations before insert or update on public.season_teams for each row execute function private.guard_closed_season();
create trigger closed_season_rosters before insert or update on public.roster_entries for each row execute function private.guard_closed_season();

-- 4. Suspensions: how many games, and for which team they are served.
alter table public.suspensions add column games smallint not null default 1 check(games between 1 and 20);
alter table public.suspensions add column season_team_id uuid;
alter table public.suspensions add constraint suspensions_season_team_fkey foreign key(season_team_id,league_id) references public.season_teams(id,league_id) on delete restrict;
alter table public.suspensions disable trigger suspensions_append_only;
update public.suspensions s set season_team_id=(
 select re.registration_id from public.roster_entries re join public.games g on g.id=s.game_id and g.league_id=s.league_id
 where re.league_id=s.league_id and re.player_id=s.player_id and re.registration_id in(g.home_season_team_id,g.away_season_team_id)
 order by re.active desc limit 1);
alter table public.suspensions enable trigger suspensions_append_only;

create table public.suspension_completions (
  suspension_id uuid primary key references public.suspensions(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete restrict,
  completed_game_id uuid not null,
  completed_at timestamptz not null default now(),
  foreign key(completed_game_id,league_id) references public.games(id,league_id) on delete restrict
);
create trigger suspension_completions_append_only before update or delete on public.suspension_completions for each row execute function private.append_only_history();
alter table public.suspension_completions enable row level security;
revoke all on public.suspension_completions from anon,authenticated;
grant select on public.suspension_completions to authenticated;
grant all on public.suspension_completions to service_role;
create policy suspension_completions_staff_read on public.suspension_completions for select to authenticated using(private.staffs_league(league_id));

-- Who set the "suspended" flag: an ejection clears itself when served; a
-- suspension the commissioner set by hand stays until they lift it.
alter table public.player_checks add column suspension_source text check(suspension_source in('manual','ejection'));
update public.player_checks c set suspension_source=case when exists(select 1 from public.suspensions s where s.player_id=c.player_id and s.league_id=c.league_id) then 'ejection' else 'manual' end where c.suspended;

create or replace function public.set_player_checks(p_league_id uuid,p_player_id uuid,p_documents_present boolean,p_suspended boolean) returns void language plpgsql security definer set search_path='' as $$
 declare prior_suspension boolean;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.players where id=p_player_id and league_id=p_league_id) then raise exception 'player_league_mismatch' using errcode='23503'; end if;
  select suspended into prior_suspension from public.player_checks where player_id=p_player_id and league_id=p_league_id;
  if p_suspended is distinct from coalesce(prior_suspension,false) and not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  insert into public.player_checks(league_id,player_id,documents_present,suspended,suspension_source,checked_by)
  values(p_league_id,p_player_id,p_documents_present,p_suspended,case when p_suspended then 'manual' end,auth.uid())
  on conflict(player_id) do update set documents_present=excluded.documents_present,suspended=excluded.suspended,
   suspension_source=case when not excluded.suspended then null
    when public.player_checks.suspended then public.player_checks.suspension_source else 'manual' end,
   checked_by=excluded.checked_by,updated_at=now();
 end;
$$;

-- After every approved game (played or forfeited), count the games each
-- suspended player's team has played since; clear served suspensions.
create function private.serve_suspensions() returns trigger language plpgsql security definer set search_path='' as $$
 declare s public.suspensions; played integer;
 begin
  if new.status<>'approved' or old.status='approved' then return new; end if;
  for s in select x.* from public.suspensions x
   where x.league_id=new.league_id and x.season_team_id in(new.home_season_team_id,new.away_season_team_id)
    and x.game_id<>new.id and not exists(select 1 from public.suspension_completions c where c.suspension_id=x.id)
  loop
   select count(*) into played from public.games g join public.game_results r on r.game_id=g.id and r.league_id=g.league_id
   where g.league_id=new.league_id and g.status='approved' and g.id<>s.game_id
    and s.season_team_id in(g.home_season_team_id,g.away_season_team_id) and r.approved_at>=s.created_at;
   if played>=s.games then
    insert into public.suspension_completions(suspension_id,league_id,completed_game_id) values(s.id,new.league_id,new.id);
    if not exists(select 1 from public.suspensions o where o.league_id=s.league_id and o.player_id=s.player_id
     and not exists(select 1 from public.suspension_completions c where c.suspension_id=o.id)) then
     update public.player_checks set suspended=false,suspension_source=null,updated_at=now()
     where player_id=s.player_id and league_id=s.league_id and suspension_source='ejection';
    end if;
   end if;
  end loop;
  return new;
 end;
$$;
revoke all on function private.serve_suspensions() from public,anon,authenticated;
create trigger serve_suspensions_after_approval after update of status on public.games for each row execute function private.serve_suspensions();

-- Approval now records how many games each suspension lasts, and can run
-- again after a correction without repeating an existing suspension.
drop function public.approve_game_with_player(uuid,uuid,integer,integer,integer,jsonb,uuid[],uuid);
drop function public.approve_game(uuid,uuid,integer,integer,integer,jsonb,uuid[]);
create function public.approve_game(p_league_id uuid,p_game_id uuid,p_last_sequence integer,p_home_score integer,p_away_score integer,p_summary jsonb,p_suspend_player_ids uuid[] default '{}',p_suspend_games integer[] default '{}') returns void language plpgsql security definer set search_path='' as $$
 declare game public.games; suspended_player uuid; team uuid; position integer:=0;
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
   position:=position+1;
   select re.registration_id into team from public.roster_entries re where re.league_id=p_league_id and re.player_id=suspended_player and re.active and re.accepted_at is not null
    and re.registration_id in(game.home_season_team_id,game.away_season_team_id) limit 1;
   if team is null then raise exception 'player_not_in_game' using errcode='23514'; end if;
   insert into public.suspensions(league_id,player_id,game_id,reason,created_by,games,season_team_id)
   values(p_league_id,suspended_player,game.id,'ejected',auth.uid(),coalesce(p_suspend_games[position],1),team)
   on conflict(player_id,game_id) do nothing;
   insert into public.player_checks(league_id,player_id,suspended,suspension_source,checked_by) values(p_league_id,suspended_player,true,'ejection',auth.uid())
   on conflict(player_id) do update set suspended=true,
    suspension_source=case when public.player_checks.suspended and public.player_checks.suspension_source='manual' then 'manual' else 'ejection' end,
    checked_by=excluded.checked_by,updated_at=now();
  end loop;
  update public.games set status='approved',updated_at=now() where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,actor_id) values(p_league_id,game.id,'approved',auth.uid());
 end;
$$;

create function public.approve_game_with_player(
 p_league_id uuid,p_game_id uuid,p_last_sequence integer,p_home_score integer,p_away_score integer,
 p_summary jsonb,p_suspend_player_ids uuid[] default '{}',p_player_id uuid default null,p_suspend_games integer[] default '{}'
) returns void language plpgsql security definer set search_path='' as $$
declare winner text; player jsonb; metrics jsonb; efficiency integer;
begin
 if p_player_id is not null and (auth.uid() is null or not
  (private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner'))) then
  raise exception 'commissioner_required' using errcode='42501';
 end if;
 perform public.approve_game(p_league_id,p_game_id,p_last_sequence,p_home_score,p_away_score,p_summary,p_suspend_player_ids,p_suspend_games);
 if p_player_id is null then return; end if;
 if p_home_score=p_away_score then raise exception 'invalid_player_of_game' using errcode='23514'; end if;
 winner:=case when p_home_score>p_away_score then 'home' else 'away' end;
 select row into player from jsonb_array_elements(p_summary->'teams'->winner->'players') row
  where row->>'playerId'=p_player_id::text and row->>'entered'='true';
 if player is null or not exists(
  select 1 from public.game_events e cross join lateral jsonb_array_elements(e.payload->'players') roster
  where e.game_id=p_game_id and e.league_id=p_league_id and e.type='roster' and e.sequence<=p_last_sequence
   and e.payload->>'team'=winner and roster->>'playerId'=p_player_id::text
 ) then raise exception 'invalid_player_of_game' using errcode='23514'; end if;
 metrics:=jsonb_build_object(
  'points',(player->>'points')::integer,
  'rebounds',(player->'stats'->>'rebound')::integer,
  'assists',(player->'stats'->>'assist')::integer,
  'steals',(player->'stats'->>'steal')::integer,
  'blocks',(player->'stats'->>'block')::integer,
  'turnovers',(player->'stats'->>'turnover')::integer,
  'fieldGoals',(player->'fieldGoals'->>'made')::integer,
  'fieldGoalAttempts',(player->'fieldGoals'->>'attempted')::integer,
  'freeThrows',(player->'freeThrows'->>'made')::integer,
  'freeThrowAttempts',(player->'freeThrows'->>'attempted')::integer
 );
 if exists(select 1 from jsonb_each(metrics) item where item.value='null'::jsonb) then
  raise exception 'invalid_player_of_game' using errcode='23514';
 end if;
 efficiency:=(metrics->>'points')::integer+(metrics->>'rebounds')::integer+(metrics->>'assists')::integer+
  (metrics->>'steals')::integer+(metrics->>'blocks')::integer-
  ((metrics->>'fieldGoalAttempts')::integer-(metrics->>'fieldGoals')::integer)-
  ((metrics->>'freeThrowAttempts')::integer-(metrics->>'freeThrows')::integer)-(metrics->>'turnovers')::integer;
 insert into public.game_player_awards(game_id,league_id,player_id,player_name,side,efficiency,metrics)
 values(p_game_id,p_league_id,p_player_id,player->>'name',winner,efficiency,metrics);
end;
$$;

-- A no-show (forfeit) or a team without enough players (default). The server
-- sends the score so far for a default; a forfeit is always 20-0.
create function public.record_forfeit(p_league_id uuid,p_game_id uuid,p_kind text,p_side text,p_reason text,p_home_score integer default 0,p_away_score integer default 0) returns void language plpgsql security definer set search_path='' as $$
 declare game public.games; home integer; away integer; last integer;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in('forfeit','default') or p_side is null or p_side not in('home','away','both')
   or (p_side='both' and p_kind<>'forfeit') or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
   raise exception 'invalid_forfeit' using errcode='23514';
  end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status not in('scheduled','postponed','in_progress','submitted') then raise exception 'game_not_open' using errcode='23514'; end if;
  if game.bracket_slot_id is not null and p_side='both' then raise exception 'invalid_forfeit' using errcode='23514'; end if;
  select coalesce(max(sequence),0) into last from public.game_events where game_id=game.id;
  if p_kind='forfeit' then
   home:=case p_side when 'away' then 20 else 0 end;
   away:=case p_side when 'home' then 20 else 0 end;
  else
   if last=0 then raise exception 'invalid_forfeit' using errcode='23514'; end if;
   home:=greatest(coalesce(p_home_score,0),0); away:=greatest(coalesce(p_away_score,0),0);
   -- The score stands only if the team that wins was already ahead.
   if (p_side='home' and away<=home) or (p_side='away' and home<=away) then
    home:=case p_side when 'away' then 2 else 0 end;
    away:=case p_side when 'home' then 2 else 0 end;
   end if;
  end if;
  insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by,outcome,forfeited_by)
  values(game.id,p_league_id,home,away,last,jsonb_build_object('outcome',p_kind,'forfeitedBy',p_side,'reason',btrim(p_reason)),auth.uid(),p_kind,p_side);
  update public.games set status='approved',updated_at=now() where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,comment,actor_id) values(p_league_id,game.id,'forfeited',btrim(p_reason),auth.uid());
 end;
$$;

-- The commissioner reopens an approved result to correct it. The result and
-- its award are archived first; standings follow automatically.
create function public.reopen_result(p_league_id uuid,p_game_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 declare game public.games; result public.game_results; award public.game_player_awards; has_events boolean;
 begin
  if auth.uid() is null or not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'review_comment_required' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into game from public.games where id=p_game_id and league_id=p_league_id for update;
  if game.id is null then raise exception 'game_not_found' using errcode='23503'; end if;
  if game.status<>'approved' then raise exception 'game_not_approved' using errcode='23514'; end if;
  if game.bracket_slot_id is not null then raise exception 'bracket_result_locked' using errcode='23514'; end if;
  if private.season_closed(game.season_id) then raise exception 'season_closed' using errcode='23514'; end if;
  select * into result from public.game_results where game_id=game.id and league_id=p_league_id;
  select * into award from public.game_player_awards where game_id=game.id and league_id=p_league_id;
  insert into public.game_result_history(league_id,game_id,result,award,reason,reopened_by)
  values(p_league_id,game.id,to_jsonb(result),case when award.game_id is null then null else to_jsonb(award) end,btrim(p_reason),auth.uid());
  delete from public.game_player_awards where game_id=game.id and league_id=p_league_id;
  delete from public.game_results where game_id=game.id and league_id=p_league_id;
  has_events:=exists(select 1 from public.game_events where game_id=game.id and type<>'roster');
  update public.games set status=case when has_events then 'in_progress' when game.scheduled_at is null then 'postponed' else 'scheduled' end,updated_at=now()
  where id=game.id;
  insert into public.game_reviews(league_id,game_id,action,comment,actor_id) values(p_league_id,game.id,'corrected',btrim(p_reason),auth.uid());
 end;
$$;

-- Closes a season once every game has a result. The server sends the final
-- standings it calculated (one entry per division), kept as the record.
create function public.close_season(p_league_id uuid,p_season_id uuid,p_standings jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare open_games integer;
 begin
  if auth.uid() is null or not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.seasons where id=p_season_id and league_id=p_league_id and status='published') then raise exception 'published_season_required' using errcode='23514'; end if;
  if private.season_closed(p_season_id) then raise exception 'season_closed' using errcode='23514'; end if;
  select count(*) into open_games from public.games where season_id=p_season_id and league_id=p_league_id and status not in('approved','cancelled');
  if open_games>0 then raise exception 'games_without_result' using errcode='23514',detail=open_games::text; end if;
  if jsonb_typeof(p_standings) is distinct from 'array'
   or (select count(*) from public.divisions where season_id=p_season_id and league_id=p_league_id)
    <> (select count(distinct entry->>'divisionId') from jsonb_array_elements(p_standings) entry
        where exists(select 1 from public.divisions d where d.id::text=entry->>'divisionId' and d.season_id=p_season_id and d.league_id=p_league_id)) then
   raise exception 'invalid_standings' using errcode='23514';
  end if;
  update public.registration_settings set is_open=false where season_id=p_season_id and league_id=p_league_id;
  insert into public.season_closures(season_id,league_id,standings,closed_by) values(p_season_id,p_league_id,p_standings,auth.uid());
 end;
$$;

do $$ declare signature text; begin
 foreach signature in array array[
  'public.approve_game(uuid,uuid,integer,integer,integer,jsonb,uuid[],integer[])',
  'public.approve_game_with_player(uuid,uuid,integer,integer,integer,jsonb,uuid[],uuid,integer[])',
  'public.record_forfeit(uuid,uuid,text,text,text,integer,integer)',
  'public.reopen_result(uuid,uuid,text)',
  'public.close_season(uuid,uuid,jsonb)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;

-- Public game lists show how a game was won.
create or replace view public.published_games with(security_barrier=true) as
 select g.id,g.league_id,g.season_id,g.division_id,d.name as division_name,g.round,g.scheduled_at,g.venue,g.status,
  g.home_season_team_id,home.team_name as home_team_name,g.away_season_team_id,away.team_name as away_team_name,
  r.home_score,r.away_score,g.bracket_slot_id,g.bracket_game_number,r.outcome,r.forfeited_by
 from public.games g join public.seasons s on s.id=g.season_id and s.league_id=g.league_id
 join public.divisions d on d.id=g.division_id and d.league_id=g.league_id and d.season_id=g.season_id
 join public.season_teams home on home.id=g.home_season_team_id and home.league_id=g.league_id
 join public.season_teams away on away.id=g.away_season_team_id and away.league_id=g.league_id
 left join public.game_results r on r.game_id=g.id and r.league_id=g.league_id and g.status='approved'
 where s.status='published';
