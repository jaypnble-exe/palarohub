-- The public TV scoreboard (/tv/[gameId]) reads one game through this function.
-- It shows only games of published seasons, and only what is shown on a gym
-- screen anyway: team names, rules, and the game's own actions (which include
-- player names and jersey numbers). Nothing else of the league is exposed.
-- p_after lets the screen ask only for actions newer than the ones it has.

create function public.tv_game(p_game_id uuid, p_after integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare game public.games; season public.seasons; division public.divisions; league public.leagues;
 begin
  select * into game from public.games where id=p_game_id;
  if game.id is null then return null; end if;
  select * into season from public.seasons where id=game.season_id and league_id=game.league_id;
  if season.status is distinct from 'published' or game.status='cancelled' then return null; end if;
  select * into division from public.divisions where id=game.division_id and league_id=game.league_id;
  select * into league from public.leagues where id=game.league_id;
  return jsonb_build_object(
   'game', jsonb_build_object(
    'id', game.id,
    'status', game.status,
    'scheduledAt', game.scheduled_at,
    'venue', game.venue,
    'round', game.round,
    'leagueName', league.name,
    'leagueSlug', league.slug,
    'seasonName', season.name,
    'divisionName', division.name,
    'sport', division.sport,
    'rules', coalesce(division.rules, season.rules),
    'homeName', (select team_name from public.season_teams where id=game.home_season_team_id and league_id=game.league_id),
    'awayName', (select team_name from public.season_teams where id=game.away_season_team_id and league_id=game.league_id)),
   'serverTime', now(),
   'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'sequence', e.sequence, 'type', e.type, 'payload', e.payload,
      'clockMs', e.clock_ms, 'occurredAt', e.occurred_at, 'createdAt', e.created_at)
     order by e.sequence)
    from public.game_events e
    where e.game_id=game.id and e.league_id=game.league_id and e.sequence>coalesce(p_after,0)), '[]'::jsonb));
 end;
$$;
revoke all on function public.tv_game(uuid, integer) from public, anon, authenticated;
grant execute on function public.tv_game(uuid, integer) to anon, authenticated;
