-- A team may enter several divisions of one season (one registration and fee per division),
-- and a player may play in several divisions when eligible in each. Within one division a
-- player is still limited to one team.

alter table public.season_teams drop constraint season_teams_team_id_season_id_key;
alter table public.season_teams add constraint season_teams_team_division_key unique(team_id,season_id,division_id);
alter table public.season_teams add constraint season_teams_tenant_division_key unique(id,league_id,season_id,division_id);

-- Roster rows carry their registration's division so uniqueness can be enforced per division.
alter table public.roster_entries add column division_id uuid;
alter table public.roster_entries disable trigger accepted_rosters_keep_history;
update public.roster_entries re set division_id=st.division_id from public.season_teams st where st.id=re.registration_id and st.league_id=re.league_id;
alter table public.roster_entries enable trigger accepted_rosters_keep_history;
alter table public.roster_entries alter column division_id set not null;
alter table public.roster_entries add constraint roster_entries_division_fkey
  foreign key(registration_id,league_id,season_id,division_id) references public.season_teams(id,league_id,season_id,division_id) on update cascade on delete restrict;

create function private.roster_entry_division() returns trigger language plpgsql security definer set search_path='' as $$
 begin
  select st.division_id into new.division_id from public.season_teams st where st.id=new.registration_id and st.league_id=new.league_id;
  return new;
 end;
$$;
revoke all on function private.roster_entry_division() from public,anon,authenticated;
create trigger roster_entries_division before insert on public.roster_entries for each row execute function private.roster_entry_division();

drop index public.roster_one_team_per_season_idx;
create unique index roster_one_team_per_division_idx on public.roster_entries(league_id,division_id,player_id) where active;

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

-- The catalog now lists, per player, the divisions where another team already has them.
create or replace function public.registration_player_catalog(p_league_id uuid,p_season_id uuid,p_registration_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
  if auth.uid() is null or not(private.registers_league(p_league_id) or private.staffs_league(p_league_id)) then raise exception 'league_access_required' using errcode='42501'; end if;
  if not exists(select 1 from public.seasons where id=p_season_id and league_id=p_league_id) then raise exception 'season_league_mismatch' using errcode='23503'; end if;
  if p_registration_id is not null and not private.reads_registration(p_league_id,p_registration_id) then raise exception 'registration_access_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'rating',private.current_rating(p_league_id,p.id),
   'suspended',coalesce(c.suspended,false),'documentsPresent',coalesce(c.documents_present,false),
   'takenDivisionIds',coalesce((select jsonb_agg(distinct re.division_id) from public.roster_entries re where re.league_id=p_league_id and re.season_id=p_season_id and re.player_id=p.id and re.active and re.registration_id is distinct from p_registration_id),'[]'::jsonb)) order by p.display_name,p.id)
   from public.players p left join public.player_checks c on c.player_id=p.id and c.league_id=p.league_id where p.league_id=p_league_id),'[]'::jsonb);
 end;
$$;

-- Clear the old draft roster before moving a draft to another division, so the old rows never
-- collide with the new division's rosters.
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
