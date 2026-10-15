-- Reapply the tracked optional-rating rule for databases that applied the
-- multi-division migration before that rule was updated. Rated players still
-- obey the division cap; suspensions and duplicate rosters remain enforced.
create or replace function private.roster_issues(target_league uuid,target_season uuid,target_division uuid,p_roster jsonb,target_registration uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare division public.divisions; season public.seasons; settings public.registration_settings; item jsonb; player public.players; checks public.player_checks; rating text; issues jsonb:='[]'; count_players integer;
 begin
  select * into season from public.seasons where id=target_season and league_id=target_league;
  select * into division from public.divisions where id=target_division and season_id=target_season and league_id=target_league;
  select * into settings from public.registration_settings where season_id=target_season and league_id=target_league;
  if season.id is null or division.id is null or settings.season_id is null then raise exception 'registration_setup_missing' using errcode='23514'; end if;
  count_players:=jsonb_array_length(p_roster);
  if count_players<division.roster_min then issues:=issues||jsonb_build_array(jsonb_build_object('code','rosterTooSmall','min',division.roster_min)); end if;
  if count_players>division.roster_max then issues:=issues||jsonb_build_array(jsonb_build_object('code','rosterTooLarge','max',division.roster_max)); end if;
  for item in select * from jsonb_array_elements(p_roster) loop
   select * into player from public.players where id=(item->>'playerId')::uuid and league_id=target_league;
   select * into checks from public.player_checks where player_id=player.id and league_id=target_league;
   rating:=private.current_rating(target_league,player.id);
   -- Ratings are optional: the commissioner rates players when they choose, and only rated
   -- players are checked against the division cap.
   if rating is null then null;
   elsif not(rating=any(season.rating_scale)) then issues:=issues||jsonb_build_array(jsonb_build_object('code','ratingUnknown','playerId',player.id,'name',player.display_name,'rating',rating));
   elsif array_position(season.rating_scale,rating)<array_position(season.rating_scale,division.max_rating) then issues:=issues||jsonb_build_array(jsonb_build_object('code','ratingTooHigh','playerId',player.id,'name',player.display_name,'rating',rating,'maximumRating',division.max_rating)); end if;
   if coalesce(checks.suspended,false) then issues:=issues||jsonb_build_array(jsonb_build_object('code','playerSuspended','playerId',player.id,'name',player.display_name)); end if;
   if settings.require_documents and not coalesce(checks.documents_present,false) then issues:=issues||jsonb_build_array(jsonb_build_object('code','documentsMissing','playerId',player.id,'name',player.display_name)); end if;
   if exists(select 1 from public.roster_entries re where re.league_id=target_league and re.division_id=target_division and re.player_id=player.id and re.active and re.registration_id is distinct from target_registration) then issues:=issues||jsonb_build_array(jsonb_build_object('code','anotherTeam','playerId',player.id,'name',player.display_name)); end if;
  end loop;
  return issues;
 end;
$$;
