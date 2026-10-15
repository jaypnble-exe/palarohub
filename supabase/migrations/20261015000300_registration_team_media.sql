-- Private registration artwork: managers upload for their own team; staff review.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('team-registration-media','team-registration-media',false,5242880,array['image/png','image/jpeg','image/webp']);

alter table public.season_teams add column logo_path text, add column jersey_design_path text;
alter table public.season_teams add constraint registration_logo_path_length check(char_length(logo_path)<=250),
 add constraint registration_jersey_path_length check(char_length(jersey_design_path)<=250);

create function private.can_access_team_media(object_name text, uploading boolean default false)
 returns boolean language plpgsql stable security definer set search_path='' as $$
declare league uuid; team uuid;
begin
 if auth.uid() is null or private.is_anonymous() or object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(logo|jersey)/[0-9a-f-]{36}\.(png|jpg|webp)$' then return false; end if;
 begin
  league:=split_part(object_name,'/',1)::uuid;
  team:=split_part(object_name,'/',2)::uuid;
 exception when invalid_text_representation then return false; end;
 if not exists(select 1 from public.teams t where t.id=team and t.league_id=league) then return false; end if;
 if uploading then return private.registers_league(league) and exists(select 1 from public.teams t where t.id=team and t.league_id=league and t.manager_id=auth.uid()); end if;
 return private.staffs_league(league) or private.manages_team(league,team);
end;
$$;
revoke all on function private.can_access_team_media(text,boolean) from public,anon,authenticated;
grant execute on function private.can_access_team_media(text,boolean) to authenticated;
create policy team_media_insert on storage.objects for insert to authenticated
 with check(bucket_id='team-registration-media' and private.can_access_team_media(name,true));
create policy team_media_read on storage.objects for select to authenticated
 using(bucket_id='team-registration-media' and private.can_access_team_media(name,false));
-- No overwrite or delete permission: a previously submitted image stays intact.

create function private.validate_team_media(p_league_id uuid,p_team_id uuid,p_path text,p_kind text)
 returns void language plpgsql stable security definer set search_path='' as $$
begin
 if p_path is null then return; end if;
 if split_part(p_path,'/',1)<>p_league_id::text or split_part(p_path,'/',2)<>p_team_id::text
  or split_part(p_path,'/',3)<>p_kind or not exists(
   select 1 from storage.objects o where o.bucket_id='team-registration-media' and o.name=p_path
    and o.metadata->>'mimetype' in('image/png','image/jpeg','image/webp')
    and (o.metadata->>'size')::bigint between 1 and 5242880
  ) then raise exception 'invalid_team_media' using errcode='23514'; end if;
end;
$$;
revoke all on function private.validate_team_media(uuid,uuid,text,text) from public,anon,authenticated;


create or replace function public.save_team_registration(p_league_id uuid,p_setup jsonb,p_submit boolean default false,p_registration_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare team public.teams; season public.seasons; settings public.registration_settings; registration public.season_teams; saved_id uuid; item jsonb; issues jsonb; logo text; jersey text;
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
  logo:=case when p_setup ? 'logoPath' then nullif(p_setup->>'logoPath','') else registration.logo_path end;
  jersey:=case when p_setup ? 'jerseyDesignPath' then nullif(p_setup->>'jerseyDesignPath','') else registration.jersey_design_path end;
  if p_submit and logo is null then raise exception 'team_logo_required' using errcode='23514'; end if;
  perform private.validate_team_media(p_league_id,team.id,logo,'logo');
  perform private.validate_team_media(p_league_id,team.id,jersey,'jersey');
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
  update public.season_teams set logo_path=logo,jersey_design_path=jersey where id=saved_id and league_id=p_league_id;
  if p_submit then
   issues:=private.roster_issues(p_league_id,season.id,(p_setup->>'divisionId')::uuid,p_setup->'roster',saved_id);
   if jsonb_array_length(issues)>0 then raise exception 'roster_ineligible' using errcode='23514',detail=issues::text; end if;
   update public.season_teams set status='submitted',submitted_at=now() where id=saved_id and league_id=p_league_id;
   insert into public.registration_reviews(league_id,registration_id,action,actor_id) values(p_league_id,saved_id,'submitted',auth.uid());
  end if;
  return saved_id;
 end;
$$;
