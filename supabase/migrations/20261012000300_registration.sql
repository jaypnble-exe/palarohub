-- Persistent league identities, season participation, and append-only rating/review history.
alter table public.divisions add constraint divisions_tenant_season_key unique(id,league_id,season_id);

create table public.registration_settings (
  season_id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  is_open boolean not null default false,
  deadline timestamptz not null,
  fee_halalas integer not null default 0 check(fee_halalas between 0 and 100000000),
  require_documents boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key(season_id,league_id) references public.seasons(id,league_id) on delete restrict
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  name text not null check(char_length(btrim(name)) between 1 and 100),
  manager_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,league_id)
);
create unique index teams_league_name_idx on public.teams(league_id,lower(btrim(name)));
create index teams_manager_idx on public.teams(league_id,manager_id);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  display_name text not null check(char_length(btrim(display_name)) between 1 and 100),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,league_id)
);
create index players_league_name_idx on public.players(league_id,display_name);
-- Verification status only: no ID numbers, documents, or iqama images are collected.
create table public.player_checks (
  player_id uuid primary key,
  league_id uuid not null references public.leagues(id) on delete restrict,
  documents_present boolean not null default false,
  suspended boolean not null default false,
  checked_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key(player_id,league_id) references public.players(id,league_id) on delete restrict
);
create table public.player_ratings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  player_id uuid not null,
  rating text not null check(char_length(rating) between 1 and 16 and rating=upper(btrim(rating))),
  effective_from timestamptz not null,
  set_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key(player_id,league_id) references public.players(id,league_id) on delete restrict
);
create index player_ratings_current_idx on public.player_ratings(league_id,player_id,effective_from desc,created_at desc,id desc);
create table public.season_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null,
  division_id uuid not null,
  team_id uuid not null,
  team_name text not null,
  status text not null default 'draft' check(status in('draft','submitted','approved','rejected','returned')),
  fee_halalas integer not null check(fee_halalas between 0 and 100000000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_comment text not null default '' check(char_length(review_comment)<=1000),
  created_at timestamptz not null default now(),
  unique(team_id,season_id),
  unique(id,league_id),
  unique(id,league_id,season_id),
  foreign key(season_id,league_id) references public.seasons(id,league_id) on delete restrict,
  foreign key(division_id,league_id,season_id) references public.divisions(id,league_id,season_id) on delete restrict,
  foreign key(team_id,league_id) references public.teams(id,league_id) on delete restrict
);
create index season_teams_review_idx on public.season_teams(league_id,status,submitted_at);
create table public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null,
  registration_id uuid not null,
  player_id uuid not null,
  jersey_number smallint not null check(jersey_number between 0 and 999),
  active boolean not null default true,
  player_name text,
  rating_snapshot text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(registration_id,league_id,season_id) references public.season_teams(id,league_id,season_id) on delete restrict,
  foreign key(player_id,league_id) references public.players(id,league_id) on delete restrict
);
create unique index roster_one_team_per_season_idx on public.roster_entries(league_id,season_id,player_id) where active;
create unique index roster_unique_jersey_idx on public.roster_entries(registration_id,jersey_number) where active;
create index roster_registration_idx on public.roster_entries(league_id,registration_id);
create table public.roster_change_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  registration_id uuid not null,
  roster jsonb not null check(jsonb_typeof(roster)='array' and jsonb_array_length(roster) between 1 and 50),
  reason text not null check(char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'submitted' check(status in('submitted','approved','rejected')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  review_comment text not null default '' check(char_length(review_comment)<=1000),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,league_id),
  foreign key(registration_id,league_id) references public.season_teams(id,league_id) on delete restrict
);
create unique index roster_one_pending_request_idx on public.roster_change_requests(registration_id) where status='submitted';
create table public.registration_reviews (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  registration_id uuid not null,
  change_request_id uuid,
  action text not null check(action in('submitted','approved','rejected','returned','change_requested','change_approved','change_rejected')),
  comment text not null default '' check(char_length(comment)<=1000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(registration_id,league_id) references public.season_teams(id,league_id) on delete restrict,
  foreign key(change_request_id,league_id) references public.roster_change_requests(id,league_id) on delete restrict
);
create index registration_reviews_history_idx on public.registration_reviews(league_id,registration_id,created_at);

create function private.staffs_league(target_league uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_admin() or private.has_league_role(target_league,'commissioner') or private.has_league_role(target_league,'league_staff');
$$;
create function private.registers_league(target_league uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_admin() or private.has_league_role(target_league,'commissioner') or private.has_league_role(target_league,'team_manager');
$$;
create function private.manages_team(target_league uuid,target_team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_admin() or private.has_league_role(target_league,'commissioner') or exists(select 1 from public.teams t where t.id=target_team and t.league_id=target_league and t.manager_id=auth.uid() and private.registers_league(target_league));
$$;
create function private.reads_registration(target_league uuid,target_registration uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staffs_league(target_league) or exists(select 1 from public.season_teams st join public.teams t on t.id=st.team_id and t.league_id=st.league_id where st.id=target_registration and st.league_id=target_league and t.manager_id=auth.uid() and private.registers_league(target_league));
$$;
create function private.public_team(target_league uuid,target_team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.season_teams st join public.seasons s on s.id=st.season_id and s.league_id=st.league_id where st.league_id=target_league and st.team_id=target_team and st.status='approved' and s.status='published');
$$;
create function private.current_rating(target_league uuid,target_player uuid) returns text language sql stable security definer set search_path='' as $$
 select r.rating from public.player_ratings r where r.league_id=target_league and r.player_id=target_player and r.effective_from<=statement_timestamp() order by r.effective_from desc,r.created_at desc,r.id desc limit 1;
$$;
create function private.append_only_history() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'history_is_append_only' using errcode='23514'; end;
$$;
create trigger ratings_append_only before update or delete on public.player_ratings for each row execute function private.append_only_history();
create trigger reviews_append_only before update or delete on public.registration_reviews for each row execute function private.append_only_history();

-- No direct client writes. Each mutation below authorizes and locks the league,
-- validates tenant references, and commits the whole workflow atomically.
do $$ declare table_name text; begin
 foreach table_name in array array['registration_settings','teams','players','player_checks','player_ratings','season_teams','roster_entries','roster_change_requests','registration_reviews'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon, authenticated',table_name);
  execute format('grant select on public.%I to authenticated',table_name);
  execute format('grant all on public.%I to service_role',table_name);
 end loop;
end; $$;
grant select on public.registration_settings to anon;
grant select(id,league_id,name) on public.teams to anon;
grant select(id,league_id,season_id,division_id,team_id,team_name,status) on public.season_teams to anon;
create policy settings_public_read on public.registration_settings for select to anon,authenticated using(exists(select 1 from public.seasons s where s.id=season_id and s.league_id=registration_settings.league_id and s.status='published'));
create policy settings_staff_read on public.registration_settings for select to authenticated using(private.staffs_league(league_id));
create policy teams_public_read on public.teams for select to anon using(private.public_team(league_id,id));
create policy teams_private_read on public.teams for select to authenticated using(private.staffs_league(league_id) or (manager_id=auth.uid() and private.registers_league(league_id)));
create policy players_league_catalog on public.players for select to authenticated using(private.staffs_league(league_id) or private.registers_league(league_id));
create policy checks_staff_read on public.player_checks for select to authenticated using(private.staffs_league(league_id));
create policy ratings_league_read on public.player_ratings for select to authenticated using(private.staffs_league(league_id) or private.registers_league(league_id));
create policy participation_public_read on public.season_teams for select to anon using(status='approved' and exists(select 1 from public.seasons s where s.id=season_id and s.league_id=season_teams.league_id and s.status='published'));
create policy participation_private_read on public.season_teams for select to authenticated using(private.reads_registration(league_id,id));
create policy roster_private_read on public.roster_entries for select to authenticated using(private.reads_registration(league_id,registration_id));
create policy changes_private_read on public.roster_change_requests for select to authenticated using(private.reads_registration(league_id,registration_id));
create policy reviews_private_read on public.registration_reviews for select to authenticated using(private.reads_registration(league_id,registration_id));

-- A deliberately narrow public projection also works for signed-in non-members,
-- without exposing manager IDs, review comments, fees, or private rosters.
create view public.published_season_teams with(security_barrier=true) as
 select st.id,st.league_id,st.season_id,st.division_id,st.team_name,d.name as division_name
 from public.season_teams st join public.divisions d on d.id=st.division_id and d.league_id=st.league_id and d.season_id=st.season_id
 join public.seasons s on s.id=st.season_id and s.league_id=st.league_id
 where st.status='approved' and s.status='published';
revoke all on public.published_season_teams from public,anon,authenticated;
grant select on public.published_season_teams to anon,authenticated;
create view public.league_player_catalog with(security_invoker=true) as
 select p.id,p.league_id,p.display_name,p.created_at,r.rating as current_rating
 from public.players p left join lateral(
  select rating from public.player_ratings where league_id=p.league_id and player_id=p.id and effective_from<=statement_timestamp() order by effective_from desc,created_at desc,id desc limit 1
 ) r on true;
revoke all on public.league_player_catalog from public,anon,authenticated;
grant select on public.league_player_catalog to authenticated;

create function private.protect_registration_history() returns trigger language plpgsql set search_path='' as $$
 begin
  if tg_table_name='season_teams' then
   if tg_op='DELETE' then raise exception 'registration_history_locked' using errcode='23514'; end if;
   if new.id<>old.id or new.league_id<>old.league_id or new.season_id<>old.season_id or new.team_id<>old.team_id or new.team_name<>old.team_name or new.fee_halalas<>old.fee_halalas or new.created_at<>old.created_at then raise exception 'registration_identity_locked' using errcode='23514'; end if;
   if old.status in('approved','rejected') then raise exception 'registration_locked' using errcode='23514'; end if;
   if (old.status in('draft','returned') and new.status not in('draft','submitted')) or (old.status='submitted' and new.status not in('approved','rejected','returned')) then raise exception 'invalid_registration_transition' using errcode='23514'; end if;
  elsif old.accepted_at is not null then
   if tg_op='DELETE' then raise exception 'roster_history_locked' using errcode='23514'; end if;
   if new.id<>old.id or new.league_id<>old.league_id or new.season_id<>old.season_id or new.registration_id<>old.registration_id or new.player_id<>old.player_id or new.jersey_number<>old.jersey_number or new.player_name is distinct from old.player_name or new.rating_snapshot is distinct from old.rating_snapshot or new.accepted_at is distinct from old.accepted_at or new.created_at<>old.created_at or (not old.active and new.active) then raise exception 'roster_history_locked' using errcode='23514'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
 end;
$$;
create trigger registrations_keep_history before update or delete on public.season_teams for each row execute function private.protect_registration_history();
create trigger accepted_rosters_keep_history before update or delete on public.roster_entries for each row execute function private.protect_registration_history();
revoke all on function private.protect_registration_history() from public,anon,authenticated;

create function private.validate_roster_payload(target_league uuid,p_roster jsonb) returns void language plpgsql set search_path='' as $$
 declare item jsonb; jersey numeric;
 begin
  if jsonb_typeof(p_roster) is distinct from 'array' then raise exception 'invalid_roster' using errcode='23514'; end if;
  if jsonb_array_length(p_roster)>50 then raise exception 'invalid_roster' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_roster) as elements(entry) group by (elements.entry->>'playerId')::uuid having count(*)>1) then raise exception 'duplicatePlayer' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_roster) as elements(entry) group by (elements.entry->>'jerseyNumber')::numeric having count(*)>1) then raise exception 'duplicateJersey' using errcode='23514'; end if;
  for item in select * from jsonb_array_elements(p_roster) loop
   if jsonb_typeof(item) is distinct from 'object' or item->>'playerId' is null or jsonb_typeof(item->'jerseyNumber') is distinct from 'number' or (item-array['playerId','jerseyNumber'])<>'{}'::jsonb then raise exception 'invalid_roster' using errcode='23514'; end if;
   jersey:=(item->>'jerseyNumber')::numeric;
   if jersey<>trunc(jersey) or jersey not between 0 and 999 then raise exception 'invalid_roster' using errcode='23514'; end if;
   if not exists(select 1 from public.players p where p.id=(item->>'playerId')::uuid and p.league_id=target_league) then raise exception 'player_league_mismatch' using errcode='23503'; end if;
  end loop;
 end;
$$;
create function private.roster_issues(target_league uuid,target_season uuid,target_division uuid,p_roster jsonb,target_registration uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
   if rating is null then issues:=issues||jsonb_build_array(jsonb_build_object('code','ratingMissing','playerId',player.id,'name',player.display_name));
   elsif not(rating=any(season.rating_scale)) then issues:=issues||jsonb_build_array(jsonb_build_object('code','ratingUnknown','playerId',player.id,'name',player.display_name,'rating',rating));
   elsif array_position(season.rating_scale,rating)<array_position(season.rating_scale,division.max_rating) then issues:=issues||jsonb_build_array(jsonb_build_object('code','ratingTooHigh','playerId',player.id,'name',player.display_name,'rating',rating,'maximumRating',division.max_rating)); end if;
   if coalesce(checks.suspended,false) then issues:=issues||jsonb_build_array(jsonb_build_object('code','playerSuspended','playerId',player.id,'name',player.display_name)); end if;
   if settings.require_documents and not coalesce(checks.documents_present,false) then issues:=issues||jsonb_build_array(jsonb_build_object('code','documentsMissing','playerId',player.id,'name',player.display_name)); end if;
   if exists(select 1 from public.roster_entries re where re.league_id=target_league and re.season_id=target_season and re.player_id=player.id and re.active and re.registration_id is distinct from target_registration) then issues:=issues||jsonb_build_array(jsonb_build_object('code','anotherTeam','playerId',player.id,'name',player.display_name)); end if;
  end loop;
  return issues;
 end;
$$;

create function public.set_registration_settings(p_league_id uuid,p_season_id uuid,p_is_open boolean,p_deadline timestamptz,p_fee_halalas integer,p_require_documents boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
  if auth.uid() is null or not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.seasons where id=p_season_id and league_id=p_league_id and status='published') then raise exception 'published_season_required' using errcode='23514'; end if;
  if p_is_open and p_deadline<=statement_timestamp() then raise exception 'deadline_passed' using errcode='23514'; end if;
  insert into public.registration_settings(league_id,season_id,is_open,deadline,fee_halalas,require_documents) values(p_league_id,p_season_id,p_is_open,p_deadline,p_fee_halalas,p_require_documents)
  on conflict(season_id) do update set is_open=excluded.is_open,deadline=excluded.deadline,fee_halalas=excluded.fee_halalas,require_documents=excluded.require_documents,updated_at=now();
 end;
$$;
create function public.join_league_registration(p_league_id uuid,p_season_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.registration_settings rs join public.seasons s on s.id=rs.season_id and s.league_id=rs.league_id where rs.league_id=p_league_id and rs.season_id=p_season_id and rs.is_open and rs.deadline>statement_timestamp() and s.status='published') then raise exception 'registration_closed' using errcode='23514'; end if;
  insert into public.league_members(league_id,user_id,role) values(p_league_id,auth.uid(),'team_manager') on conflict(league_id,user_id,role) do nothing;
 end;
$$;
create function public.create_registration_team(p_league_id uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
 declare team_id uuid;
 begin
  if auth.uid() is null or not private.registers_league(p_league_id) then raise exception 'team_manager_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  insert into public.teams(league_id,name,manager_id) values(p_league_id,btrim(p_name),auth.uid()) returning id into team_id;
  return team_id;
 end;
$$;
create function public.create_registration_player(p_league_id uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
 declare player_id uuid;
 begin
  if auth.uid() is null or not(private.registers_league(p_league_id) or private.staffs_league(p_league_id)) then raise exception 'league_access_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  insert into public.players(league_id,display_name,created_by) values(p_league_id,btrim(p_name),auth.uid()) returning id into player_id;
  insert into public.player_checks(league_id,player_id) values(p_league_id,player_id);
  return player_id;
 end;
$$;
create function public.add_player_rating(p_league_id uuid,p_player_id uuid,p_rating text,p_effective_from timestamptz,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
 declare rating_id uuid;
 begin
  if auth.uid() is null or not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.players where id=p_player_id and league_id=p_league_id) then raise exception 'player_league_mismatch' using errcode='23503'; end if;
  if not exists(select 1 from public.league_rating_scales where league_id=p_league_id and upper(btrim(p_rating))=any(labels)) and not exists(select 1 from public.seasons where league_id=p_league_id and upper(btrim(p_rating))=any(rating_scale)) then raise exception 'invalid_rating' using errcode='23514'; end if;
  insert into public.player_ratings(league_id,player_id,rating,effective_from,set_by,reason) values(p_league_id,p_player_id,upper(btrim(p_rating)),p_effective_from,auth.uid(),btrim(p_reason)) returning id into rating_id;
  return rating_id;
 end;
$$;
create function public.set_player_checks(p_league_id uuid,p_player_id uuid,p_documents_present boolean,p_suspended boolean) returns void language plpgsql security definer set search_path='' as $$
 declare prior_suspension boolean;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  if not exists(select 1 from public.players where id=p_player_id and league_id=p_league_id) then raise exception 'player_league_mismatch' using errcode='23503'; end if;
  select suspended into prior_suspension from public.player_checks where player_id=p_player_id and league_id=p_league_id;
  if p_suspended is distinct from coalesce(prior_suspension,false) and not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  insert into public.player_checks(league_id,player_id,documents_present,suspended,checked_by) values(p_league_id,p_player_id,p_documents_present,p_suspended,auth.uid())
  on conflict(player_id) do update set documents_present=excluded.documents_present,suspended=excluded.suspended,checked_by=excluded.checked_by,updated_at=now();
 end;
$$;

create function public.registration_player_catalog(p_league_id uuid,p_season_id uuid,p_registration_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
  if auth.uid() is null or not(private.registers_league(p_league_id) or private.staffs_league(p_league_id)) then raise exception 'league_access_required' using errcode='42501'; end if;
  if not exists(select 1 from public.seasons where id=p_season_id and league_id=p_league_id) then raise exception 'season_league_mismatch' using errcode='23503'; end if;
  if p_registration_id is not null and not private.reads_registration(p_league_id,p_registration_id) then raise exception 'registration_access_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'rating',private.current_rating(p_league_id,p.id),
   'suspended',coalesce(c.suspended,false),'documentsPresent',coalesce(c.documents_present,false),
   'onAnotherTeam',exists(select 1 from public.roster_entries re where re.league_id=p_league_id and re.season_id=p_season_id and re.player_id=p.id and re.active and re.registration_id is distinct from p_registration_id)) order by p.display_name,p.id)
   from public.players p left join public.player_checks c on c.player_id=p.id and c.league_id=p.league_id where p.league_id=p_league_id),'[]'::jsonb);
 end;
$$;
create function public.check_registration_eligibility(p_league_id uuid,p_season_id uuid,p_division_id uuid,p_roster jsonb,p_registration_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
  if auth.uid() is null or not(private.registers_league(p_league_id) or private.staffs_league(p_league_id)) then raise exception 'league_access_required' using errcode='42501'; end if;
  if p_registration_id is not null and not private.reads_registration(p_league_id,p_registration_id) then raise exception 'registration_access_required' using errcode='42501'; end if;
  perform private.validate_roster_payload(p_league_id,p_roster);
  return private.roster_issues(p_league_id,p_season_id,p_division_id,p_roster,p_registration_id);
 end;
$$;
create function public.save_team_registration(p_league_id uuid,p_setup jsonb,p_submit boolean default false,p_registration_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
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
   update public.season_teams set division_id=(p_setup->>'divisionId')::uuid,status='draft' where id=saved_id and league_id=p_league_id;
   delete from public.roster_entries where registration_id=saved_id and league_id=p_league_id and accepted_at is null;
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
create function public.review_team_registration(p_league_id uuid,p_registration_id uuid,p_decision text,p_comment text default '') returns void language plpgsql security definer set search_path='' as $$
 declare registration public.season_teams; roster jsonb; issues jsonb;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in('approved','rejected','returned') or p_comment is null or char_length(p_comment)>1000 or (p_decision<>'approved' and char_length(btrim(p_comment))=0) then raise exception 'review_comment_required' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into registration from public.season_teams where id=p_registration_id and league_id=p_league_id and status='submitted' for update;
  if registration.id is null then raise exception 'registration_not_submitted' using errcode='23514'; end if;
  if p_decision='approved' then
   select coalesce(jsonb_agg(jsonb_build_object('playerId',re.player_id,'jerseyNumber',re.jersey_number)),'[]') into roster from public.roster_entries re where re.registration_id=registration.id and re.league_id=p_league_id and re.active;
   issues:=private.roster_issues(p_league_id,registration.season_id,registration.division_id,roster,registration.id);
   if jsonb_array_length(issues)>0 then raise exception 'roster_ineligible' using errcode='23514',detail=issues::text; end if;
   update public.roster_entries re set rating_snapshot=private.current_rating(p_league_id,re.player_id),player_name=(select p.display_name from public.players p where p.id=re.player_id and p.league_id=p_league_id),accepted_at=now() where re.registration_id=registration.id and re.league_id=p_league_id and re.active;
  elsif p_decision='rejected' then
   update public.roster_entries set active=false where registration_id=registration.id and league_id=p_league_id;
  end if;
  update public.season_teams set status=p_decision,review_comment=btrim(p_comment),reviewed_at=now() where id=registration.id and league_id=p_league_id;
  insert into public.registration_reviews(league_id,registration_id,action,comment,actor_id) values(p_league_id,registration.id,p_decision,btrim(p_comment),auth.uid());
 end;
$$;
create function public.request_roster_change(p_league_id uuid,p_registration_id uuid,p_roster jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
 declare registration public.season_teams; request_id uuid; issues jsonb;
 begin
  if auth.uid() is null or not private.registers_league(p_league_id) then raise exception 'team_manager_required' using errcode='42501'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into registration from public.season_teams where id=p_registration_id and league_id=p_league_id and status='approved';
  if registration.id is null or not private.manages_team(p_league_id,registration.team_id) then raise exception 'team_access_required' using errcode='42501'; end if;
  perform private.validate_roster_payload(p_league_id,p_roster);
  issues:=private.roster_issues(p_league_id,registration.season_id,registration.division_id,p_roster,registration.id);
  if jsonb_array_length(issues)>0 then raise exception 'roster_ineligible' using errcode='23514',detail=issues::text; end if;
  insert into public.roster_change_requests(league_id,registration_id,roster,reason,requested_by) values(p_league_id,registration.id,p_roster,btrim(p_reason),auth.uid()) returning id into request_id;
  insert into public.registration_reviews(league_id,registration_id,change_request_id,action,comment,actor_id) values(p_league_id,registration.id,request_id,'change_requested',btrim(p_reason),auth.uid());
  return request_id;
 end;
$$;
create function public.review_roster_change(p_league_id uuid,p_request_id uuid,p_approve boolean,p_comment text default '') returns void language plpgsql security definer set search_path='' as $$
 declare request public.roster_change_requests; registration public.season_teams; issues jsonb; item jsonb;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_approve is null or p_comment is null or char_length(p_comment)>1000 or (not p_approve and char_length(btrim(p_comment))=0) then raise exception 'review_comment_required' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into request from public.roster_change_requests where id=p_request_id and league_id=p_league_id and status='submitted' for update;
  if request.id is null then raise exception 'request_not_submitted' using errcode='23514'; end if;
  select * into registration from public.season_teams where id=request.registration_id and league_id=p_league_id and status='approved' for update;
  if registration.id is null then raise exception 'registration_locked' using errcode='23514'; end if;
  if p_approve then
   perform private.validate_roster_payload(p_league_id,request.roster);
   issues:=private.roster_issues(p_league_id,registration.season_id,registration.division_id,request.roster,registration.id);
   if jsonb_array_length(issues)>0 then raise exception 'roster_ineligible' using errcode='23514',detail=issues::text; end if;
   update public.roster_entries set active=false where registration_id=registration.id and league_id=p_league_id and active;
   for item in select * from jsonb_array_elements(request.roster) loop
    insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number,rating_snapshot,player_name,accepted_at)
    values(p_league_id,registration.season_id,registration.id,(item->>'playerId')::uuid,(item->>'jerseyNumber')::smallint,private.current_rating(p_league_id,(item->>'playerId')::uuid),(select display_name from public.players where id=(item->>'playerId')::uuid and league_id=p_league_id),now());
   end loop;
  end if;
  update public.roster_change_requests set status=case when p_approve then 'approved' else 'rejected' end,review_comment=btrim(p_comment),reviewed_by=auth.uid(),reviewed_at=now() where id=request.id and league_id=p_league_id;
  insert into public.registration_reviews(league_id,registration_id,change_request_id,action,comment,actor_id)
  values(p_league_id,registration.id,request.id,case when p_approve then 'change_approved' else 'change_rejected' end,btrim(p_comment),auth.uid());
 end;
$$;

-- Lock down every new function explicitly (Postgres grants PUBLIC execution by default).
do $$ declare signature text; begin
 foreach signature in array array[
  'private.staffs_league(uuid)','private.registers_league(uuid)','private.manages_team(uuid,uuid)',
  'private.reads_registration(uuid,uuid)','private.public_team(uuid,uuid)','private.current_rating(uuid,uuid)',
  'private.append_only_history()','private.validate_roster_payload(uuid,jsonb)','private.roster_issues(uuid,uuid,uuid,jsonb,uuid)'
 ] loop execute 'revoke all on function '||signature||' from public,anon,authenticated'; end loop;
 foreach signature in array array[
  'public.set_registration_settings(uuid,uuid,boolean,timestamptz,integer,boolean)',
  'public.join_league_registration(uuid,uuid)','public.create_registration_team(uuid,text)',
  'public.create_registration_player(uuid,text)','public.add_player_rating(uuid,uuid,text,timestamptz,text)',
  'public.set_player_checks(uuid,uuid,boolean,boolean)','public.registration_player_catalog(uuid,uuid,uuid)',
  'public.check_registration_eligibility(uuid,uuid,uuid,jsonb,uuid)','public.save_team_registration(uuid,jsonb,boolean,uuid)',
  'public.review_team_registration(uuid,uuid,text,text)','public.request_roster_change(uuid,uuid,jsonb,text)',
  'public.review_roster_change(uuid,uuid,boolean,text)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;
grant execute on function private.staffs_league(uuid),private.registers_league(uuid),private.manages_team(uuid,uuid),private.reads_registration(uuid,uuid) to authenticated;
grant execute on function private.public_team(uuid,uuid) to anon,authenticated;
