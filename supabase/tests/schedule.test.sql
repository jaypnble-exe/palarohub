begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('81000000-0000-4000-8000-000000000001','schedule-commissioner@example.test','{}'),
('81000000-0000-4000-8000-000000000002','schedule-staff@example.test','{}'),
('81000000-0000-4000-8000-000000000003','schedule-manager@example.test','{}'),
('81000000-0000-4000-8000-000000000004','schedule-outsider@example.test','{}'),
('81000000-0000-4000-8000-000000000005','schedule-other-league@example.test','{}');
insert into public.leagues(id,slug,name) values('82000000-0000-4000-8000-000000000001','schedule-one','Schedule One'),('82000000-0000-4000-8000-000000000002','schedule-two','Schedule Two');
insert into public.league_members(league_id,user_id,role) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','commissioner'),
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','league_staff'),
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','team_manager'),
('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000005','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Schedule cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'81000000-0000-4000-8000-000000000001'),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','Other cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'81000000-0000-4000-8000-000000000005'),
('83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','Draft cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'81000000-0000-4000-8000-000000000001');
insert into public.divisions(id,league_id,season_id,name,max_rating) values
('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Open','A'),
('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Division C','C'),
('84000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','Open','A'),
('84000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','Draft open','A');
update public.seasons set status='published' where id in('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002');
insert into public.teams(id,league_id,name,manager_id) select ('85000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'82000000-0000-4000-8000-000000000001','Team '||i,'81000000-0000-4000-8000-000000000003' from generate_series(1,7) i;
insert into public.teams(id,league_id,name,manager_id) values('85000000-0000-4000-8000-000000000008','82000000-0000-4000-8000-000000000002','Other Team','81000000-0000-4000-8000-000000000005');
-- Teams 1-4: approved in Open. 5: submitted in Open. 6: approved in Division C. 7: draft season. 8: other league.
insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,status,fee_halalas) values
('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','Team 1','approved',0),
('86000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','Team 2','approved',0),
('86000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000003','Team 3','approved',0),
('86000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','Team 4','approved',0),
('86000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000005','Team 5','submitted',0),
('86000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000006','Team 6','approved',0),
('86000000-0000-4000-8000-000000000007','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000007','Team 7','approved',0),
('86000000-0000-4000-8000-000000000008','82000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000008','Other Team','approved',0);
create function public.test_schedule_game(home integer,away integer,round integer,starts text) returns jsonb language sql immutable as $$
 select jsonb_build_object('homeTeamId',('86000000-0000-4000-8000-'||lpad(home::text,12,'0')),'awayTeamId',('86000000-0000-4000-8000-'||lpad(away::text,12,'0')),'round',round,'scheduledAt',starts,'venue','Main court');
$$;

select is((select count(*)::integer from pg_class where oid in('public.games'::regclass,'public.announcements'::regclass) and relrowsecurity),2,'schedule tables have RLS');
select throws_ok($$insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',now(),'81000000-0000-4000-8000-000000000001')$$,'23514',null,'a team cannot play itself');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z')))$$,'42501','staff_required','outsiders cannot create schedules');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z')))$$,'42501','staff_required','team managers cannot create schedules');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z')))$$,'23503','division_league_mismatch','another commissioner cannot schedule a foreign division through their own league');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002',now(),auth.uid())$$,'42501',null,'staff cannot bypass schedule checks with direct writes');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,5,1,'2030-01-04T16:00:00Z')))$$,'23514','team_not_in_division','teams awaiting approval cannot be scheduled');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,6,1,'2030-01-04T16:00:00Z')))$$,'23514','team_not_in_division','teams from another division cannot be scheduled');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,8,1,'2030-01-04T16:00:00Z')))$$,'23514','team_not_in_division','teams from another league cannot be scheduled');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000004','84000000-0000-4000-8000-000000000004',jsonb_build_array(public.test_schedule_game(7,7,1,'2030-01-04T16:00:00Z')))$$,'42501','staff_required','unknown leagues are refused');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z')||'{"refereeIqama":"x"}'))$$,'23514','invalid_schedule','schedule payload rejects unknown fields');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','[]')$$,'23514','invalid_schedule','an empty schedule is refused');
select is(public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(
 public.test_schedule_game(1,4,1,'2030-01-04T16:00:00Z'),public.test_schedule_game(2,3,1,'2030-01-04T17:30:00Z'),
 public.test_schedule_game(4,3,2,'2030-01-11T16:00:00Z'),public.test_schedule_game(1,2,2,'2030-01-11T17:30:00Z'),
 public.test_schedule_game(2,4,3,'2030-01-18T16:00:00Z'),public.test_schedule_game(3,1,3,'2030-01-18T17:30:00Z'))),6,'staff saves a full round-robin atomically');
select is((select count(*)::integer from public.games where division_id='84000000-0000-4000-8000-000000000001'),6,'all generated games are stored');
select is((select count(*)::integer from public.games where created_by=auth.uid()),6,'games record who scheduled them');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z')))$$,'23514','schedule_exists','an existing schedule is not replaced by accident');
select throws_ok($$select public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(1,2,1,'2030-01-04T16:00:00Z'),public.test_schedule_game(1,5,1,'2030-01-04T16:00:00Z')),true)$$,'23514','team_not_in_division','a failed replacement keeps the original schedule');
select is((select count(*)::integer from public.games where division_id='84000000-0000-4000-8000-000000000001'),6,'failed replacement rolled back atomically');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.games where league_id='82000000-0000-4000-8000-000000000001'),6,'league members can read their schedule');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select is((select count(*)::integer from public.games where league_id='82000000-0000-4000-8000-000000000001'),0,'other league members cannot read the private games table');
select throws_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.published_games where league_id='82000000-0000-4000-8000-000000000001' and round=1 limit 1),now(),'Gym','cancelled')$$,'42501','staff_required','another league cannot change this schedule');
select throws_ok($$select public.update_game('82000000-0000-4000-8000-000000000002',(select id from public.published_games where league_id='82000000-0000-4000-8000-000000000001' and round=1 limit 1),now(),'Gym','cancelled')$$,'23503','game_not_found','a foreign game is not found through another league');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.games where division_id='84000000-0000-4000-8000-000000000001' and round=1 and home_season_team_id='86000000-0000-4000-8000-000000000001'),null,'Main court','postponed')$$,'a postponed game may wait for a new date');
select throws_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.games where division_id='84000000-0000-4000-8000-000000000001' and round=1 and home_season_team_id='86000000-0000-4000-8000-000000000001'),null,'Main court','scheduled')$$,'23514',null,'a scheduled game needs a date');
select lives_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.games where division_id='84000000-0000-4000-8000-000000000001' and round=1 and home_season_team_id='86000000-0000-4000-8000-000000000001'),'2030-01-25T16:00:00Z',' Court 2 ','scheduled')$$,'a postponed game is moved to a new date and court');
select is((select venue from public.games where division_id='84000000-0000-4000-8000-000000000001' and round=1 and home_season_team_id='86000000-0000-4000-8000-000000000001'),'Court 2','court names are trimmed');
select throws_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.games where division_id='84000000-0000-4000-8000-000000000001' limit 1),now(),'Gym','finished')$$,'23514','invalid_game_status','results cannot be entered through schedule edits');
select lives_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.games where division_id='84000000-0000-4000-8000-000000000001' and round=3 and home_season_team_id='86000000-0000-4000-8000-000000000003'),'2030-01-18T17:30:00Z','Main court','cancelled')$$,'staff can cancel a game');
select is(public.add_game('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003','86000000-0000-4000-8000-000000000001','2030-02-01T16:00:00Z','Main court') is not null,true,'staff adds a make-up game');
select throws_ok($$select public.add_game('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003','86000000-0000-4000-8000-000000000001',null,'Main court')$$,'23514','invalid_game_time','an added game needs a date');
select throws_ok($$select public.add_game('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003','86000000-0000-4000-8000-000000000001','2030-02-01T16:00:00Z',repeat('x',81))$$,'23514','invalid_venue','court names are limited');
select is(public.save_division_schedule('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_schedule_game(2,1,1,'2030-03-01T16:00:00Z')),true),1,'an unplayed schedule can be replaced on purpose');
select is((select count(*)::integer from public.games where division_id='84000000-0000-4000-8000-000000000001'),1,'replacement removes the earlier unplayed games');

-- Announcements: staff write; everyone reads league-wide and published-division posts.
select lives_ok($$insert into public.announcements(league_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','Gym change','Saturday games move to Court 2.',auth.uid())$$,'commissioner posts a league announcement');
select lives_ok($$insert into public.announcements(league_id,season_id,division_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','Draft note','Not public yet.',auth.uid())$$,'commissioner posts to a draft-season division');
select throws_ok($$insert into public.announcements(league_id,season_id,division_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003','Wrong league','Nope',auth.uid())$$,'23503',null,'announcements cannot target another league''s division');
select throws_ok($$insert into public.announcements(league_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','Spoof','Nope','81000000-0000-4000-8000-000000000002')$$,'42501',null,'announcements cannot be posted as someone else');
select throws_ok($$insert into public.announcements(league_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','  ','Nope',auth.uid())$$,'23514',null,'announcement titles are required');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$insert into public.announcements(league_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','Manager post','Nope',auth.uid())$$,'42501',null,'team managers cannot post announcements');
update public.announcements set title='Hacked' where league_id='82000000-0000-4000-8000-000000000001';
delete from public.announcements where league_id='82000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.announcements where league_id='82000000-0000-4000-8000-000000000001' and title<>'Hacked'),2,'team managers cannot edit or delete announcements');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.announcements set body='Saturday games move to Court 3.',updated_at=now() where title='Gym change'$$,'staff edits an announcement');
select throws_ok($$update public.announcements set created_by=auth.uid() where title='Gym change'$$,'42501',null,'announcement authors cannot be rewritten');
reset role;

set local role anon;
select throws_ok('select * from public.games','42501',null,'public cannot read the private games table');
select is((select count(*)::integer from public.published_games where league_id='82000000-0000-4000-8000-000000000001'),1,'public reads the published schedule');
select is((select home_team_name||' vs '||away_team_name from public.published_games where league_id='82000000-0000-4000-8000-000000000001'),'Team 2 vs Team 1','public schedule shows team names');
select is((select count(*)::integer from public.announcements where league_id='82000000-0000-4000-8000-000000000001'),1,'public sees league posts but not draft-season posts');
select throws_ok($$insert into public.announcements(league_id,title,body,created_by) values('82000000-0000-4000-8000-000000000001','Anon','Nope','81000000-0000-4000-8000-000000000001')$$,'42501',null,'public cannot post announcements');
select throws_ok($$select public.update_game('82000000-0000-4000-8000-000000000001',(select id from public.published_games limit 1),now(),'Gym','cancelled')$$,'42501',null,'public cannot change games');
reset role;

select throws_ok($$insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','86000000-0000-4000-8000-000000000007','86000000-0000-4000-8000-000000000001',now(),'81000000-0000-4000-8000-000000000001')$$,'23514','published_season_required','draft seasons cannot have games');
select throws_ok($$insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,created_by) values('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000007',now(),'81000000-0000-4000-8000-000000000001')$$,'23514','team_not_in_division','games cannot mix seasons');
select throws_ok($$update public.games set away_season_team_id='86000000-0000-4000-8000-000000000003' where division_id='84000000-0000-4000-8000-000000000001'$$,'23514','game_identity_locked','even trusted SQL cannot swap the teams of a game');
select * from finish();
rollback;
