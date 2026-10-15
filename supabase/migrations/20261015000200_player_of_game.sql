-- A confirmed game award is immutable and belongs to the approved result.
create table public.game_player_awards (
 game_id uuid primary key,
 league_id uuid not null references public.leagues(id) on delete restrict,
 player_id uuid not null,
 player_name text not null check(char_length(player_name) between 1 and 200),
 side text not null check(side in('home','away')),
 efficiency integer not null,
 metrics jsonb not null check(jsonb_typeof(metrics)='object'),
 confirmed_at timestamptz not null default now(),
 foreign key(game_id,league_id) references public.games(id,league_id) on delete restrict,
 foreign key(player_id,league_id) references public.players(id,league_id) on delete restrict
);
create index game_player_awards_player_idx on public.game_player_awards(league_id,player_id);
alter table public.game_player_awards enable row level security;
revoke all on public.game_player_awards from anon,authenticated;
grant select on public.game_player_awards to anon,authenticated;
grant all on public.game_player_awards to service_role;
create trigger game_player_awards_append_only before update or delete on public.game_player_awards
 for each row execute function private.append_only_history();
create policy game_player_awards_public_read on public.game_player_awards for select to anon,authenticated
 using(exists(select 1 from public.published_games g where g.id=game_id and g.league_id=game_player_awards.league_id and g.status='approved'));

-- Reuse approval's tenant locks, sequence check, suspension handling and playoff
-- advancement. If selection validation fails, approval rolls back with it.
create function public.approve_game_with_player(
 p_league_id uuid,p_game_id uuid,p_last_sequence integer,p_home_score integer,p_away_score integer,
 p_summary jsonb,p_suspend_player_ids uuid[] default '{}',p_player_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare winner text; player jsonb; metrics jsonb; efficiency integer;
begin
 if p_player_id is not null and (auth.uid() is null or not
  (private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner'))) then
  raise exception 'commissioner_required' using errcode='42501';
 end if;
 perform public.approve_game(p_league_id,p_game_id,p_last_sequence,p_home_score,p_away_score,p_summary,p_suspend_player_ids);
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
revoke all on function public.approve_game_with_player(uuid,uuid,integer,integer,integer,jsonb,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.approve_game_with_player(uuid,uuid,integer,integer,integer,jsonb,uuid[],uuid) to authenticated;
