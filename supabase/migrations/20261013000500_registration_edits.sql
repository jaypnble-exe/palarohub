-- Two ways to fix a submitted registration:
-- 1. A roster the commissioner returned can be edited and resubmitted even after the
--    deadline (saving a draft keeps it returned, so it never gets stuck).
-- 2. A manager can take back a registration that is still waiting for review, while
--    registration is open, to edit it before the commissioner looks at it.

alter table public.registration_reviews drop constraint registration_reviews_action_check;
alter table public.registration_reviews add constraint registration_reviews_action_check
  check(action in('submitted','withdrawn','approved','rejected','returned','change_requested','change_approved','change_rejected'));

-- Allow saving without changing status, and submitted -> draft (taken back).
create or replace function private.protect_registration_history() returns trigger language plpgsql set search_path='' as $$
 begin
  if tg_table_name='season_teams' then
   if tg_op='DELETE' then raise exception 'registration_history_locked' using errcode='23514'; end if;
   if new.id<>old.id or new.league_id<>old.league_id or new.season_id<>old.season_id or new.team_id<>old.team_id or new.team_name<>old.team_name or new.fee_halalas<>old.fee_halalas or new.created_at<>old.created_at then raise exception 'registration_identity_locked' using errcode='23514'; end if;
   if old.status in('approved','rejected') then raise exception 'registration_locked' using errcode='23514'; end if;
   if new.status<>old.status and ((old.status in('draft','returned') and new.status not in('draft','submitted')) or (old.status='submitted' and new.status not in('approved','rejected','returned','draft'))) then raise exception 'invalid_registration_transition' using errcode='23514'; end if;
  elsif old.accepted_at is not null then
   if tg_op='DELETE' then raise exception 'roster_history_locked' using errcode='23514'; end if;
   if new.id<>old.id or new.league_id<>old.league_id or new.season_id<>old.season_id or new.registration_id<>old.registration_id or new.player_id<>old.player_id or new.jersey_number<>old.jersey_number or new.player_name is distinct from old.player_name or new.rating_snapshot is distinct from old.rating_snapshot or new.accepted_at is distinct from old.accepted_at or new.created_at<>old.created_at or (not old.active and new.active) then raise exception 'roster_history_locked' using errcode='23514'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
 end;
$$;

create or replace function public.save_team_registration(p_league_id uuid,p_setup jsonb,p_submit boolean default false,p_registration_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare team public.teams; season public.seasons; settings public.registration_settings; registration public.season_teams; saved_id uuid; item jsonb; issues jsonb;
 begin
  if auth.uid() is null or not private.registers_league(p_league_id) then raise exception 'team_manager_required' using errcode='42501'; end if;
  select * into team from public.teams where id=(p_setup->>'teamId')::uuid and league_id=p_league_id;
  if team.id is null or not private.manages_team(p_league_id,team.id) then raise exception 'team_access_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into season from public.seasons where id=(p_setup->>'seasonId')::uuid and league_id=p_league_id and status='published';
  select * into settings from public.registration_settings where season_id=season.id and league_id=p_league_id;
  if season.id is null or settings.season_id is null then raise exception 'registration_closed' using errcode='23514'; end if;
  if p_registration_id is not null then
   select * into registration from public.season_teams where id=p_registration_id and league_id=p_league_id and team_id=team.id and season_id=season.id for update;
  end if;
  -- A roster the commissioner sent back can be fixed even after the deadline.
  if (not settings.is_open or settings.deadline<=statement_timestamp()) and registration.status is distinct from 'returned' then raise exception 'registration_closed' using errcode='23514'; end if;
  if p_registration_id is not null and (registration.id is null or registration.status not in('draft','returned')) then raise exception 'registration_locked' using errcode='23514'; end if;
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
   saved_id:=registration.id;
   delete from public.roster_entries where registration_id=saved_id and league_id=p_league_id and accepted_at is null;
   -- Saving a returned roster keeps it returned, so it stays editable after the deadline.
   update public.season_teams set division_id=(p_setup->>'divisionId')::uuid,status=case when registration.status='returned' then 'returned' else 'draft' end where id=saved_id and league_id=p_league_id;
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

create function public.withdraw_team_registration(p_league_id uuid,p_registration_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare registration public.season_teams; settings public.registration_settings;
 begin
  if auth.uid() is null or not private.registers_league(p_league_id) then raise exception 'team_manager_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into registration from public.season_teams where id=p_registration_id and league_id=p_league_id for update;
  if registration.id is null or not private.manages_team(p_league_id,registration.team_id) then raise exception 'team_access_required' using errcode='42501'; end if;
  if registration.status<>'submitted' then raise exception 'registration_not_submitted' using errcode='23514'; end if;
  select * into settings from public.registration_settings where season_id=registration.season_id and league_id=p_league_id;
  if settings.season_id is null or not settings.is_open or settings.deadline<=statement_timestamp() then raise exception 'registration_closed' using errcode='23514'; end if;
  update public.season_teams set status='draft',submitted_at=null where id=registration.id and league_id=p_league_id;
  insert into public.registration_reviews(league_id,registration_id,action,actor_id) values(p_league_id,registration.id,'withdrawn',auth.uid());
 end;
$$;
revoke all on function public.withdraw_team_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.withdraw_team_registration(uuid,uuid) to authenticated;
