begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function public.test_division_payload(team uuid,division uuid,players uuid[]) returns jsonb language sql stable as $$
 select jsonb_build_object('teamId',team,'logoPath',(select league_id::text from public.teams where id=team)||'/'||team::text||'/logo/00000000-0000-4000-8000-000000000001.png','seasonId','93000000-0000-4000-8000-000000000001','divisionId',division,'roster',coalesce((select jsonb_agg(jsonb_build_object('playerId',id,'jerseyNumber',ordinality)) from unnest(players) with ordinality as p(id,ordinality)),'[]'));
$$;
insert into auth.users(id,email,raw_user_meta_data) values
('91000000-0000-4000-8000-000000000001','multi-commissioner@example.test','{}'),
('91000000-0000-4000-8000-000000000002','multi-manager@example.test','{}'),
('91000000-0000-4000-8000-000000000003','multi-second-manager@example.test','{}');
insert into public.leagues(id,slug,name) values('92000000-0000-4000-8000-000000000001','multi-division','Multi Division');
insert into public.league_members(league_id,user_id,role) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','commissioner'),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','team_manager'),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','team_manager');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Multi cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'91000000-0000-4000-8000-000000000001');
-- 01 Division C (max C), 02 Open (max A), 03 Masters (max A)
insert into public.divisions(id,league_id,season_id,name,max_rating,roster_min,roster_max) values
('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Division C','C',2,4),
('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Open','A',2,4),
('94000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Masters','A',2,4);
update public.seasons set status='published' where id='93000000-0000-4000-8000-000000000001';
insert into public.registration_settings(league_id,season_id,is_open,deadline,fee_halalas) values
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',true,now()+interval '1 day',180000);
insert into public.teams(id,league_id,name,manager_id) values
('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Two Division Team','91000000-0000-4000-8000-000000000002'),
('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Rival Team','91000000-0000-4000-8000-000000000003');
insert into public.players(id,league_id,display_name,created_by) select ('96000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'92000000-0000-4000-8000-000000000001','Multi '||i,'91000000-0000-4000-8000-000000000001' from generate_series(1,5) i;
insert into public.player_checks(league_id,player_id) select league_id,id from public.players where id::text like '96000000-%';
insert into public.player_ratings(league_id,player_id,rating,effective_from,set_by,reason) select league_id,id,case when display_name='Multi 4' then 'A' else 'C' end,now()-interval '1 day',created_by,'Initial evaluation' from public.players where id::text like '96000000-%';

-- Uploaded logos for the registration fixtures (object metadata only).
insert into storage.objects(bucket_id,name,metadata)
 select 'team-registration-media',league_id::text||'/'||id::text||'/logo/00000000-0000-4000-8000-000000000001.png',
 '{"mimetype":"image/png","size":70}'::jsonb from public.teams where id::text like '95000000-%';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',array['96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002']::uuid[]),true)$$,'a team registers in Division C');
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002',array['96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000004']::uuid[]),true)$$,'the same team also registers in Open with the same players');
select is((select count(*)::integer from public.season_teams where team_id='95000000-0000-4000-8000-000000000001'),2,'each division is its own registration');
select is((select sum(fee_halalas)::integer from public.season_teams where team_id='95000000-0000-4000-8000-000000000001'),360000,'each division registration carries its own fee');
select is((select count(*)::integer from public.roster_entries where player_id='96000000-0000-4000-8000-000000000001' and active),2,'a player can be on the team roster in two divisions');
select ok((select bool_and(re.division_id=st.division_id) from public.roster_entries re join public.season_teams st on st.id=re.registration_id where re.league_id='92000000-0000-4000-8000-000000000001'),'roster rows record their registration division');
select throws_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','{}'::uuid[]))$$,'23505',null,'a team cannot register twice in one division');
select is(public.check_registration_eligibility('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','[{"playerId":"96000000-0000-4000-8000-000000000004","jerseyNumber":1},{"playerId":"96000000-0000-4000-8000-000000000003","jerseyNumber":2}]')->0->>'code','ratingTooHigh','rating caps still apply per division');
select is(public.registration_player_catalog('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='95000000-0000-4000-8000-000000000001' and division_id='94000000-0000-4000-8000-000000000002'))->0->'takenDivisionIds','["94000000-0000-4000-8000-000000000001"]'::jsonb,'the catalog lists the other divisions a player is already in');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(public.check_registration_eligibility('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','[{"playerId":"96000000-0000-4000-8000-000000000001","jerseyNumber":1},{"playerId":"96000000-0000-4000-8000-000000000003","jerseyNumber":2}]')->0->>'code','anotherTeam','a player already on a team in this division is flagged');
select throws_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001',array['96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003']::uuid[]))$$,'23505',null,'a player cannot join a second team in the same division');
select is(jsonb_array_length(public.check_registration_eligibility('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003','[{"playerId":"96000000-0000-4000-8000-000000000001","jerseyNumber":1},{"playerId":"96000000-0000-4000-8000-000000000003","jerseyNumber":2}]')),0,'the same player may join another team in a different division');
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003',array['96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003']::uuid[]))$$,'a rival draft in Masters shares a player');
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002',array['96000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000005']::uuid[]),false,(select id from public.season_teams where team_id='95000000-0000-4000-8000-000000000002'))$$,'a draft can move to another division even when its old roster would clash there');
select is((select string_agg(distinct division_id::text,',') from public.roster_entries where registration_id=(select id from public.season_teams where team_id='95000000-0000-4000-8000-000000000002')),'94000000-0000-4000-8000-000000000002','moved draft rosters follow the new division');

-- New players typed in while building a roster are created with the saved registration.
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003',array['96000000-0000-4000-8000-000000000003']::uuid[])||'{"newPlayers":[{"id":"97000000-0000-4000-8000-000000000001","name":"Not on roster"}]}')$$,'23514','invalid_roster','a new player must be on the roster being saved');
select throws_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003',array['97000000-0000-4000-8000-000000000001']::uuid[])||'{"newPlayers":[{"id":"97000000-0000-4000-8000-000000000001","name":"Brand New","iqama":"x"}]}')$$,'23514','invalid_roster','new players carry only a name');
select throws_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',array['97000000-0000-4000-8000-000000000001']::uuid[])||'{"newPlayers":[{"id":"97000000-0000-4000-8000-000000000001","name":"Brand New"}]}')$$,'23505',null,'a failed save creates no players');
select is((select count(*)::integer from jsonb_array_elements(public.registration_player_catalog('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001')) as p(x) where p.x->>'name'='Brand New'),0,'nothing is left behind after a failed save');
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003',array['97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003']::uuid[])||'{"newPlayers":[{"id":"97000000-0000-4000-8000-000000000001","name":"  Brand New "}]}')$$,'saving a roster creates its new players');
select is((select p.x->>'rating' from jsonb_array_elements(public.registration_player_catalog('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001')) as p(x) where p.x->>'id'='97000000-0000-4000-8000-000000000001'),null,'the new player joins the league list unrated, by trimmed name');
select is((select count(*)::integer from public.roster_entries where player_id='97000000-0000-4000-8000-000000000001' and active),1,'the new player is on the saved roster');
select lives_ok($$select public.save_team_registration('92000000-0000-4000-8000-000000000001',public.test_division_payload('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003',array['97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003']::uuid[]),true,(select id from public.season_teams where team_id='95000000-0000-4000-8000-000000000001' and division_id='94000000-0000-4000-8000-000000000003'))$$,'a roster with an unrated player can be submitted');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.review_team_registration('92000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='95000000-0000-4000-8000-000000000001' and division_id='94000000-0000-4000-8000-000000000003'),'approved','')$$,'the commissioner can approve it without rating the player');
select is((select rating_snapshot from public.roster_entries where player_id='97000000-0000-4000-8000-000000000001' and active),null,'the approved roster records that the player was unrated');
reset role;
select is((select display_name||'|'||created_by::text from public.players where id='97000000-0000-4000-8000-000000000001'),'Brand New|91000000-0000-4000-8000-000000000002','the player is recorded as added by the manager');
select is((select count(*)::integer from public.player_checks where player_id='97000000-0000-4000-8000-000000000001'),1,'the new player gets a verification record for staff');
select * from finish();
rollback;
