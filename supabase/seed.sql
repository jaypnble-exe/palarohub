-- Repeatable Sindikato tenancy, season, and registration demo data.
-- Fictional accounts are banned from signing in, have no passwords, and use .invalid emails.
-- The league keeps its original UUID so real commissioner memberships are preserved.
do $$
declare
  demo_league_id uuid := '00000000-0000-4000-8000-000000000001';
  fixture record;
  season_fixture record;
  inserted_season uuid;
  demo_rules jsonb := '{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}';
begin
  if exists (select 1 from public.leagues where slug = 'sindikato' and id <> demo_league_id) then
    raise exception 'The Sindikato slug belongs to another league';
  end if;

  insert into public.leagues (id, slug, name, sport, settings)
  values (demo_league_id, 'sindikato', 'Sindikato', 'basketball', '{"is_demo":true}')
  on conflict (id) do update
  set name = excluded.name, slug = excluded.slug,
      settings = public.leagues.settings || excluded.settings;

  for fixture in
    select * from (values
      ('30000000-0000-4000-8000-000000000001'::uuid, 'rey.santos@sindikato.example.invalid', 'Rey Santos', 'commissioner'::public.league_role),
      ('30000000-0000-4000-8000-000000000002'::uuid, 'mia.delacruz@sindikato.example.invalid', 'Mia Dela Cruz', 'league_staff'::public.league_role),
      ('30000000-0000-4000-8000-000000000003'::uuid, 'carlo.reyes@sindikato.example.invalid', 'Carlo Reyes', 'league_staff'::public.league_role),
      ('30000000-0000-4000-8000-000000000004'::uuid, 'paolo.cruz@sindikato.example.invalid', 'Paolo Cruz', 'team_manager'::public.league_role),
      ('30000000-0000-4000-8000-000000000005'::uuid, 'rico.santos@sindikato.example.invalid', 'Rico Santos', 'team_manager'::public.league_role),
      ('30000000-0000-4000-8000-000000000006'::uuid, 'ben.aquino@sindikato.example.invalid', 'Ben Aquino', 'team_manager'::public.league_role)
    ) as demo_members (user_id, email, display_name, role)
  loop
    if exists (
      select 1 from auth.users where id = fixture.user_id
      and (email is distinct from fixture.email or raw_user_meta_data ->> 'demo_fixture' is distinct from 'sindikato_v1')
    ) then
      raise exception 'Demo user identity collision';
    end if;

    insert into auth.users (
      id, instance_id, aud, role, email, email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, banned_until
    ) values (
      fixture.user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      fixture.email, now(), '', '', '', '', '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', fixture.display_name, 'demo_fixture', 'sindikato_v1'),
      now(), now(), '2099-12-31 23:59:59+00'
    ) on conflict (id) do nothing;

    -- GoTrue expects empty token strings, including for non-login fixture accounts.
    update auth.users set confirmation_token=coalesce(confirmation_token,''),
      recovery_token=coalesce(recovery_token,''),email_change_token_new=coalesce(email_change_token_new,''),
      email_change=coalesce(email_change,''),email_change_token_current=coalesce(email_change_token_current,''),
      phone_change=coalesce(phone_change,''),phone_change_token=coalesce(phone_change_token,''),
      reauthentication_token=coalesce(reauthentication_token,'') where id=fixture.user_id;

    -- The signup trigger creates these profiles; keep fixture names repeatable on reseed.
    update public.profiles set display_name = fixture.display_name, is_platform_admin = false
    where id = fixture.user_id;
    insert into public.league_members (league_id, user_id, role)
    values (demo_league_id, fixture.user_id, fixture.role)
    on conflict (league_id, user_id, role) do nothing;
  end loop;

  -- Preserve existing drafts and published history when this seed is repeated.
  for season_fixture in select * from (values
    ('50000000-0000-4000-8000-000000000001'::uuid, 'Sindikato Cup 2026', '2026-10-16'::date, '2026-12-18'::date, true),
    ('50000000-0000-4000-8000-000000000002'::uuid, 'Sindikato Cup 2027', '2027-01-15'::date, '2027-04-16'::date, false)
  ) as seasons(id, name, start_date, end_date, publish)
  loop
    if exists (select 1 from public.seasons where id = season_fixture.id and league_id <> demo_league_id) then
      raise exception 'Demo season identity collision';
    end if;
    inserted_season := null;
    insert into public.seasons(id,league_id,name,start_date,end_date,sport,rules,rating_scale,created_by)
    values(season_fixture.id,demo_league_id,season_fixture.name,season_fixture.start_date,season_fixture.end_date,
      'basketball',demo_rules,array['A','B','C','D'],'30000000-0000-4000-8000-000000000001')
    on conflict (id) do nothing returning id into inserted_season;
    if inserted_season is not null then
      insert into public.divisions(league_id,season_id,name,sport,rules,max_rating,roster_min,roster_max) values
        (demo_league_id,inserted_season,'Open','basketball',jsonb_set(demo_rules,'{quarterMinutes}','12'),'A',8,15),
        (demo_league_id,inserted_season,'Division B','basketball',null,'B',8,15),
        (demo_league_id,inserted_season,'Division C','basketball',null,'C',8,15);
      if season_fixture.publish then update public.seasons set status = 'published' where id = inserted_season; end if;
    end if;
  end loop;
end;
$$;

-- Registration examples are inserted once; reseeding preserves decisions and history.
do $$
declare
 l uuid := '00000000-0000-4000-8000-000000000001';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 fixture record; team_uuid uuid; registration_uuid uuid; player_uuid uuid;
 manager uuid; division_uuid uuid; inserted_registration uuid; n integer;
 names text[] := array['Juan','Miguel','Marco','Luis','Anton','Jose','Gabriel','Rafael'];
 surnames text[] := array['Dela Cruz','Reyes','Santos','Cruz'];
 rating text;
begin
 insert into public.registration_settings(season_id,league_id,is_open,deadline,fee_halalas,require_documents)
 values(s,l,true,now()+interval '30 days',180000,false) on conflict(season_id) do nothing;
 for fixture in select * from (values
  (1,'Riyadh Royals',4,'Division B','approved'),
  (2,'Jeddah Aces',5,'Division C','submitted'),
  (3,'Dammam Warriors',6,'Open','returned'),
  (4,'Khobar Falcons',6,'Division C','draft')
 ) as examples(number,name,manager_number,division_name,status) loop
  team_uuid:=('80000000-0000-4000-8000-'||lpad(fixture.number::text,12,'0'))::uuid;
  registration_uuid:=('b0000000-0000-4000-8000-'||lpad(fixture.number::text,12,'0'))::uuid;
  manager:=('30000000-0000-4000-8000-'||lpad(fixture.manager_number::text,12,'0'))::uuid;
  select id into strict division_uuid from public.divisions where league_id=l and season_id=s and name=fixture.division_name;
  if exists(select 1 from public.teams where id=team_uuid and league_id<>l) then raise exception 'Demo team identity collision'; end if;
  insert into public.teams(id,league_id,name,manager_id) values(team_uuid,l,fixture.name,manager) on conflict(id) do nothing;
  for n in 1..8 loop
   player_uuid:=('90000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid;
   if exists(select 1 from public.players where id=player_uuid and league_id<>l) then raise exception 'Demo player identity collision'; end if;
   insert into public.players(id,league_id,display_name,created_by) values(player_uuid,l,names[n]||' '||surnames[fixture.number],manager) on conflict(id) do nothing;
   insert into public.player_checks(player_id,league_id) values(player_uuid,l) on conflict(player_id) do nothing;
   rating:=case when fixture.number=1 and n<=2 then 'B' when n<=4 then 'C' else 'D' end;
   if not(fixture.number=4 and n=8) then
    insert into public.player_ratings(id,league_id,player_id,rating,effective_from,set_by,reason)
    values(('a0000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid,l,player_uuid,rating,'2026-10-01 00:00:00+00',commissioner,'Fictional demo preseason assessment') on conflict(id) do nothing;
   end if;
  end loop;
  inserted_registration:=null;
  insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,fee_halalas)
  values(registration_uuid,l,s,division_uuid,team_uuid,fixture.name,180000) on conflict(id) do nothing returning id into inserted_registration;
  if inserted_registration is not null then
   for n in 1..8 loop
    player_uuid:=('90000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid;
    insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number)
    values(l,s,registration_uuid,player_uuid,n);
   end loop;
   if fixture.status<>'draft' then
    update public.season_teams set status='submitted',submitted_at=now() where id=registration_uuid;
    insert into public.registration_reviews(league_id,registration_id,action,actor_id) values(l,registration_uuid,'submitted',manager);
    if fixture.status in('approved','returned') then
     if fixture.status='approved' then
      update public.roster_entries re set player_name=p.display_name,rating_snapshot=private.current_rating(l,p.id),accepted_at=now()
      from public.players p where re.registration_id=registration_uuid and re.player_id=p.id and p.league_id=l;
     end if;
     update public.season_teams set status=fixture.status,reviewed_at=now(),review_comment=case when fixture.status='returned' then 'Please confirm the jersey numbers before resubmitting.' else '' end where id=registration_uuid;
     insert into public.registration_reviews(league_id,registration_id,action,comment,actor_id)
     values(l,registration_uuid,fixture.status,case when fixture.status='returned' then 'Please confirm the jersey numbers before resubmitting.' else '' end,commissioner);
    end if;
   end if;
  end if;
 end loop;
 -- A second assessment demonstrates append-only rating history.
 insert into public.player_ratings(id,league_id,player_id,rating,effective_from,set_by,reason)
 values('a0000000-0000-4000-8000-000000009999',l,'90000000-0000-4000-8000-000000000105','C','2026-10-02 00:00:00+00',commissioner,'Fictional demo follow-up assessment') on conflict(id) do nothing;
end;
$$;
