-- New players can be added while building a roster. They are created only when the
-- registration is saved, together with the roster, and then appear in the commissioner's
-- player list, where they can be rated later (ratings are optional).

create or replace function public.save_team_registration(p_league_id uuid,p_setup jsonb,p_submit boolean default false,p_registration_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare team public.teams; season public.seasons; settings public.registration_settings; registration public.season_teams; saved_id uuid; item jsonb; issues jsonb;
 begin
  if auth.uid() is null or not private.registers_league(p_league_id) then raise exception 'team_manager_required' using errcode='42501'; end if;
  select * into team from public.teams where id=(p_setup->>'teamId')::uuid and league_id=p_league_id;
  if team.id is null or not private.manages_team(p_league_id,team.id) then raise exception 'team_access_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into season from public.seasons where id=(p_setup->>'seasonId')::uuid and league_id=p_league_id and status='published';
  select * into settings from public.registration_settings where season_id=season.id and league_id=p_league_id;
  if season.id is null or settings.season_id is null or not settings.is_open or settings.deadline<=statement_timestamp() then raise exception 'registration_closed' using errcode='23514'; end if;
  if not exists(select 1 from public.divisions where id=(p_setup->>'divisionId')::uuid and league_id=p_league_id and season_id=season.id) then raise exception 'division_season_mismatch' using errcode='23503'; end if;
  -- Players the manager typed in while building the roster are created with it, in one step.
  if p_setup ? 'newPlayers' then
   if jsonb_typeof(p_setup->'newPlayers') is distinct from 'array' or jsonb_array_length(p_setup->'newPlayers')>50 then raise exception 'invalid_roster' using errcode='23514'; end if;
   for item in select * from jsonb_array_elements(p_setup->'newPlayers') loop
    if jsonb_typeof(item) is distinct from 'object' or (item-array['id','name'])<>'{}'::jsonb or item->>'id' is null or char_length(btrim(coalesce(item->>'name',''))) not between 1 and 100 then raise exception 'invalid_roster' using errcode='23514'; end if;
    if not exists(select 1 from jsonb_array_elements(p_setup->'roster') as roster(entry) where roster.entry->>'playerId'=item->>'id') then raise exception 'invalid_roster' using errcode='23514'; end if;
    insert into public.players(id,league_id,display_name,created_by) values((item->>'id')::uuid,p_league_id,btrim(item->>'name'),auth.uid());
    insert into public.player_checks(league_id,player_id) values(p_league_id,(item->>'id')::uuid);
   end loop;
  end if;
  perform private.validate_roster_payload(p_league_id,p_setup->'roster');
  if p_registration_id is null then
   insert into public.season_teams(league_id,season_id,division_id,team_id,team_name,fee_halalas) values(p_league_id,season.id,(p_setup->>'divisionId')::uuid,team.id,team.name,settings.fee_halalas) returning id into saved_id;
  else
   select * into registration from public.season_teams where id=p_registration_id and league_id=p_league_id and team_id=team.id and season_id=season.id for update;
   if registration.id is null or registration.status not in('draft','returned') then raise exception 'registration_locked' using errcode='23514'; end if;
   saved_id:=registration.id;
   delete from public.roster_entries where registration_id=saved_id and league_id=p_league_id and accepted_at is null;
   update public.season_teams set division_id=(p_setup->>'divisionId')::uuid,status='draft' where id=saved_id and league_id=p_league_id;
  end if;
  for item in select * from jsonb_array_elements(p_setup->'roster') loop
   insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number) values(p_league_id,season.id,saved_id,(item->>'playerId')::uuid,(item->>'jerseyNumber')::smallint);
  end loop;
  if p_submit then
   issues:=private.roster_issues(p_league_id,season.id,(p_setup->>'divisionId')::uuid,p_setup->'roster',saved_id);
   if jsonb_array_length(issues)>0 then raise exception 'roster_ineligible' using errcode='23514',detail=issues::text; end if;
   update public.season_teams set status='submitted',submitted_at=now() where id=saved_id and league_id=p_league_id;
   insert into public.registration_reviews(league_id,registration_id,action,actor_id) values(p_league_id,saved_id,'submitted',auth.uid());
  end if;
  return saved_id;
 end;
$$;
