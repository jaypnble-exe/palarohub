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
 surnames text[] := array['Dela Cruz','Reyes','Santos','Cruz','Garcia','Mendoza','Bautista'];
 rating text;
begin
 insert into public.registration_settings(season_id,league_id,is_open,deadline,fee_halalas,require_documents)
 values(s,l,true,now()+interval '30 days',180000,false) on conflict(season_id) do nothing;
 for fixture in select * from (values
  (1,'Riyadh Royals',4,'Division B','approved'),
  (2,'Jeddah Aces',5,'Division C','submitted'),
  (3,'Dammam Warriors',6,'Open','returned'),
  (4,'Khobar Falcons',6,'Division C','draft'),
  (5,'Taif Titans',5,'Division B','approved'),
  (6,'Yanbu Kings',6,'Division B','approved'),
  (7,'Hail Hawks',4,'Division B','approved')
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

-- A Division B round-robin and a welcome announcement. The schedule is added only
-- while the division has none, so a commissioner's own schedule is never duplicated.
do $$
declare
 l uuid := '00000000-0000-4000-8000-000000000001';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 division_uuid uuid;
begin
 select id into strict division_uuid from public.divisions where league_id=l and season_id=s and name='Division B';
 if not exists(select 1 from public.games where league_id=l and division_id=division_uuid) then
  insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,scheduled_at,venue,created_by)
  select ('c0000000-0000-4000-8000-'||lpad(fixture.number::text,12,'0'))::uuid,l,s,division_uuid,
   ('b0000000-0000-4000-8000-'||lpad(fixture.home::text,12,'0'))::uuid,('b0000000-0000-4000-8000-'||lpad(fixture.away::text,12,'0'))::uuid,
   fixture.round,fixture.starts_at,'Main court',commissioner
  from (values
   (1,1,1,7,'2026-10-23 16:00:00+00'::timestamptz),(2,1,5,6,'2026-10-23 17:30:00+00'::timestamptz),
   (3,2,6,1,'2026-10-30 16:00:00+00'::timestamptz),(4,2,7,5,'2026-10-30 17:30:00+00'::timestamptz),
   (5,3,1,5,'2026-11-06 16:00:00+00'::timestamptz),(6,3,6,7,'2026-11-06 17:30:00+00'::timestamptz)
  ) as fixture(number,round,home,away,starts_at)
  on conflict(id) do nothing;
 end if;
 insert into public.announcements(id,league_id,title,body,created_by)
 values('d0000000-0000-4000-8000-000000000001',l,'Welcome to Sindikato Cup 2026','Games start on Friday, 23 October. Please arrive 30 minutes before tip-off.',commissioner)
 on conflict(id) do nothing;
end;
$$;

-- A game being played right now: Riyadh Royals 36, Yanbu Kings 31, paused for a
-- Royals timeout with 4:12 left in the third quarter. Its events follow the
-- basketball rules (checked when they were written), so the scorebook can carry
-- on from here. Times are relative to when the seed runs; added only once.
do $$
declare
 l uuid := '00000000-0000-4000-8000-000000000001';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 live_game uuid := 'c0000000-0000-4000-8000-000000000007';
 division_uuid uuid;
 inserted uuid;
begin
 select id into strict division_uuid from public.divisions where league_id=l and season_id=s and name='Division B';
 if exists(select 1 from public.games where id=live_game and league_id<>l) then raise exception 'Demo game identity collision'; end if;
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,scheduled_at,venue,status,created_by)
 values(live_game,l,s,division_uuid,'b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000006',null,now()-interval '40 minutes','Main court','in_progress',commissioner)
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  select e.id::uuid,l,live_game,e.sequence,e.type,e.payload,e.clock_ms,e.period,now()-make_interval(secs=>e.ago),commissioner
  from (values
   ('e0000000-0000-4000-8000-000000000001',1,'roster','{"team":"home","players":[{"playerId":"90000000-0000-4000-8000-000000000101","name":"Juan Dela Cruz","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000102","name":"Miguel Dela Cruz","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000103","name":"Marco Dela Cruz","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000104","name":"Luis Dela Cruz","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000105","name":"Anton Dela Cruz","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000106","name":"Jose Dela Cruz","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000107","name":"Gabriel Dela Cruz","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000108","name":"Rafael Dela Cruz","jersey":8}]}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000002',2,'roster','{"team":"away","players":[{"playerId":"90000000-0000-4000-8000-000000000601","name":"Juan Mendoza","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000602","name":"Miguel Mendoza","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000603","name":"Marco Mendoza","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000604","name":"Luis Mendoza","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000605","name":"Anton Mendoza","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000606","name":"Jose Mendoza","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000607","name":"Gabriel Mendoza","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000608","name":"Rafael Mendoza","jersey":8}]}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000003',3,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000004',4,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000102"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000005',5,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000006',6,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000104"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000007',7,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000105"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000008',8,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000106"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000009',9,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000107"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000010',10,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000108"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000011',11,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000012',12,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000013',13,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000014',14,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000015',15,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000016',16,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000606"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000017',17,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000607"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000018',18,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000019',19,'officials','{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000020',20,'starters','{"team":"home","playerIds":["90000000-0000-4000-8000-000000000101","90000000-0000-4000-8000-000000000102","90000000-0000-4000-8000-000000000103","90000000-0000-4000-8000-000000000104","90000000-0000-4000-8000-000000000105"]}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000021',21,'starters','{"team":"away","playerIds":["90000000-0000-4000-8000-000000000601","90000000-0000-4000-8000-000000000602","90000000-0000-4000-8000-000000000603","90000000-0000-4000-8000-000000000604","90000000-0000-4000-8000-000000000605"]}'::jsonb,null,0,1409),
   ('e0000000-0000-4000-8000-000000000022',22,'period_start','{}'::jsonb,null,1,1409),
   ('e0000000-0000-4000-8000-000000000023',23,'clock_start','{}'::jsonb,600000,1,1409),
   ('e0000000-0000-4000-8000-000000000024',24,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,566000,1,1375),
   ('e0000000-0000-4000-8000-000000000025',25,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,560000,1,1369),
   ('e0000000-0000-4000-8000-000000000026',26,'clock_start','{}'::jsonb,560000,1,1369),
   ('e0000000-0000-4000-8000-000000000027',27,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,526000,1,1335),
   ('e0000000-0000-4000-8000-000000000028',28,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,520000,1,1329),
   ('e0000000-0000-4000-8000-000000000029',29,'clock_start','{}'::jsonb,520000,1,1329),
   ('e0000000-0000-4000-8000-000000000030',30,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":true}'::jsonb,486000,1,1295),
   ('e0000000-0000-4000-8000-000000000031',31,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,480000,1,1289),
   ('e0000000-0000-4000-8000-000000000032',32,'clock_start','{}'::jsonb,480000,1,1289),
   ('e0000000-0000-4000-8000-000000000033',33,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":false}'::jsonb,446000,1,1255),
   ('e0000000-0000-4000-8000-000000000034',34,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":true}'::jsonb,412000,1,1221),
   ('e0000000-0000-4000-8000-000000000035',35,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,378000,1,1187),
   ('e0000000-0000-4000-8000-000000000036',36,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000105","points":2,"made":true}'::jsonb,344000,1,1153),
   ('e0000000-0000-4000-8000-000000000037',37,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":true}'::jsonb,310000,1,1119),
   ('e0000000-0000-4000-8000-000000000038',38,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,276000,1,1085),
   ('e0000000-0000-4000-8000-000000000039',39,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,242000,1,1051),
   ('e0000000-0000-4000-8000-000000000040',40,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":true}'::jsonb,208000,1,1017),
   ('e0000000-0000-4000-8000-000000000041',41,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000104","points":3,"made":false}'::jsonb,174000,1,983),
   ('e0000000-0000-4000-8000-000000000042',42,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":true}'::jsonb,140000,1,949),
   ('e0000000-0000-4000-8000-000000000043',43,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","points":3,"made":true}'::jsonb,106000,1,915),
   ('e0000000-0000-4000-8000-000000000044',44,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":true}'::jsonb,72000,1,881),
   ('e0000000-0000-4000-8000-000000000045',45,'period_end','{}'::jsonb,0,1,881),
   ('e0000000-0000-4000-8000-000000000046',46,'period_start','{}'::jsonb,null,2,881),
   ('e0000000-0000-4000-8000-000000000047',47,'clock_start','{}'::jsonb,600000,2,881),
   ('e0000000-0000-4000-8000-000000000048',48,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000104","in":"90000000-0000-4000-8000-000000000106"}'::jsonb,592000,2,873),
   ('e0000000-0000-4000-8000-000000000049',49,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000605","in":"90000000-0000-4000-8000-000000000607"}'::jsonb,587000,2,868),
   ('e0000000-0000-4000-8000-000000000050',50,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,553000,2,834),
   ('e0000000-0000-4000-8000-000000000051',51,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,547000,2,828),
   ('e0000000-0000-4000-8000-000000000052',52,'clock_start','{}'::jsonb,547000,2,828),
   ('e0000000-0000-4000-8000-000000000053',53,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000106","points":2,"made":true}'::jsonb,513000,2,794),
   ('e0000000-0000-4000-8000-000000000054',54,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","kind":"personal"}'::jsonb,507000,2,788),
   ('e0000000-0000-4000-8000-000000000055',55,'clock_start','{}'::jsonb,507000,2,788),
   ('e0000000-0000-4000-8000-000000000056',56,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,473000,2,754),
   ('e0000000-0000-4000-8000-000000000057',57,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,467000,2,748),
   ('e0000000-0000-4000-8000-000000000058',58,'clock_start','{}'::jsonb,467000,2,748),
   ('e0000000-0000-4000-8000-000000000059',59,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":3,"made":true}'::jsonb,433000,2,714),
   ('e0000000-0000-4000-8000-000000000060',60,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,399000,2,680),
   ('e0000000-0000-4000-8000-000000000061',61,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,365000,2,646),
   ('e0000000-0000-4000-8000-000000000062',62,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":true}'::jsonb,331000,2,612),
   ('e0000000-0000-4000-8000-000000000063',63,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":true}'::jsonb,297000,2,578),
   ('e0000000-0000-4000-8000-000000000064',64,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":true}'::jsonb,263000,2,544),
   ('e0000000-0000-4000-8000-000000000065',65,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":false}'::jsonb,229000,2,510),
   ('e0000000-0000-4000-8000-000000000066',66,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000105","points":3,"made":true}'::jsonb,195000,2,476),
   ('e0000000-0000-4000-8000-000000000067',67,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":true}'::jsonb,161000,2,442),
   ('e0000000-0000-4000-8000-000000000068',68,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,127000,2,408),
   ('e0000000-0000-4000-8000-000000000069',69,'period_end','{}'::jsonb,0,2,408),
   ('e0000000-0000-4000-8000-000000000070',70,'period_start','{}'::jsonb,null,3,408),
   ('e0000000-0000-4000-8000-000000000071',71,'clock_start','{}'::jsonb,600000,3,408),
   ('e0000000-0000-4000-8000-000000000072',72,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":true}'::jsonb,565000,3,373),
   ('e0000000-0000-4000-8000-000000000073',73,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,559000,3,367),
   ('e0000000-0000-4000-8000-000000000074',74,'clock_start','{}'::jsonb,559000,3,367),
   ('e0000000-0000-4000-8000-000000000075',75,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,524000,3,332),
   ('e0000000-0000-4000-8000-000000000076',76,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","kind":"personal"}'::jsonb,518000,3,326),
   ('e0000000-0000-4000-8000-000000000077',77,'clock_start','{}'::jsonb,518000,3,326),
   ('e0000000-0000-4000-8000-000000000078',78,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,483000,3,291),
   ('e0000000-0000-4000-8000-000000000079',79,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,477000,3,285),
   ('e0000000-0000-4000-8000-000000000080',80,'clock_start','{}'::jsonb,477000,3,285),
   ('e0000000-0000-4000-8000-000000000081',81,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,442000,3,250),
   ('e0000000-0000-4000-8000-000000000082',82,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,436000,3,244),
   ('e0000000-0000-4000-8000-000000000083',83,'clock_start','{}'::jsonb,436000,3,244),
   ('e0000000-0000-4000-8000-000000000084',84,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":true}'::jsonb,401000,3,209),
   ('e0000000-0000-4000-8000-000000000085',85,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","kind":"personal"}'::jsonb,395000,3,203),
   ('e0000000-0000-4000-8000-000000000086',86,'clock_start','{}'::jsonb,395000,3,203),
   ('e0000000-0000-4000-8000-000000000087',87,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,360000,3,168),
   ('e0000000-0000-4000-8000-000000000088',88,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,325000,3,133),
   ('e0000000-0000-4000-8000-000000000089',89,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,290000,3,98),
   ('e0000000-0000-4000-8000-000000000090',90,'clock_stop','{}'::jsonb,252000,3,60),
   ('e0000000-0000-4000-8000-000000000091',91,'timeout','{"team":"home"}'::jsonb,252000,3,60)
  ) as e(id,sequence,type,payload,clock_ms,period,ago);
 end if;
end;
$$;

-- Finished games for the games list and standings: two approved results and one
-- waiting for the commissioner's approval. Played out with the basketball rules;
-- results and box scores are what approval stores. Added only once.
do $$
declare
 l uuid := '00000000-0000-4000-8000-000000000001';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 division_uuid uuid;
 starts timestamptz;
 inserted uuid;
begin
 select id into strict division_uuid from public.divisions where league_id=l and season_id=s and name='Division B';
 if exists(select 1 from public.games where id in('c0000000-0000-4000-8000-000000000008','c0000000-0000-4000-8000-000000000009','c0000000-0000-4000-8000-000000000010') and league_id<>l) then raise exception 'Demo game identity collision'; end if;

 -- Game 8: 68-44, approved.
 starts:=date_trunc('hour',now())-interval '6 days'-interval '1 hour';
 inserted:=null;
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,status,created_by)
 values('c0000000-0000-4000-8000-000000000008',l,s,division_uuid,'b0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000007',starts,'Main court','approved',commissioner)
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  select e.id::uuid,l,'c0000000-0000-4000-8000-000000000008',e.sequence,e.type,e.payload,e.clock_ms,e.period,starts+make_interval(secs=>e.at),commissioner
  from (values
   ('e0000008-0000-4000-8000-000000000001',1,'roster','{"team":"home","players":[{"playerId":"90000000-0000-4000-8000-000000000501","name":"Juan Garcia","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000502","name":"Miguel Garcia","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000503","name":"Marco Garcia","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000504","name":"Luis Garcia","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000505","name":"Anton Garcia","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000506","name":"Jose Garcia","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000507","name":"Gabriel Garcia","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000508","name":"Rafael Garcia","jersey":8}]}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000002',2,'roster','{"team":"away","players":[{"playerId":"90000000-0000-4000-8000-000000000701","name":"Juan Bautista","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000702","name":"Miguel Bautista","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000703","name":"Marco Bautista","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000704","name":"Luis Bautista","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000705","name":"Anton Bautista","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000706","name":"Jose Bautista","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000707","name":"Gabriel Bautista","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000708","name":"Rafael Bautista","jersey":8}]}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000003',3,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000004',4,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000005',5,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000006',6,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000007',7,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000008',8,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000009',9,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000507"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000010',10,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000011',11,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000012',12,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000013',13,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000014',14,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000015',15,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000705"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000016',16,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000706"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000017',17,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000707"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000018',18,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000019',19,'officials','{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000020',20,'starters','{"team":"home","playerIds":["90000000-0000-4000-8000-000000000501","90000000-0000-4000-8000-000000000502","90000000-0000-4000-8000-000000000503","90000000-0000-4000-8000-000000000504","90000000-0000-4000-8000-000000000505"]}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000021',21,'starters','{"team":"away","playerIds":["90000000-0000-4000-8000-000000000701","90000000-0000-4000-8000-000000000702","90000000-0000-4000-8000-000000000703","90000000-0000-4000-8000-000000000704","90000000-0000-4000-8000-000000000705"]}'::jsonb,null,0,0),
   ('e0000008-0000-4000-8000-000000000022',22,'period_start','{}'::jsonb,null,1,0),
   ('e0000008-0000-4000-8000-000000000023',23,'clock_start','{}'::jsonb,600000,1,0),
   ('e0000008-0000-4000-8000-000000000024',24,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":true}'::jsonb,570000,1,30),
   ('e0000008-0000-4000-8000-000000000025',25,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":true}'::jsonb,548000,1,52),
   ('e0000008-0000-4000-8000-000000000026',26,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":2,"made":true}'::jsonb,528000,1,72),
   ('e0000008-0000-4000-8000-000000000027',27,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":3,"made":true}'::jsonb,507000,1,93),
   ('e0000008-0000-4000-8000-000000000028',28,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","kind":"personal"}'::jsonb,504000,1,96),
   ('e0000008-0000-4000-8000-000000000029',29,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":1,"made":false}'::jsonb,504000,1,96),
   ('e0000008-0000-4000-8000-000000000030',30,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":1,"made":true}'::jsonb,504000,1,96),
   ('e0000008-0000-4000-8000-000000000031',31,'clock_start','{}'::jsonb,504000,1,96),
   ('e0000008-0000-4000-8000-000000000032',32,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":false}'::jsonb,474000,1,126),
   ('e0000008-0000-4000-8000-000000000033',33,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,451000,1,149),
   ('e0000008-0000-4000-8000-000000000034',34,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,424000,1,176),
   ('e0000008-0000-4000-8000-000000000035',35,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":3,"made":false}'::jsonb,405000,1,195),
   ('e0000008-0000-4000-8000-000000000036',36,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":true}'::jsonb,382000,1,218),
   ('e0000008-0000-4000-8000-000000000037',37,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":3,"made":false}'::jsonb,360000,1,240),
   ('e0000008-0000-4000-8000-000000000038',38,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,335000,1,265),
   ('e0000008-0000-4000-8000-000000000039',39,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":true}'::jsonb,314000,1,286),
   ('e0000008-0000-4000-8000-000000000040',40,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":2,"made":true}'::jsonb,294000,1,306),
   ('e0000008-0000-4000-8000-000000000041',41,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":2,"made":false}'::jsonb,269000,1,331),
   ('e0000008-0000-4000-8000-000000000042',42,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":true}'::jsonb,238000,1,362),
   ('e0000008-0000-4000-8000-000000000043',43,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":3,"made":true}'::jsonb,208000,1,392),
   ('e0000008-0000-4000-8000-000000000044',44,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,181000,1,419),
   ('e0000008-0000-4000-8000-000000000045',45,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":2,"made":false}'::jsonb,159000,1,441),
   ('e0000008-0000-4000-8000-000000000046',46,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":3,"made":false}'::jsonb,134000,1,466),
   ('e0000008-0000-4000-8000-000000000047',47,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","kind":"personal"}'::jsonb,131000,1,469),
   ('e0000008-0000-4000-8000-000000000048',48,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":false}'::jsonb,131000,1,469),
   ('e0000008-0000-4000-8000-000000000049',49,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":false}'::jsonb,131000,1,469),
   ('e0000008-0000-4000-8000-000000000050',50,'clock_start','{}'::jsonb,131000,1,469),
   ('e0000008-0000-4000-8000-000000000051',51,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":2,"made":true}'::jsonb,111000,1,489),
   ('e0000008-0000-4000-8000-000000000052',52,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,90000,1,510),
   ('e0000008-0000-4000-8000-000000000053',53,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":3,"made":false}'::jsonb,69000,1,531),
   ('e0000008-0000-4000-8000-000000000054',54,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,42000,1,558),
   ('e0000008-0000-4000-8000-000000000055',55,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,11000,1,589),
   ('e0000008-0000-4000-8000-000000000056',56,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","kind":"personal"}'::jsonb,8000,1,592),
   ('e0000008-0000-4000-8000-000000000057',57,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":1,"made":false}'::jsonb,8000,1,592),
   ('e0000008-0000-4000-8000-000000000058',58,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":1,"made":true}'::jsonb,8000,1,592),
   ('e0000008-0000-4000-8000-000000000059',59,'clock_start','{}'::jsonb,8000,1,592),
   ('e0000008-0000-4000-8000-000000000060',60,'period_end','{}'::jsonb,0,1,592),
   ('e0000008-0000-4000-8000-000000000061',61,'period_start','{}'::jsonb,null,2,592),
   ('e0000008-0000-4000-8000-000000000062',62,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000504","in":"90000000-0000-4000-8000-000000000508"}'::jsonb,600000,2,592),
   ('e0000008-0000-4000-8000-000000000063',63,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000704","in":"90000000-0000-4000-8000-000000000708"}'::jsonb,600000,2,592),
   ('e0000008-0000-4000-8000-000000000064',64,'clock_start','{}'::jsonb,600000,2,592),
   ('e0000008-0000-4000-8000-000000000065',65,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":true}'::jsonb,579000,2,613),
   ('e0000008-0000-4000-8000-000000000066',66,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":2,"made":true}'::jsonb,552000,2,640),
   ('e0000008-0000-4000-8000-000000000067',67,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":false}'::jsonb,530000,2,662),
   ('e0000008-0000-4000-8000-000000000068',68,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,500000,2,692),
   ('e0000008-0000-4000-8000-000000000069',69,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000705","kind":"personal"}'::jsonb,497000,2,695),
   ('e0000008-0000-4000-8000-000000000070',70,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":true}'::jsonb,497000,2,695),
   ('e0000008-0000-4000-8000-000000000071',71,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":false}'::jsonb,497000,2,695),
   ('e0000008-0000-4000-8000-000000000072',72,'clock_start','{}'::jsonb,497000,2,695),
   ('e0000008-0000-4000-8000-000000000073',73,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":true}'::jsonb,479000,2,713),
   ('e0000008-0000-4000-8000-000000000074',74,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","kind":"personal"}'::jsonb,476000,2,716),
   ('e0000008-0000-4000-8000-000000000075',75,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":1,"made":true}'::jsonb,476000,2,716),
   ('e0000008-0000-4000-8000-000000000076',76,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":1,"made":true}'::jsonb,476000,2,716),
   ('e0000008-0000-4000-8000-000000000077',77,'clock_start','{}'::jsonb,476000,2,716),
   ('e0000008-0000-4000-8000-000000000078',78,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,453000,2,739),
   ('e0000008-0000-4000-8000-000000000079',79,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","kind":"personal"}'::jsonb,450000,2,742),
   ('e0000008-0000-4000-8000-000000000080',80,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":false}'::jsonb,450000,2,742),
   ('e0000008-0000-4000-8000-000000000081',81,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,450000,2,742),
   ('e0000008-0000-4000-8000-000000000082',82,'clock_start','{}'::jsonb,450000,2,742),
   ('e0000008-0000-4000-8000-000000000083',83,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":2,"made":false}'::jsonb,425000,2,767),
   ('e0000008-0000-4000-8000-000000000084',84,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":false}'::jsonb,407000,2,785),
   ('e0000008-0000-4000-8000-000000000085',85,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,384000,2,808),
   ('e0000008-0000-4000-8000-000000000086',86,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,354000,2,838),
   ('e0000008-0000-4000-8000-000000000087',87,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":false}'::jsonb,325000,2,867),
   ('e0000008-0000-4000-8000-000000000088',88,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":true}'::jsonb,294000,2,898),
   ('e0000008-0000-4000-8000-000000000089',89,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,270000,2,922),
   ('e0000008-0000-4000-8000-000000000090',90,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,250000,2,942),
   ('e0000008-0000-4000-8000-000000000091',91,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":true}'::jsonb,229000,2,963),
   ('e0000008-0000-4000-8000-000000000092',92,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,205000,2,987),
   ('e0000008-0000-4000-8000-000000000093',93,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,183000,2,1009),
   ('e0000008-0000-4000-8000-000000000094',94,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":false}'::jsonb,163000,2,1029),
   ('e0000008-0000-4000-8000-000000000095',95,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","kind":"personal"}'::jsonb,160000,2,1032),
   ('e0000008-0000-4000-8000-000000000096',96,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":true}'::jsonb,160000,2,1032),
   ('e0000008-0000-4000-8000-000000000097',97,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":true}'::jsonb,160000,2,1032),
   ('e0000008-0000-4000-8000-000000000098',98,'clock_start','{}'::jsonb,160000,2,1032),
   ('e0000008-0000-4000-8000-000000000099',99,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000705","points":2,"made":false}'::jsonb,141000,2,1051),
   ('e0000008-0000-4000-8000-000000000100',100,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,110000,2,1082),
   ('e0000008-0000-4000-8000-000000000101',101,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":true}'::jsonb,86000,2,1106),
   ('e0000008-0000-4000-8000-000000000102',102,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,62000,2,1130),
   ('e0000008-0000-4000-8000-000000000103',103,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","kind":"personal"}'::jsonb,59000,2,1133),
   ('e0000008-0000-4000-8000-000000000104',104,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":false}'::jsonb,59000,2,1133),
   ('e0000008-0000-4000-8000-000000000105',105,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":true}'::jsonb,59000,2,1133),
   ('e0000008-0000-4000-8000-000000000106',106,'clock_start','{}'::jsonb,59000,2,1133),
   ('e0000008-0000-4000-8000-000000000107',107,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":false}'::jsonb,40000,2,1152),
   ('e0000008-0000-4000-8000-000000000108',108,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":false}'::jsonb,15000,2,1177),
   ('e0000008-0000-4000-8000-000000000109',109,'period_end','{}'::jsonb,0,2,1177),
   ('e0000008-0000-4000-8000-000000000110',110,'period_start','{}'::jsonb,null,3,1177),
   ('e0000008-0000-4000-8000-000000000111',111,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000505","in":"90000000-0000-4000-8000-000000000504"}'::jsonb,600000,3,1177),
   ('e0000008-0000-4000-8000-000000000112',112,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000705","in":"90000000-0000-4000-8000-000000000704"}'::jsonb,600000,3,1177),
   ('e0000008-0000-4000-8000-000000000113',113,'clock_start','{}'::jsonb,600000,3,1177),
   ('e0000008-0000-4000-8000-000000000114',114,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,572000,3,1205),
   ('e0000008-0000-4000-8000-000000000115',115,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000704","points":2,"made":false}'::jsonb,545000,3,1232),
   ('e0000008-0000-4000-8000-000000000116',116,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":3,"made":true}'::jsonb,518000,3,1259),
   ('e0000008-0000-4000-8000-000000000117',117,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","kind":"personal"}'::jsonb,515000,3,1262),
   ('e0000008-0000-4000-8000-000000000118',118,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":true}'::jsonb,515000,3,1262),
   ('e0000008-0000-4000-8000-000000000119',119,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":true}'::jsonb,515000,3,1262),
   ('e0000008-0000-4000-8000-000000000120',120,'clock_start','{}'::jsonb,515000,3,1262),
   ('e0000008-0000-4000-8000-000000000121',121,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":false}'::jsonb,485000,3,1292),
   ('e0000008-0000-4000-8000-000000000122',122,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,454000,3,1323),
   ('e0000008-0000-4000-8000-000000000123',123,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":false}'::jsonb,426000,3,1351),
   ('e0000008-0000-4000-8000-000000000124',124,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","kind":"personal"}'::jsonb,423000,3,1354),
   ('e0000008-0000-4000-8000-000000000125',125,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":1,"made":false}'::jsonb,423000,3,1354),
   ('e0000008-0000-4000-8000-000000000126',126,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":1,"made":true}'::jsonb,423000,3,1354),
   ('e0000008-0000-4000-8000-000000000127',127,'clock_start','{}'::jsonb,423000,3,1354),
   ('e0000008-0000-4000-8000-000000000128',128,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":false}'::jsonb,402000,3,1375),
   ('e0000008-0000-4000-8000-000000000129',129,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","kind":"personal"}'::jsonb,399000,3,1378),
   ('e0000008-0000-4000-8000-000000000130',130,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":true}'::jsonb,399000,3,1378),
   ('e0000008-0000-4000-8000-000000000131',131,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":false}'::jsonb,399000,3,1378),
   ('e0000008-0000-4000-8000-000000000132',132,'clock_start','{}'::jsonb,399000,3,1378),
   ('e0000008-0000-4000-8000-000000000133',133,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":true}'::jsonb,379000,3,1398),
   ('e0000008-0000-4000-8000-000000000134',134,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":true}'::jsonb,358000,3,1419),
   ('e0000008-0000-4000-8000-000000000135',135,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","kind":"personal"}'::jsonb,355000,3,1422),
   ('e0000008-0000-4000-8000-000000000136',136,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":1,"made":false}'::jsonb,355000,3,1422),
   ('e0000008-0000-4000-8000-000000000137',137,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":1,"made":false}'::jsonb,355000,3,1422),
   ('e0000008-0000-4000-8000-000000000138',138,'clock_start','{}'::jsonb,355000,3,1422),
   ('e0000008-0000-4000-8000-000000000139',139,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,332000,3,1445),
   ('e0000008-0000-4000-8000-000000000140',140,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,311000,3,1466),
   ('e0000008-0000-4000-8000-000000000141',141,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,288000,3,1489),
   ('e0000008-0000-4000-8000-000000000142',142,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,270000,3,1507),
   ('e0000008-0000-4000-8000-000000000143',143,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,249000,3,1528),
   ('e0000008-0000-4000-8000-000000000144',144,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":true}'::jsonb,230000,3,1547),
   ('e0000008-0000-4000-8000-000000000145',145,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","kind":"personal"}'::jsonb,227000,3,1550),
   ('e0000008-0000-4000-8000-000000000146',146,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":true}'::jsonb,227000,3,1550),
   ('e0000008-0000-4000-8000-000000000147',147,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":1,"made":true}'::jsonb,227000,3,1550),
   ('e0000008-0000-4000-8000-000000000148',148,'clock_start','{}'::jsonb,227000,3,1550),
   ('e0000008-0000-4000-8000-000000000149',149,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000701","points":3,"made":false}'::jsonb,209000,3,1568),
   ('e0000008-0000-4000-8000-000000000150',150,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":true}'::jsonb,182000,3,1595),
   ('e0000008-0000-4000-8000-000000000151',151,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":true}'::jsonb,160000,3,1617),
   ('e0000008-0000-4000-8000-000000000152',152,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":true}'::jsonb,139000,3,1638),
   ('e0000008-0000-4000-8000-000000000153',153,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":3,"made":false}'::jsonb,108000,3,1669),
   ('e0000008-0000-4000-8000-000000000154',154,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":false}'::jsonb,89000,3,1688),
   ('e0000008-0000-4000-8000-000000000155',155,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","kind":"personal"}'::jsonb,86000,3,1691),
   ('e0000008-0000-4000-8000-000000000156',156,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":1,"made":true}'::jsonb,86000,3,1691),
   ('e0000008-0000-4000-8000-000000000157',157,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":1,"made":true}'::jsonb,86000,3,1691),
   ('e0000008-0000-4000-8000-000000000158',158,'clock_start','{}'::jsonb,86000,3,1691),
   ('e0000008-0000-4000-8000-000000000159',159,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":true}'::jsonb,67000,3,1710),
   ('e0000008-0000-4000-8000-000000000160',160,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","kind":"personal"}'::jsonb,64000,3,1713),
   ('e0000008-0000-4000-8000-000000000161',161,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":1,"made":false}'::jsonb,64000,3,1713),
   ('e0000008-0000-4000-8000-000000000162',162,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":1,"made":false}'::jsonb,64000,3,1713),
   ('e0000008-0000-4000-8000-000000000163',163,'clock_start','{}'::jsonb,64000,3,1713),
   ('e0000008-0000-4000-8000-000000000164',164,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":true}'::jsonb,37000,3,1740),
   ('e0000008-0000-4000-8000-000000000165',165,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":true}'::jsonb,18000,3,1759),
   ('e0000008-0000-4000-8000-000000000166',166,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","kind":"personal"}'::jsonb,15000,3,1762),
   ('e0000008-0000-4000-8000-000000000167',167,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":1,"made":true}'::jsonb,15000,3,1762),
   ('e0000008-0000-4000-8000-000000000168',168,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":1,"made":true}'::jsonb,15000,3,1762),
   ('e0000008-0000-4000-8000-000000000169',169,'clock_start','{}'::jsonb,15000,3,1762),
   ('e0000008-0000-4000-8000-000000000170',170,'period_end','{}'::jsonb,0,3,1762),
   ('e0000008-0000-4000-8000-000000000171',171,'period_start','{}'::jsonb,null,4,1762),
   ('e0000008-0000-4000-8000-000000000172',172,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000501","in":"90000000-0000-4000-8000-000000000506"}'::jsonb,600000,4,1762),
   ('e0000008-0000-4000-8000-000000000173',173,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000701","in":"90000000-0000-4000-8000-000000000706"}'::jsonb,600000,4,1762),
   ('e0000008-0000-4000-8000-000000000174',174,'clock_start','{}'::jsonb,600000,4,1762),
   ('e0000008-0000-4000-8000-000000000175',175,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,579000,4,1783),
   ('e0000008-0000-4000-8000-000000000176',176,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":3,"made":false}'::jsonb,557000,4,1805),
   ('e0000008-0000-4000-8000-000000000177',177,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":3,"made":false}'::jsonb,528000,4,1834),
   ('e0000008-0000-4000-8000-000000000178',178,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,506000,4,1856),
   ('e0000008-0000-4000-8000-000000000179',179,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,479000,4,1883),
   ('e0000008-0000-4000-8000-000000000180',180,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,455000,4,1907),
   ('e0000008-0000-4000-8000-000000000181',181,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000706","points":2,"made":true}'::jsonb,424000,4,1938),
   ('e0000008-0000-4000-8000-000000000182',182,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,399000,4,1963),
   ('e0000008-0000-4000-8000-000000000183',183,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","kind":"personal"}'::jsonb,396000,4,1966),
   ('e0000008-0000-4000-8000-000000000184',184,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,396000,4,1966),
   ('e0000008-0000-4000-8000-000000000185',185,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":false}'::jsonb,396000,4,1966),
   ('e0000008-0000-4000-8000-000000000186',186,'clock_start','{}'::jsonb,396000,4,1966),
   ('e0000008-0000-4000-8000-000000000187',187,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":false}'::jsonb,378000,4,1984),
   ('e0000008-0000-4000-8000-000000000188',188,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,358000,4,2004),
   ('e0000008-0000-4000-8000-000000000189',189,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000706","points":2,"made":false}'::jsonb,340000,4,2022),
   ('e0000008-0000-4000-8000-000000000190',190,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,315000,4,2047),
   ('e0000008-0000-4000-8000-000000000191',191,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000702","points":2,"made":false}'::jsonb,289000,4,2073),
   ('e0000008-0000-4000-8000-000000000192',192,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":3,"made":true}'::jsonb,259000,4,2103),
   ('e0000008-0000-4000-8000-000000000193',193,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000706","points":2,"made":true}'::jsonb,238000,4,2124),
   ('e0000008-0000-4000-8000-000000000194',194,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,219000,4,2143),
   ('e0000008-0000-4000-8000-000000000195',195,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":true}'::jsonb,188000,4,2174),
   ('e0000008-0000-4000-8000-000000000196',196,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,160000,4,2202),
   ('e0000008-0000-4000-8000-000000000197',197,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000703","points":2,"made":false}'::jsonb,133000,4,2229),
   ('e0000008-0000-4000-8000-000000000198',198,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,113000,4,2249),
   ('e0000008-0000-4000-8000-000000000199',199,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":false}'::jsonb,90000,4,2272),
   ('e0000008-0000-4000-8000-000000000200',200,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":3,"made":false}'::jsonb,63000,4,2299),
   ('e0000008-0000-4000-8000-000000000201',201,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","kind":"personal"}'::jsonb,60000,4,2302),
   ('e0000008-0000-4000-8000-000000000202',202,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":1,"made":true}'::jsonb,60000,4,2302),
   ('e0000008-0000-4000-8000-000000000203',203,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":1,"made":true}'::jsonb,60000,4,2302),
   ('e0000008-0000-4000-8000-000000000204',204,'clock_start','{}'::jsonb,60000,4,2302),
   ('e0000008-0000-4000-8000-000000000205',205,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000708","points":2,"made":true}'::jsonb,35000,4,2327),
   ('e0000008-0000-4000-8000-000000000206',206,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":false}'::jsonb,8000,4,2354),
   ('e0000008-0000-4000-8000-000000000207',207,'period_end','{}'::jsonb,0,4,2354),
   ('e0000008-0000-4000-8000-000000000208',208,'game_end','{}'::jsonb,null,4,2354)
  ) as e(id,sequence,type,payload,clock_ms,period,at);
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'c0000000-0000-4000-8000-000000000008','submitted',commissioner,starts+interval '2 hours');
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'c0000000-0000-4000-8000-000000000008','approved',commissioner,starts+interval '3 hours');
  insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by,approved_at)
  values('c0000000-0000-4000-8000-000000000008',l,68,44,208,'{"sport":"basketball","periods":4,"winner":"home","officials":{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"},"confirmations":[],"protests":[],"teams":{"home":{"name":"Taif Titans","score":68,"pointsByPeriod":{"1":16,"2":13,"3":25,"4":14},"teamFouls":{"1":2,"2":1,"3":3},"timeoutsUsed":{},"benchTechnicals":0,"coachFouls":{"coach":0,"bench":0},"coachEjected":false,"coach":null,"assistantCoach":null,"captainId":null,"timeouts":[],"shotClockViolations":0,"players":[{"playerId":"90000000-0000-4000-8000-000000000501","name":"Juan Garcia","jersey":1,"starter":true,"minutes":30,"points":12,"fieldGoals":{"made":4,"attempted":8},"threePointers":{"made":1,"attempted":3},"freeThrows":{"made":3,"attempted":4},"fouls":3,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000502","name":"Miguel Garcia","jersey":2,"starter":true,"minutes":40,"points":6,"fieldGoals":{"made":2,"attempted":6},"threePointers":{"made":0,"attempted":2},"freeThrows":{"made":2,"attempted":6},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000503","name":"Marco Garcia","jersey":3,"starter":true,"minutes":40,"points":19,"fieldGoals":{"made":9,"attempted":12},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":1,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000504","name":"Luis Garcia","jersey":4,"starter":true,"minutes":30,"points":8,"fieldGoals":{"made":3,"attempted":9},"threePointers":{"made":0,"attempted":3},"freeThrows":{"made":2,"attempted":4},"fouls":2,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000505","name":"Anton Garcia","jersey":5,"starter":true,"minutes":20,"points":6,"fieldGoals":{"made":3,"attempted":3},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000506","name":"Jose Garcia","jersey":6,"starter":false,"minutes":10,"points":5,"fieldGoals":{"made":1,"attempted":2},"threePointers":{"made":1,"attempted":2},"freeThrows":{"made":2,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000507","name":"Gabriel Garcia","jersey":7,"starter":false,"minutes":0,"points":0,"fieldGoals":{"made":0,"attempted":0},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000508","name":"Rafael Garcia","jersey":8,"starter":false,"minutes":30,"points":12,"fieldGoals":{"made":3,"attempted":8},"threePointers":{"made":1,"attempted":1},"freeThrows":{"made":5,"attempted":6},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}],"totals":{"points":68,"fieldGoals":{"made":25,"attempted":48},"threePointers":{"made":3,"attempted":11},"freeThrows":{"made":15,"attempted":24},"fouls":6,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}},"away":{"name":"Hail Hawks","score":44,"pointsByPeriod":{"1":14,"2":11,"3":11,"4":8},"teamFouls":{"1":1,"2":4,"3":5,"4":2},"timeoutsUsed":{},"benchTechnicals":0,"coachFouls":{"coach":0,"bench":0},"coachEjected":false,"coach":null,"assistantCoach":null,"captainId":null,"timeouts":[],"shotClockViolations":0,"players":[{"playerId":"90000000-0000-4000-8000-000000000701","name":"Juan Bautista","jersey":1,"starter":true,"minutes":30,"points":4,"fieldGoals":{"made":1,"attempted":8},"threePointers":{"made":1,"attempted":7},"freeThrows":{"made":1,"attempted":2},"fouls":2,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000702","name":"Miguel Bautista","jersey":2,"starter":true,"minutes":40,"points":9,"fieldGoals":{"made":4,"attempted":12},"threePointers":{"made":1,"attempted":3},"freeThrows":{"made":0,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000703","name":"Marco Bautista","jersey":3,"starter":true,"minutes":40,"points":9,"fieldGoals":{"made":4,"attempted":10},"threePointers":{"made":0,"attempted":1},"freeThrows":{"made":1,"attempted":2},"fouls":4,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000704","name":"Luis Bautista","jersey":4,"starter":true,"minutes":30,"points":6,"fieldGoals":{"made":2,"attempted":6},"threePointers":{"made":1,"attempted":2},"freeThrows":{"made":1,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000705","name":"Anton Bautista","jersey":5,"starter":true,"minutes":20,"points":0,"fieldGoals":{"made":0,"attempted":1},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000706","name":"Jose Bautista","jersey":6,"starter":false,"minutes":10,"points":4,"fieldGoals":{"made":2,"attempted":3},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000707","name":"Gabriel Bautista","jersey":7,"starter":false,"minutes":0,"points":0,"fieldGoals":{"made":0,"attempted":0},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000708","name":"Rafael Bautista","jersey":8,"starter":false,"minutes":30,"points":12,"fieldGoals":{"made":4,"attempted":8},"threePointers":{"made":0,"attempted":1},"freeThrows":{"made":4,"attempted":4},"fouls":4,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}],"totals":{"points":44,"fieldGoals":{"made":17,"attempted":48},"threePointers":{"made":3,"attempted":14},"freeThrows":{"made":7,"attempted":12},"fouls":12,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}}}}'::jsonb,commissioner,starts+interval '3 hours');
 end if;
 -- Game 9: 42-43, approved.
 starts:=date_trunc('hour',now())-interval '3 days'-interval '1 hour';
 inserted:=null;
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,status,created_by)
 values('c0000000-0000-4000-8000-000000000009',l,s,division_uuid,'b0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000001',starts,'Main court','approved',commissioner)
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  select e.id::uuid,l,'c0000000-0000-4000-8000-000000000009',e.sequence,e.type,e.payload,e.clock_ms,e.period,starts+make_interval(secs=>e.at),commissioner
  from (values
   ('e0000009-0000-4000-8000-000000000001',1,'roster','{"team":"home","players":[{"playerId":"90000000-0000-4000-8000-000000000601","name":"Juan Mendoza","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000602","name":"Miguel Mendoza","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000603","name":"Marco Mendoza","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000604","name":"Luis Mendoza","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000605","name":"Anton Mendoza","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000606","name":"Jose Mendoza","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000607","name":"Gabriel Mendoza","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000608","name":"Rafael Mendoza","jersey":8}]}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000002',2,'roster','{"team":"away","players":[{"playerId":"90000000-0000-4000-8000-000000000101","name":"Juan Dela Cruz","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000102","name":"Miguel Dela Cruz","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000103","name":"Marco Dela Cruz","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000104","name":"Luis Dela Cruz","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000105","name":"Anton Dela Cruz","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000106","name":"Jose Dela Cruz","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000107","name":"Gabriel Dela Cruz","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000108","name":"Rafael Dela Cruz","jersey":8}]}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000003',3,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000004',4,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000005',5,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000006',6,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000007',7,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000008',8,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000009',9,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000607"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000010',10,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000011',11,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000012',12,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000013',13,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000014',14,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000015',15,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000016',16,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000106"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000017',17,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000107"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000018',18,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000019',19,'officials','{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000020',20,'starters','{"team":"home","playerIds":["90000000-0000-4000-8000-000000000601","90000000-0000-4000-8000-000000000602","90000000-0000-4000-8000-000000000603","90000000-0000-4000-8000-000000000604","90000000-0000-4000-8000-000000000605"]}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000021',21,'starters','{"team":"away","playerIds":["90000000-0000-4000-8000-000000000101","90000000-0000-4000-8000-000000000102","90000000-0000-4000-8000-000000000103","90000000-0000-4000-8000-000000000104","90000000-0000-4000-8000-000000000105"]}'::jsonb,null,0,0),
   ('e0000009-0000-4000-8000-000000000022',22,'period_start','{}'::jsonb,null,1,0),
   ('e0000009-0000-4000-8000-000000000023',23,'clock_start','{}'::jsonb,600000,1,0),
   ('e0000009-0000-4000-8000-000000000024',24,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","points":3,"made":false}'::jsonb,569000,1,31),
   ('e0000009-0000-4000-8000-000000000025',25,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,550000,1,50),
   ('e0000009-0000-4000-8000-000000000026',26,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":false}'::jsonb,532000,1,68),
   ('e0000009-0000-4000-8000-000000000027',27,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":3,"made":false}'::jsonb,502000,1,98),
   ('e0000009-0000-4000-8000-000000000028',28,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":3,"made":false}'::jsonb,478000,1,122),
   ('e0000009-0000-4000-8000-000000000029',29,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":3,"made":false}'::jsonb,458000,1,142),
   ('e0000009-0000-4000-8000-000000000030',30,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,455000,1,145),
   ('e0000009-0000-4000-8000-000000000031',31,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":1,"made":false}'::jsonb,455000,1,145),
   ('e0000009-0000-4000-8000-000000000032',32,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":1,"made":false}'::jsonb,455000,1,145),
   ('e0000009-0000-4000-8000-000000000033',33,'clock_start','{}'::jsonb,455000,1,145),
   ('e0000009-0000-4000-8000-000000000034',34,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605","points":2,"made":false}'::jsonb,437000,1,163),
   ('e0000009-0000-4000-8000-000000000035',35,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,415000,1,185),
   ('e0000009-0000-4000-8000-000000000036',36,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,395000,1,205),
   ('e0000009-0000-4000-8000-000000000037',37,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":true}'::jsonb,366000,1,234),
   ('e0000009-0000-4000-8000-000000000038',38,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,343000,1,257),
   ('e0000009-0000-4000-8000-000000000039',39,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":false}'::jsonb,318000,1,282),
   ('e0000009-0000-4000-8000-000000000040',40,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":true}'::jsonb,290000,1,310),
   ('e0000009-0000-4000-8000-000000000041',41,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":false}'::jsonb,264000,1,336),
   ('e0000009-0000-4000-8000-000000000042',42,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":true}'::jsonb,238000,1,362),
   ('e0000009-0000-4000-8000-000000000043',43,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":false}'::jsonb,220000,1,380),
   ('e0000009-0000-4000-8000-000000000044',44,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,197000,1,403),
   ('e0000009-0000-4000-8000-000000000045',45,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":false}'::jsonb,176000,1,424),
   ('e0000009-0000-4000-8000-000000000046',46,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":false}'::jsonb,152000,1,448),
   ('e0000009-0000-4000-8000-000000000047',47,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":3,"made":true}'::jsonb,128000,1,472),
   ('e0000009-0000-4000-8000-000000000048',48,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":false}'::jsonb,109000,1,491),
   ('e0000009-0000-4000-8000-000000000049',49,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":false}'::jsonb,79000,1,521),
   ('e0000009-0000-4000-8000-000000000050',50,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605","points":3,"made":true}'::jsonb,55000,1,545),
   ('e0000009-0000-4000-8000-000000000051',51,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":2,"made":false}'::jsonb,27000,1,573),
   ('e0000009-0000-4000-8000-000000000052',52,'period_end','{}'::jsonb,0,1,573),
   ('e0000009-0000-4000-8000-000000000053',53,'period_start','{}'::jsonb,null,2,573),
   ('e0000009-0000-4000-8000-000000000054',54,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000604","in":"90000000-0000-4000-8000-000000000608"}'::jsonb,600000,2,573),
   ('e0000009-0000-4000-8000-000000000055',55,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000104","in":"90000000-0000-4000-8000-000000000108"}'::jsonb,600000,2,573),
   ('e0000009-0000-4000-8000-000000000056',56,'clock_start','{}'::jsonb,600000,2,573),
   ('e0000009-0000-4000-8000-000000000057',57,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":2,"made":false}'::jsonb,570000,2,603),
   ('e0000009-0000-4000-8000-000000000058',58,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,540000,2,633),
   ('e0000009-0000-4000-8000-000000000059',59,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":true}'::jsonb,521000,2,652),
   ('e0000009-0000-4000-8000-000000000060',60,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605","points":3,"made":false}'::jsonb,500000,2,673),
   ('e0000009-0000-4000-8000-000000000061',61,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":2,"made":false}'::jsonb,470000,2,703),
   ('e0000009-0000-4000-8000-000000000062',62,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":false}'::jsonb,448000,2,725),
   ('e0000009-0000-4000-8000-000000000063',63,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":3,"made":false}'::jsonb,426000,2,747),
   ('e0000009-0000-4000-8000-000000000064',64,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":false}'::jsonb,395000,2,778),
   ('e0000009-0000-4000-8000-000000000065',65,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000105","points":3,"made":false}'::jsonb,368000,2,805),
   ('e0000009-0000-4000-8000-000000000066',66,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":false}'::jsonb,350000,2,823),
   ('e0000009-0000-4000-8000-000000000067',67,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,322000,2,851),
   ('e0000009-0000-4000-8000-000000000068',68,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605","kind":"personal"}'::jsonb,319000,2,854),
   ('e0000009-0000-4000-8000-000000000069',69,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":true}'::jsonb,319000,2,854),
   ('e0000009-0000-4000-8000-000000000070',70,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":true}'::jsonb,319000,2,854),
   ('e0000009-0000-4000-8000-000000000071',71,'clock_start','{}'::jsonb,319000,2,854),
   ('e0000009-0000-4000-8000-000000000072',72,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":false}'::jsonb,291000,2,882),
   ('e0000009-0000-4000-8000-000000000073',73,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":false}'::jsonb,267000,2,906),
   ('e0000009-0000-4000-8000-000000000074',74,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":false}'::jsonb,241000,2,932),
   ('e0000009-0000-4000-8000-000000000075',75,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":3,"made":false}'::jsonb,222000,2,951),
   ('e0000009-0000-4000-8000-000000000076',76,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":3,"made":true}'::jsonb,195000,2,978),
   ('e0000009-0000-4000-8000-000000000077',77,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":3,"made":true}'::jsonb,177000,2,996),
   ('e0000009-0000-4000-8000-000000000078',78,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","kind":"personal"}'::jsonb,174000,2,999),
   ('e0000009-0000-4000-8000-000000000079',79,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":1,"made":true}'::jsonb,174000,2,999),
   ('e0000009-0000-4000-8000-000000000080',80,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":1,"made":false}'::jsonb,174000,2,999),
   ('e0000009-0000-4000-8000-000000000081',81,'clock_start','{}'::jsonb,174000,2,999),
   ('e0000009-0000-4000-8000-000000000082',82,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,152000,2,1021),
   ('e0000009-0000-4000-8000-000000000083',83,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,126000,2,1047),
   ('e0000009-0000-4000-8000-000000000084',84,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,123000,2,1050),
   ('e0000009-0000-4000-8000-000000000085',85,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":false}'::jsonb,123000,2,1050),
   ('e0000009-0000-4000-8000-000000000086',86,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":false}'::jsonb,123000,2,1050),
   ('e0000009-0000-4000-8000-000000000087',87,'clock_start','{}'::jsonb,123000,2,1050),
   ('e0000009-0000-4000-8000-000000000088',88,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","points":3,"made":false}'::jsonb,95000,2,1078),
   ('e0000009-0000-4000-8000-000000000089',89,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","kind":"personal"}'::jsonb,92000,2,1081),
   ('e0000009-0000-4000-8000-000000000090',90,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":true}'::jsonb,92000,2,1081),
   ('e0000009-0000-4000-8000-000000000091',91,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":true}'::jsonb,92000,2,1081),
   ('e0000009-0000-4000-8000-000000000092',92,'clock_start','{}'::jsonb,92000,2,1081),
   ('e0000009-0000-4000-8000-000000000093',93,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":false}'::jsonb,63000,2,1110),
   ('e0000009-0000-4000-8000-000000000094',94,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000605","points":2,"made":true}'::jsonb,36000,2,1137),
   ('e0000009-0000-4000-8000-000000000095',95,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,10000,2,1163),
   ('e0000009-0000-4000-8000-000000000096',96,'period_end','{}'::jsonb,0,2,1163),
   ('e0000009-0000-4000-8000-000000000097',97,'period_start','{}'::jsonb,null,3,1163),
   ('e0000009-0000-4000-8000-000000000098',98,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000605","in":"90000000-0000-4000-8000-000000000604"}'::jsonb,600000,3,1163),
   ('e0000009-0000-4000-8000-000000000099',99,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000105","in":"90000000-0000-4000-8000-000000000104"}'::jsonb,600000,3,1163),
   ('e0000009-0000-4000-8000-000000000100',100,'clock_start','{}'::jsonb,600000,3,1163),
   ('e0000009-0000-4000-8000-000000000101',101,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":false}'::jsonb,576000,3,1187),
   ('e0000009-0000-4000-8000-000000000102',102,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":2,"made":false}'::jsonb,551000,3,1212),
   ('e0000009-0000-4000-8000-000000000103',103,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","kind":"personal"}'::jsonb,548000,3,1215),
   ('e0000009-0000-4000-8000-000000000104',104,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":1,"made":true}'::jsonb,548000,3,1215),
   ('e0000009-0000-4000-8000-000000000105',105,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":1,"made":true}'::jsonb,548000,3,1215),
   ('e0000009-0000-4000-8000-000000000106',106,'clock_start','{}'::jsonb,548000,3,1215),
   ('e0000009-0000-4000-8000-000000000107',107,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,519000,3,1244),
   ('e0000009-0000-4000-8000-000000000108',108,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,494000,3,1269),
   ('e0000009-0000-4000-8000-000000000109',109,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,491000,3,1272),
   ('e0000009-0000-4000-8000-000000000110',110,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,491000,3,1272),
   ('e0000009-0000-4000-8000-000000000111',111,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":1,"made":true}'::jsonb,491000,3,1272),
   ('e0000009-0000-4000-8000-000000000112',112,'clock_start','{}'::jsonb,491000,3,1272),
   ('e0000009-0000-4000-8000-000000000113',113,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":false}'::jsonb,468000,3,1295),
   ('e0000009-0000-4000-8000-000000000114',114,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":true}'::jsonb,442000,3,1321),
   ('e0000009-0000-4000-8000-000000000115',115,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":3,"made":true}'::jsonb,422000,3,1341),
   ('e0000009-0000-4000-8000-000000000116',116,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":false}'::jsonb,397000,3,1366),
   ('e0000009-0000-4000-8000-000000000117',117,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":false}'::jsonb,372000,3,1391),
   ('e0000009-0000-4000-8000-000000000118',118,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":3,"made":false}'::jsonb,341000,3,1422),
   ('e0000009-0000-4000-8000-000000000119',119,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":3,"made":false}'::jsonb,313000,3,1450),
   ('e0000009-0000-4000-8000-000000000120',120,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":2,"made":true}'::jsonb,292000,3,1471),
   ('e0000009-0000-4000-8000-000000000121',121,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":false}'::jsonb,271000,3,1492),
   ('e0000009-0000-4000-8000-000000000122',122,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":false}'::jsonb,252000,3,1511),
   ('e0000009-0000-4000-8000-000000000123',123,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,233000,3,1530),
   ('e0000009-0000-4000-8000-000000000124',124,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000101","points":2,"made":true}'::jsonb,208000,3,1555),
   ('e0000009-0000-4000-8000-000000000125',125,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,177000,3,1586),
   ('e0000009-0000-4000-8000-000000000126',126,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":2,"made":false}'::jsonb,151000,3,1612),
   ('e0000009-0000-4000-8000-000000000127',127,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,130000,3,1633),
   ('e0000009-0000-4000-8000-000000000128',128,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":2,"made":false}'::jsonb,110000,3,1653),
   ('e0000009-0000-4000-8000-000000000129',129,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,90000,3,1673),
   ('e0000009-0000-4000-8000-000000000130',130,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":3,"made":false}'::jsonb,72000,3,1691),
   ('e0000009-0000-4000-8000-000000000131',131,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,69000,3,1694),
   ('e0000009-0000-4000-8000-000000000132',132,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":true}'::jsonb,69000,3,1694),
   ('e0000009-0000-4000-8000-000000000133',133,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":1,"made":false}'::jsonb,69000,3,1694),
   ('e0000009-0000-4000-8000-000000000134',134,'clock_start','{}'::jsonb,69000,3,1694),
   ('e0000009-0000-4000-8000-000000000135',135,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":false}'::jsonb,44000,3,1719),
   ('e0000009-0000-4000-8000-000000000136',136,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,41000,3,1722),
   ('e0000009-0000-4000-8000-000000000137',137,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":true}'::jsonb,41000,3,1722),
   ('e0000009-0000-4000-8000-000000000138',138,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":true}'::jsonb,41000,3,1722),
   ('e0000009-0000-4000-8000-000000000139',139,'clock_start','{}'::jsonb,41000,3,1722),
   ('e0000009-0000-4000-8000-000000000140',140,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":3,"made":true}'::jsonb,22000,3,1741),
   ('e0000009-0000-4000-8000-000000000141',141,'period_end','{}'::jsonb,0,3,1741),
   ('e0000009-0000-4000-8000-000000000142',142,'period_start','{}'::jsonb,null,4,1741),
   ('e0000009-0000-4000-8000-000000000143',143,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000601","in":"90000000-0000-4000-8000-000000000606"}'::jsonb,600000,4,1741),
   ('e0000009-0000-4000-8000-000000000144',144,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000101","in":"90000000-0000-4000-8000-000000000106"}'::jsonb,600000,4,1741),
   ('e0000009-0000-4000-8000-000000000145',145,'clock_start','{}'::jsonb,600000,4,1741),
   ('e0000009-0000-4000-8000-000000000146',146,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,569000,4,1772),
   ('e0000009-0000-4000-8000-000000000147',147,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":3,"made":false}'::jsonb,547000,4,1794),
   ('e0000009-0000-4000-8000-000000000148',148,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000106","points":3,"made":false}'::jsonb,527000,4,1814),
   ('e0000009-0000-4000-8000-000000000149',149,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,501000,4,1840),
   ('e0000009-0000-4000-8000-000000000150',150,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000106","points":3,"made":false}'::jsonb,483000,4,1858),
   ('e0000009-0000-4000-8000-000000000151',151,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":false}'::jsonb,464000,4,1877),
   ('e0000009-0000-4000-8000-000000000152',152,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000106","points":3,"made":true}'::jsonb,446000,4,1895),
   ('e0000009-0000-4000-8000-000000000153',153,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":2,"made":true}'::jsonb,416000,4,1925),
   ('e0000009-0000-4000-8000-000000000154',154,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","kind":"personal"}'::jsonb,413000,4,1928),
   ('e0000009-0000-4000-8000-000000000155',155,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":1,"made":true}'::jsonb,413000,4,1928),
   ('e0000009-0000-4000-8000-000000000156',156,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":1,"made":false}'::jsonb,413000,4,1928),
   ('e0000009-0000-4000-8000-000000000157',157,'clock_start','{}'::jsonb,413000,4,1928),
   ('e0000009-0000-4000-8000-000000000158',158,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":3,"made":false}'::jsonb,384000,4,1957),
   ('e0000009-0000-4000-8000-000000000159',159,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":2,"made":false}'::jsonb,360000,4,1981),
   ('e0000009-0000-4000-8000-000000000160',160,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":2,"made":false}'::jsonb,333000,4,2008),
   ('e0000009-0000-4000-8000-000000000161',161,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":false}'::jsonb,302000,4,2039),
   ('e0000009-0000-4000-8000-000000000162',162,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":3,"made":true}'::jsonb,277000,4,2064),
   ('e0000009-0000-4000-8000-000000000163',163,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,251000,4,2090),
   ('e0000009-0000-4000-8000-000000000164',164,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000108","points":2,"made":true}'::jsonb,221000,4,2120),
   ('e0000009-0000-4000-8000-000000000165',165,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,193000,4,2148),
   ('e0000009-0000-4000-8000-000000000166',166,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","points":2,"made":false}'::jsonb,172000,4,2169),
   ('e0000009-0000-4000-8000-000000000167',167,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":true}'::jsonb,151000,4,2190),
   ('e0000009-0000-4000-8000-000000000168',168,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":false}'::jsonb,129000,4,2212),
   ('e0000009-0000-4000-8000-000000000169',169,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,126000,4,2215),
   ('e0000009-0000-4000-8000-000000000170',170,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":1,"made":true}'::jsonb,126000,4,2215),
   ('e0000009-0000-4000-8000-000000000171',171,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":1,"made":true}'::jsonb,126000,4,2215),
   ('e0000009-0000-4000-8000-000000000172',172,'clock_start','{}'::jsonb,126000,4,2215),
   ('e0000009-0000-4000-8000-000000000173',173,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":3,"made":false}'::jsonb,106000,4,2235),
   ('e0000009-0000-4000-8000-000000000174',174,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000103","kind":"personal"}'::jsonb,103000,4,2238),
   ('e0000009-0000-4000-8000-000000000175',175,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":1,"made":true}'::jsonb,103000,4,2238),
   ('e0000009-0000-4000-8000-000000000176',176,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000606","points":1,"made":true}'::jsonb,103000,4,2238),
   ('e0000009-0000-4000-8000-000000000177',177,'clock_start','{}'::jsonb,103000,4,2238),
   ('e0000009-0000-4000-8000-000000000178',178,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000104","points":2,"made":false}'::jsonb,80000,4,2261),
   ('e0000009-0000-4000-8000-000000000179',179,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":false}'::jsonb,52000,4,2289),
   ('e0000009-0000-4000-8000-000000000180',180,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000106","kind":"personal"}'::jsonb,49000,4,2292),
   ('e0000009-0000-4000-8000-000000000181',181,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":true}'::jsonb,49000,4,2292),
   ('e0000009-0000-4000-8000-000000000182',182,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":true}'::jsonb,49000,4,2292),
   ('e0000009-0000-4000-8000-000000000183',183,'clock_start','{}'::jsonb,49000,4,2292),
   ('e0000009-0000-4000-8000-000000000184',184,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000102","points":2,"made":true}'::jsonb,19000,4,2322),
   ('e0000009-0000-4000-8000-000000000185',185,'period_end','{}'::jsonb,0,4,2322),
   ('e0000009-0000-4000-8000-000000000186',186,'game_end','{}'::jsonb,null,4,2322)
  ) as e(id,sequence,type,payload,clock_ms,period,at);
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'c0000000-0000-4000-8000-000000000009','submitted',commissioner,starts+interval '2 hours');
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'c0000000-0000-4000-8000-000000000009','approved',commissioner,starts+interval '3 hours');
  insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by,approved_at)
  values('c0000000-0000-4000-8000-000000000009',l,42,43,186,'{"sport":"basketball","periods":4,"winner":"away","officials":{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"},"confirmations":[],"protests":[],"teams":{"home":{"name":"Yanbu Kings","score":42,"pointsByPeriod":{"1":9,"2":10,"3":9,"4":14},"teamFouls":{"1":1,"2":3,"3":3,"4":1},"timeoutsUsed":{},"benchTechnicals":0,"coachFouls":{"coach":0,"bench":0},"coachEjected":false,"coach":null,"assistantCoach":null,"captainId":null,"timeouts":[],"shotClockViolations":0,"players":[{"playerId":"90000000-0000-4000-8000-000000000601","name":"Juan Mendoza","jersey":1,"starter":true,"minutes":30,"points":10,"fieldGoals":{"made":3,"attempted":6},"threePointers":{"made":2,"attempted":3},"freeThrows":{"made":2,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000602","name":"Miguel Mendoza","jersey":2,"starter":true,"minutes":40,"points":10,"fieldGoals":{"made":4,"attempted":15},"threePointers":{"made":2,"attempted":6},"freeThrows":{"made":0,"attempted":0},"fouls":4,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000603","name":"Marco Mendoza","jersey":3,"starter":true,"minutes":40,"points":4,"fieldGoals":{"made":1,"attempted":3},"threePointers":{"made":0,"attempted":2},"freeThrows":{"made":2,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000604","name":"Luis Mendoza","jersey":4,"starter":true,"minutes":30,"points":2,"fieldGoals":{"made":1,"attempted":6},"threePointers":{"made":0,"attempted":2},"freeThrows":{"made":0,"attempted":0},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000605","name":"Anton Mendoza","jersey":5,"starter":true,"minutes":20,"points":5,"fieldGoals":{"made":2,"attempted":4},"threePointers":{"made":1,"attempted":2},"freeThrows":{"made":0,"attempted":0},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000606","name":"Jose Mendoza","jersey":6,"starter":false,"minutes":10,"points":5,"fieldGoals":{"made":1,"attempted":3},"threePointers":{"made":0,"attempted":1},"freeThrows":{"made":3,"attempted":4},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000607","name":"Gabriel Mendoza","jersey":7,"starter":false,"minutes":0,"points":0,"fieldGoals":{"made":0,"attempted":0},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000608","name":"Rafael Mendoza","jersey":8,"starter":false,"minutes":30,"points":6,"fieldGoals":{"made":2,"attempted":9},"threePointers":{"made":0,"attempted":2},"freeThrows":{"made":2,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}],"totals":{"points":42,"fieldGoals":{"made":14,"attempted":46},"threePointers":{"made":5,"attempted":18},"freeThrows":{"made":9,"attempted":10},"fouls":8,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}},"away":{"name":"Riyadh Royals","score":43,"pointsByPeriod":{"1":7,"2":8,"3":16,"4":12},"teamFouls":{"2":1,"3":1,"4":3},"timeoutsUsed":{},"benchTechnicals":0,"coachFouls":{"coach":0,"bench":0},"coachEjected":false,"coach":null,"assistantCoach":null,"captainId":null,"timeouts":[],"shotClockViolations":0,"players":[{"playerId":"90000000-0000-4000-8000-000000000101","name":"Juan Dela Cruz","jersey":1,"starter":true,"minutes":30,"points":8,"fieldGoals":{"made":3,"attempted":8},"threePointers":{"made":0,"attempted":2},"freeThrows":{"made":2,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000102","name":"Miguel Dela Cruz","jersey":2,"starter":true,"minutes":40,"points":9,"fieldGoals":{"made":3,"attempted":10},"threePointers":{"made":1,"attempted":4},"freeThrows":{"made":2,"attempted":2},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000103","name":"Marco Dela Cruz","jersey":3,"starter":true,"minutes":40,"points":7,"fieldGoals":{"made":2,"attempted":9},"threePointers":{"made":0,"attempted":1},"freeThrows":{"made":3,"attempted":6},"fouls":2,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000104","name":"Luis Dela Cruz","jersey":4,"starter":true,"minutes":30,"points":2,"fieldGoals":{"made":0,"attempted":4},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":2,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000105","name":"Anton Dela Cruz","jersey":5,"starter":true,"minutes":20,"points":3,"fieldGoals":{"made":1,"attempted":4},"threePointers":{"made":1,"attempted":3},"freeThrows":{"made":0,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000106","name":"Jose Dela Cruz","jersey":6,"starter":false,"minutes":10,"points":3,"fieldGoals":{"made":1,"attempted":3},"threePointers":{"made":1,"attempted":3},"freeThrows":{"made":0,"attempted":0},"fouls":1,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000107","name":"Gabriel Dela Cruz","jersey":7,"starter":false,"minutes":0,"points":0,"fieldGoals":{"made":0,"attempted":0},"threePointers":{"made":0,"attempted":0},"freeThrows":{"made":0,"attempted":0},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}},{"playerId":"90000000-0000-4000-8000-000000000108","name":"Rafael Dela Cruz","jersey":8,"starter":false,"minutes":30,"points":11,"fieldGoals":{"made":4,"attempted":10},"threePointers":{"made":2,"attempted":5},"freeThrows":{"made":1,"attempted":2},"fouls":0,"disqualified":null,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}],"totals":{"points":43,"fieldGoals":{"made":14,"attempted":48},"threePointers":{"made":5,"attempted":18},"freeThrows":{"made":10,"attempted":16},"fouls":5,"stats":{"rebound":0,"assist":0,"steal":0,"block":0,"turnover":0}}}}}'::jsonb,commissioner,starts+interval '3 hours');
 end if;
 -- Game 10: 57-58, submitted.
 starts:=date_trunc('hour',now())-interval '1 days'-interval '1 hour';
 inserted:=null;
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,status,created_by)
 values('c0000000-0000-4000-8000-000000000010',l,s,division_uuid,'b0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000006',starts,'Main court','submitted',commissioner)
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  select e.id::uuid,l,'c0000000-0000-4000-8000-000000000010',e.sequence,e.type,e.payload,e.clock_ms,e.period,starts+make_interval(secs=>e.at),commissioner
  from (values
   ('e0000010-0000-4000-8000-000000000001',1,'roster','{"team":"home","players":[{"playerId":"90000000-0000-4000-8000-000000000501","name":"Juan Garcia","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000502","name":"Miguel Garcia","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000503","name":"Marco Garcia","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000504","name":"Luis Garcia","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000505","name":"Anton Garcia","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000506","name":"Jose Garcia","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000507","name":"Gabriel Garcia","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000508","name":"Rafael Garcia","jersey":8}]}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000002',2,'roster','{"team":"away","players":[{"playerId":"90000000-0000-4000-8000-000000000601","name":"Juan Mendoza","jersey":1},{"playerId":"90000000-0000-4000-8000-000000000602","name":"Miguel Mendoza","jersey":2},{"playerId":"90000000-0000-4000-8000-000000000603","name":"Marco Mendoza","jersey":3},{"playerId":"90000000-0000-4000-8000-000000000604","name":"Luis Mendoza","jersey":4},{"playerId":"90000000-0000-4000-8000-000000000605","name":"Anton Mendoza","jersey":5},{"playerId":"90000000-0000-4000-8000-000000000606","name":"Jose Mendoza","jersey":6},{"playerId":"90000000-0000-4000-8000-000000000607","name":"Gabriel Mendoza","jersey":7},{"playerId":"90000000-0000-4000-8000-000000000608","name":"Rafael Mendoza","jersey":8}]}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000003',3,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000004',4,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000005',5,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000006',6,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000007',7,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000008',8,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000009',9,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000507"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000010',10,'checkin','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000011',11,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000012',12,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000013',13,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000014',14,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000015',15,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000016',16,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000606"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000017',17,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000607"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000018',18,'checkin','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000019',19,'officials','{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000020',20,'starters','{"team":"home","playerIds":["90000000-0000-4000-8000-000000000501","90000000-0000-4000-8000-000000000502","90000000-0000-4000-8000-000000000503","90000000-0000-4000-8000-000000000504","90000000-0000-4000-8000-000000000505"]}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000021',21,'starters','{"team":"away","playerIds":["90000000-0000-4000-8000-000000000601","90000000-0000-4000-8000-000000000602","90000000-0000-4000-8000-000000000603","90000000-0000-4000-8000-000000000604","90000000-0000-4000-8000-000000000605"]}'::jsonb,null,0,0),
   ('e0000010-0000-4000-8000-000000000022',22,'period_start','{}'::jsonb,null,1,0),
   ('e0000010-0000-4000-8000-000000000023',23,'clock_start','{}'::jsonb,600000,1,0),
   ('e0000010-0000-4000-8000-000000000024',24,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":false}'::jsonb,573000,1,27),
   ('e0000010-0000-4000-8000-000000000025',25,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,553000,1,47),
   ('e0000010-0000-4000-8000-000000000026',26,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":3,"made":false}'::jsonb,527000,1,73),
   ('e0000010-0000-4000-8000-000000000027',27,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":false}'::jsonb,508000,1,92),
   ('e0000010-0000-4000-8000-000000000028',28,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":3,"made":true}'::jsonb,482000,1,118),
   ('e0000010-0000-4000-8000-000000000029',29,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,453000,1,147),
   ('e0000010-0000-4000-8000-000000000030',30,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,423000,1,177),
   ('e0000010-0000-4000-8000-000000000031',31,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,397000,1,203),
   ('e0000010-0000-4000-8000-000000000032',32,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,367000,1,233),
   ('e0000010-0000-4000-8000-000000000033',33,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,337000,1,263),
   ('e0000010-0000-4000-8000-000000000034',34,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":3,"made":false}'::jsonb,319000,1,281),
   ('e0000010-0000-4000-8000-000000000035',35,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","points":3,"made":false}'::jsonb,297000,1,303),
   ('e0000010-0000-4000-8000-000000000036',36,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":false}'::jsonb,277000,1,323),
   ('e0000010-0000-4000-8000-000000000037',37,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":3,"made":true}'::jsonb,256000,1,344),
   ('e0000010-0000-4000-8000-000000000038',38,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","kind":"personal"}'::jsonb,253000,1,347),
   ('e0000010-0000-4000-8000-000000000039',39,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":true}'::jsonb,253000,1,347),
   ('e0000010-0000-4000-8000-000000000040',40,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":false}'::jsonb,253000,1,347),
   ('e0000010-0000-4000-8000-000000000041',41,'clock_start','{}'::jsonb,253000,1,347),
   ('e0000010-0000-4000-8000-000000000042',42,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":false}'::jsonb,227000,1,373),
   ('e0000010-0000-4000-8000-000000000043',43,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":true}'::jsonb,209000,1,391),
   ('e0000010-0000-4000-8000-000000000044',44,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","kind":"personal"}'::jsonb,206000,1,394),
   ('e0000010-0000-4000-8000-000000000045',45,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":false}'::jsonb,206000,1,394),
   ('e0000010-0000-4000-8000-000000000046',46,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":1,"made":false}'::jsonb,206000,1,394),
   ('e0000010-0000-4000-8000-000000000047',47,'clock_start','{}'::jsonb,206000,1,394),
   ('e0000010-0000-4000-8000-000000000048',48,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,176000,1,424),
   ('e0000010-0000-4000-8000-000000000049',49,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,150000,1,450),
   ('e0000010-0000-4000-8000-000000000050',50,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":2,"made":true}'::jsonb,131000,1,469),
   ('e0000010-0000-4000-8000-000000000051',51,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,100000,1,500),
   ('e0000010-0000-4000-8000-000000000052',52,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,77000,1,523),
   ('e0000010-0000-4000-8000-000000000053',53,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","kind":"personal"}'::jsonb,74000,1,526),
   ('e0000010-0000-4000-8000-000000000054',54,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,74000,1,526),
   ('e0000010-0000-4000-8000-000000000055',55,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,74000,1,526),
   ('e0000010-0000-4000-8000-000000000056',56,'clock_start','{}'::jsonb,74000,1,526),
   ('e0000010-0000-4000-8000-000000000057',57,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,50000,1,550),
   ('e0000010-0000-4000-8000-000000000058',58,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,28000,1,572),
   ('e0000010-0000-4000-8000-000000000059',59,'period_end','{}'::jsonb,0,1,572),
   ('e0000010-0000-4000-8000-000000000060',60,'period_start','{}'::jsonb,null,2,572),
   ('e0000010-0000-4000-8000-000000000061',61,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000504","in":"90000000-0000-4000-8000-000000000508"}'::jsonb,600000,2,572),
   ('e0000010-0000-4000-8000-000000000062',62,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000604","in":"90000000-0000-4000-8000-000000000608"}'::jsonb,600000,2,572),
   ('e0000010-0000-4000-8000-000000000063',63,'clock_start','{}'::jsonb,600000,2,572),
   ('e0000010-0000-4000-8000-000000000064',64,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,579000,2,593),
   ('e0000010-0000-4000-8000-000000000065',65,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":true}'::jsonb,548000,2,624),
   ('e0000010-0000-4000-8000-000000000066',66,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,530000,2,642),
   ('e0000010-0000-4000-8000-000000000067',67,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","kind":"personal"}'::jsonb,527000,2,645),
   ('e0000010-0000-4000-8000-000000000068',68,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":1,"made":true}'::jsonb,527000,2,645),
   ('e0000010-0000-4000-8000-000000000069',69,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":1,"made":true}'::jsonb,527000,2,645),
   ('e0000010-0000-4000-8000-000000000070',70,'clock_start','{}'::jsonb,527000,2,645),
   ('e0000010-0000-4000-8000-000000000071',71,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":3,"made":true}'::jsonb,500000,2,672),
   ('e0000010-0000-4000-8000-000000000072',72,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","kind":"personal"}'::jsonb,497000,2,675),
   ('e0000010-0000-4000-8000-000000000073',73,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":1,"made":true}'::jsonb,497000,2,675),
   ('e0000010-0000-4000-8000-000000000074',74,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":1,"made":false}'::jsonb,497000,2,675),
   ('e0000010-0000-4000-8000-000000000075',75,'clock_start','{}'::jsonb,497000,2,675),
   ('e0000010-0000-4000-8000-000000000076',76,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":3,"made":false}'::jsonb,476000,2,696),
   ('e0000010-0000-4000-8000-000000000077',77,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":true}'::jsonb,453000,2,719),
   ('e0000010-0000-4000-8000-000000000078',78,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,429000,2,743),
   ('e0000010-0000-4000-8000-000000000079',79,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":2,"made":false}'::jsonb,408000,2,764),
   ('e0000010-0000-4000-8000-000000000080',80,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,388000,2,784),
   ('e0000010-0000-4000-8000-000000000081',81,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,364000,2,808),
   ('e0000010-0000-4000-8000-000000000082',82,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","points":2,"made":true}'::jsonb,336000,2,836),
   ('e0000010-0000-4000-8000-000000000083',83,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,306000,2,866),
   ('e0000010-0000-4000-8000-000000000084',84,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","kind":"personal"}'::jsonb,303000,2,869),
   ('e0000010-0000-4000-8000-000000000085',85,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,303000,2,869),
   ('e0000010-0000-4000-8000-000000000086',86,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":false}'::jsonb,303000,2,869),
   ('e0000010-0000-4000-8000-000000000087',87,'clock_start','{}'::jsonb,303000,2,869),
   ('e0000010-0000-4000-8000-000000000088',88,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":3,"made":false}'::jsonb,276000,2,896),
   ('e0000010-0000-4000-8000-000000000089',89,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":true}'::jsonb,251000,2,921),
   ('e0000010-0000-4000-8000-000000000090',90,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,222000,2,950),
   ('e0000010-0000-4000-8000-000000000091',91,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,192000,2,980),
   ('e0000010-0000-4000-8000-000000000092',92,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","kind":"personal"}'::jsonb,189000,2,983),
   ('e0000010-0000-4000-8000-000000000093',93,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,189000,2,983),
   ('e0000010-0000-4000-8000-000000000094',94,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,189000,2,983),
   ('e0000010-0000-4000-8000-000000000095',95,'clock_start','{}'::jsonb,189000,2,983),
   ('e0000010-0000-4000-8000-000000000096',96,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","points":2,"made":true}'::jsonb,164000,2,1008),
   ('e0000010-0000-4000-8000-000000000097',97,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000505","points":2,"made":true}'::jsonb,139000,2,1033),
   ('e0000010-0000-4000-8000-000000000098',98,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000605","points":2,"made":false}'::jsonb,120000,2,1052),
   ('e0000010-0000-4000-8000-000000000099',99,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,92000,2,1080),
   ('e0000010-0000-4000-8000-000000000100',100,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,62000,2,1110),
   ('e0000010-0000-4000-8000-000000000101',101,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,38000,2,1134),
   ('e0000010-0000-4000-8000-000000000102',102,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","kind":"personal"}'::jsonb,35000,2,1137),
   ('e0000010-0000-4000-8000-000000000103',103,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":false}'::jsonb,35000,2,1137),
   ('e0000010-0000-4000-8000-000000000104',104,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":true}'::jsonb,35000,2,1137),
   ('e0000010-0000-4000-8000-000000000105',105,'clock_start','{}'::jsonb,35000,2,1137),
   ('e0000010-0000-4000-8000-000000000106',106,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":true}'::jsonb,8000,2,1164),
   ('e0000010-0000-4000-8000-000000000107',107,'period_end','{}'::jsonb,0,2,1164),
   ('e0000010-0000-4000-8000-000000000108',108,'period_start','{}'::jsonb,null,3,1164),
   ('e0000010-0000-4000-8000-000000000109',109,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000505","in":"90000000-0000-4000-8000-000000000504"}'::jsonb,600000,3,1164),
   ('e0000010-0000-4000-8000-000000000110',110,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000605","in":"90000000-0000-4000-8000-000000000604"}'::jsonb,600000,3,1164),
   ('e0000010-0000-4000-8000-000000000111',111,'clock_start','{}'::jsonb,600000,3,1164),
   ('e0000010-0000-4000-8000-000000000112',112,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,572000,3,1192),
   ('e0000010-0000-4000-8000-000000000113',113,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":3,"made":false}'::jsonb,549000,3,1215),
   ('e0000010-0000-4000-8000-000000000114',114,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,525000,3,1239),
   ('e0000010-0000-4000-8000-000000000115',115,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,504000,3,1260),
   ('e0000010-0000-4000-8000-000000000116',116,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":3,"made":false}'::jsonb,480000,3,1284),
   ('e0000010-0000-4000-8000-000000000117',117,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":3,"made":true}'::jsonb,460000,3,1304),
   ('e0000010-0000-4000-8000-000000000118',118,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":false}'::jsonb,440000,3,1324),
   ('e0000010-0000-4000-8000-000000000119',119,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":false}'::jsonb,420000,3,1344),
   ('e0000010-0000-4000-8000-000000000120',120,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":2,"made":true}'::jsonb,399000,3,1365),
   ('e0000010-0000-4000-8000-000000000121',121,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":2,"made":true}'::jsonb,379000,3,1385),
   ('e0000010-0000-4000-8000-000000000122',122,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","kind":"personal"}'::jsonb,376000,3,1388),
   ('e0000010-0000-4000-8000-000000000123',123,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":false}'::jsonb,376000,3,1388),
   ('e0000010-0000-4000-8000-000000000124',124,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000601","points":1,"made":false}'::jsonb,376000,3,1388),
   ('e0000010-0000-4000-8000-000000000125',125,'clock_start','{}'::jsonb,376000,3,1388),
   ('e0000010-0000-4000-8000-000000000126',126,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","points":3,"made":false}'::jsonb,345000,3,1419),
   ('e0000010-0000-4000-8000-000000000127',127,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,322000,3,1442),
   ('e0000010-0000-4000-8000-000000000128',128,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":2,"made":false}'::jsonb,297000,3,1467),
   ('e0000010-0000-4000-8000-000000000129',129,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,294000,3,1470),
   ('e0000010-0000-4000-8000-000000000130',130,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":true}'::jsonb,294000,3,1470),
   ('e0000010-0000-4000-8000-000000000131',131,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":1,"made":true}'::jsonb,294000,3,1470),
   ('e0000010-0000-4000-8000-000000000132',132,'clock_start','{}'::jsonb,294000,3,1470),
   ('e0000010-0000-4000-8000-000000000133',133,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":3,"made":true}'::jsonb,269000,3,1495),
   ('e0000010-0000-4000-8000-000000000134',134,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","kind":"personal"}'::jsonb,266000,3,1498),
   ('e0000010-0000-4000-8000-000000000135',135,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":1,"made":false}'::jsonb,266000,3,1498),
   ('e0000010-0000-4000-8000-000000000136',136,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":1,"made":false}'::jsonb,266000,3,1498),
   ('e0000010-0000-4000-8000-000000000137',137,'clock_start','{}'::jsonb,266000,3,1498),
   ('e0000010-0000-4000-8000-000000000138',138,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,245000,3,1519),
   ('e0000010-0000-4000-8000-000000000139',139,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","kind":"personal"}'::jsonb,242000,3,1522),
   ('e0000010-0000-4000-8000-000000000140',140,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":false}'::jsonb,242000,3,1522),
   ('e0000010-0000-4000-8000-000000000141',141,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":false}'::jsonb,242000,3,1522),
   ('e0000010-0000-4000-8000-000000000142',142,'clock_start','{}'::jsonb,242000,3,1522),
   ('e0000010-0000-4000-8000-000000000143',143,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":2,"made":true}'::jsonb,212000,3,1552),
   ('e0000010-0000-4000-8000-000000000144',144,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","kind":"personal"}'::jsonb,209000,3,1555),
   ('e0000010-0000-4000-8000-000000000145',145,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":1,"made":false}'::jsonb,209000,3,1555),
   ('e0000010-0000-4000-8000-000000000146',146,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":1,"made":true}'::jsonb,209000,3,1555),
   ('e0000010-0000-4000-8000-000000000147',147,'clock_start','{}'::jsonb,209000,3,1555),
   ('e0000010-0000-4000-8000-000000000148',148,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,183000,3,1581),
   ('e0000010-0000-4000-8000-000000000149',149,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,154000,3,1610),
   ('e0000010-0000-4000-8000-000000000150',150,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":false}'::jsonb,123000,3,1641),
   ('e0000010-0000-4000-8000-000000000151',151,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,100000,3,1664),
   ('e0000010-0000-4000-8000-000000000152',152,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":3,"made":false}'::jsonb,82000,3,1682),
   ('e0000010-0000-4000-8000-000000000153',153,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","kind":"personal"}'::jsonb,79000,3,1685),
   ('e0000010-0000-4000-8000-000000000154',154,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,79000,3,1685),
   ('e0000010-0000-4000-8000-000000000155',155,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":1,"made":true}'::jsonb,79000,3,1685),
   ('e0000010-0000-4000-8000-000000000156',156,'clock_start','{}'::jsonb,79000,3,1685),
   ('e0000010-0000-4000-8000-000000000157',157,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,50000,3,1714),
   ('e0000010-0000-4000-8000-000000000158',158,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","kind":"personal"}'::jsonb,47000,3,1717),
   ('e0000010-0000-4000-8000-000000000159',159,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":true}'::jsonb,47000,3,1717),
   ('e0000010-0000-4000-8000-000000000160',160,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":true}'::jsonb,47000,3,1717),
   ('e0000010-0000-4000-8000-000000000161',161,'clock_start','{}'::jsonb,47000,3,1717),
   ('e0000010-0000-4000-8000-000000000162',162,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000501","points":3,"made":false}'::jsonb,18000,3,1746),
   ('e0000010-0000-4000-8000-000000000163',163,'period_end','{}'::jsonb,0,3,1746),
   ('e0000010-0000-4000-8000-000000000164',164,'period_start','{}'::jsonb,null,4,1746),
   ('e0000010-0000-4000-8000-000000000165',165,'substitution','{"team":"home","out":"90000000-0000-4000-8000-000000000501","in":"90000000-0000-4000-8000-000000000506"}'::jsonb,600000,4,1746),
   ('e0000010-0000-4000-8000-000000000166',166,'substitution','{"team":"away","out":"90000000-0000-4000-8000-000000000601","in":"90000000-0000-4000-8000-000000000606"}'::jsonb,600000,4,1746),
   ('e0000010-0000-4000-8000-000000000167',167,'clock_start','{}'::jsonb,600000,4,1746),
   ('e0000010-0000-4000-8000-000000000168',168,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000604","points":3,"made":false}'::jsonb,582000,4,1764),
   ('e0000010-0000-4000-8000-000000000169',169,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":3,"made":false}'::jsonb,553000,4,1793),
   ('e0000010-0000-4000-8000-000000000170',170,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":false}'::jsonb,527000,4,1819),
   ('e0000010-0000-4000-8000-000000000171',171,'foul','{"team":"home","playerId":"90000000-0000-4000-8000-000000000504","kind":"personal"}'::jsonb,524000,4,1822),
   ('e0000010-0000-4000-8000-000000000172',172,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":true}'::jsonb,524000,4,1822),
   ('e0000010-0000-4000-8000-000000000173',173,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":1,"made":false}'::jsonb,524000,4,1822),
   ('e0000010-0000-4000-8000-000000000174',174,'clock_start','{}'::jsonb,524000,4,1822),
   ('e0000010-0000-4000-8000-000000000175',175,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":3,"made":false}'::jsonb,495000,4,1851),
   ('e0000010-0000-4000-8000-000000000176',176,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":true}'::jsonb,469000,4,1877),
   ('e0000010-0000-4000-8000-000000000177',177,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,441000,4,1905),
   ('e0000010-0000-4000-8000-000000000178',178,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":3,"made":false}'::jsonb,423000,4,1923),
   ('e0000010-0000-4000-8000-000000000179',179,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,401000,4,1945),
   ('e0000010-0000-4000-8000-000000000180',180,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,375000,4,1971),
   ('e0000010-0000-4000-8000-000000000181',181,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":true}'::jsonb,353000,4,1993),
   ('e0000010-0000-4000-8000-000000000182',182,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000606","points":2,"made":false}'::jsonb,328000,4,2018),
   ('e0000010-0000-4000-8000-000000000183',183,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,304000,4,2042),
   ('e0000010-0000-4000-8000-000000000184',184,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000608","points":2,"made":true}'::jsonb,277000,4,2069),
   ('e0000010-0000-4000-8000-000000000185',185,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000502","points":2,"made":false}'::jsonb,251000,4,2095),
   ('e0000010-0000-4000-8000-000000000186',186,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,220000,4,2126),
   ('e0000010-0000-4000-8000-000000000187',187,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000506","points":3,"made":true}'::jsonb,192000,4,2154),
   ('e0000010-0000-4000-8000-000000000188',188,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,161000,4,2185),
   ('e0000010-0000-4000-8000-000000000189',189,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000508","points":3,"made":true}'::jsonb,136000,4,2210),
   ('e0000010-0000-4000-8000-000000000190',190,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,109000,4,2237),
   ('e0000010-0000-4000-8000-000000000191',191,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":3,"made":false}'::jsonb,86000,4,2260),
   ('e0000010-0000-4000-8000-000000000192',192,'foul','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","kind":"personal"}'::jsonb,83000,4,2263),
   ('e0000010-0000-4000-8000-000000000193',193,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":true}'::jsonb,83000,4,2263),
   ('e0000010-0000-4000-8000-000000000194',194,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":1,"made":true}'::jsonb,83000,4,2263),
   ('e0000010-0000-4000-8000-000000000195',195,'clock_start','{}'::jsonb,83000,4,2263),
   ('e0000010-0000-4000-8000-000000000196',196,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000603","points":2,"made":false}'::jsonb,65000,4,2281),
   ('e0000010-0000-4000-8000-000000000197',197,'score','{"team":"home","playerId":"90000000-0000-4000-8000-000000000503","points":2,"made":true}'::jsonb,37000,4,2309),
   ('e0000010-0000-4000-8000-000000000198',198,'score','{"team":"away","playerId":"90000000-0000-4000-8000-000000000602","points":2,"made":false}'::jsonb,15000,4,2331),
   ('e0000010-0000-4000-8000-000000000199',199,'period_end','{}'::jsonb,0,4,2331),
   ('e0000010-0000-4000-8000-000000000200',200,'game_end','{}'::jsonb,null,4,2331)
  ) as e(id,sequence,type,payload,clock_ms,period,at);
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'c0000000-0000-4000-8000-000000000010','submitted',commissioner,starts+interval '2 hours');
 end if;
end;
$$;

-- Team payments so the demo teams are not flagged as behind: three paid in full
-- (one in two instalments) and one paying per game, up to date for its next game.
-- Fixed ids, so reseeding never adds a payment twice.
do $$
declare
 l uuid := '00000000-0000-4000-8000-000000000001';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
begin
 insert into public.team_ledger(id,league_id,season_id,season_team_id,kind,amount_halalas,method,note,paid_on,recorded_by)
 select payment.id::uuid,l,s,payment.team::uuid,'payment',payment.amount,payment.method,payment.note,payment.paid_on::date,commissioner
 from (values
  ('f0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',180000,'bank_transfer','Full season fee','2026-10-02'),
  ('f0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000005',180000,'stc_pay','Full season fee','2026-10-03'),
  ('f0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006',90000,'cash','First half of the fee','2026-10-02'),
  ('f0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000006',90000,'cash','Second half of the fee','2026-10-09'),
  ('f0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000007',90000,'cash','Paying per game','2026-10-05')
 ) as payment(id,team,amount,method,note,paid_on)
 where exists(select 1 from public.season_teams st where st.id=payment.team::uuid and st.league_id=l and st.status='approved')
 on conflict(id) do nothing;
end;
$$;
