begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('a1000000-0000-4000-8000-000000000001','review-commissioner@example.test','{}'),
('a1000000-0000-4000-8000-000000000002','review-staff@example.test','{}'),
('a1000000-0000-4000-8000-000000000003','review-manager@example.test','{}'),
('a1000000-0000-4000-8000-000000000004',null,'{}'),
('a1000000-0000-4000-8000-000000000005','review-other-league@example.test','{}');
insert into public.leagues(id,slug,name) values('a2000000-0000-4000-8000-000000000001','review-one','Review One'),('a2000000-0000-4000-8000-000000000002','review-two','Review Two');
insert into public.league_members(league_id,user_id,role) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','commissioner'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','league_staff'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','team_manager'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000005','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Review cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'a1000000-0000-4000-8000-000000000001');
insert into public.divisions(id,league_id,season_id,name,max_rating) values('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Open','A');
update public.seasons set status='published' where id='a3000000-0000-4000-8000-000000000001';
insert into public.teams(id,league_id,name,manager_id) values
('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Home Team','a1000000-0000-4000-8000-000000000003'),
('a5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Away Team','a1000000-0000-4000-8000-000000000003');
insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,status,fee_halalas) values
('a6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','Home Team','approved',0),
('a6000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','Away Team','approved',0);
insert into public.players(id,league_id,display_name,created_by) select ('a7000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'a2000000-0000-4000-8000-000000000001','Player '||i,'a1000000-0000-4000-8000-000000000001' from generate_series(1,3) i;
insert into public.player_checks(league_id,player_id,documents_present) select 'a2000000-0000-4000-8000-000000000001',id,true from public.players where id::text like 'a7000000-%';
insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number,player_name,rating_snapshot,accepted_at) values
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',7,'Player 1','B',now()),
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000002',4,'Player 2','C',now());
insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,created_by) values
('a8000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002',now(),'Main court','a1000000-0000-4000-8000-000000000001'),
('a8000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001',now()+interval '7 days','Main court','a1000000-0000-4000-8000-000000000001');
insert into public.game_scorers(game_id,league_id,user_id) values('a8000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004');
-- Fixture setup is followed by permission and atomic approval assertions.
update public.games set status='submitted' where id='a8000000-0000-4000-8000-000000000001';
insert into public.game_events(id,league_id,game_id,sequence,type,payload,occurred_at,created_by)
values('a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,'roster',
'{"team":"home","players":[{"playerId":"a7000000-0000-4000-8000-000000000001","name":"Player 1","jersey":7}]}',now(),'a1000000-0000-4000-8000-000000000001');
create function public.test_potg_summary() returns jsonb language sql immutable as $$
 select '{"teams":{"home":{"players":[{"playerId":"a7000000-0000-4000-8000-000000000001","name":"Player 1","entered":true,"points":20,"stats":{"rebound":5,"assist":4,"steal":2,"block":1,"turnover":3},"fieldGoals":{"made":7,"attempted":14},"freeThrows":{"made":4,"attempted":6}}]}}}'::jsonb;
$$;
grant execute on function public.test_potg_summary() to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,52,48,public.test_potg_summary(),'{}','a7000000-0000-4000-8000-000000000001')$$,'42501','commissioner_required','staff cannot confirm an award');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,52,48,public.test_potg_summary(),'{}','a7000000-0000-4000-8000-000000000001')$$,'42501','commissioner_required','other league commissioner cannot confirm');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,48,52,public.test_potg_summary(),'{}','a7000000-0000-4000-8000-000000000001')$$,'23514','invalid_player_of_game','losing player cannot win award');
select is((select count(*)::integer from public.game_results where game_id='a8000000-0000-4000-8000-000000000001'),0,'invalid selection rolls back the result');
select is((select status from public.games where id='a8000000-0000-4000-8000-000000000001'),'submitted','invalid selection leaves game awaiting approval');
select throws_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,52,48,jsonb_set(public.test_potg_summary(),'{teams,home,players,0,entered}','false'),'{}','a7000000-0000-4000-8000-000000000001')$$,'23514','invalid_player_of_game','unused bench player cannot win');
select throws_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',2,52,48,public.test_potg_summary(),'{}','a7000000-0000-4000-8000-000000000001')$$,'23514','events_changed','selection is bound to the reviewed history');
select lives_ok($$select public.approve_game_with_player('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',1,52,48,public.test_potg_summary(),'{}','a7000000-0000-4000-8000-000000000001')$$,'commissioner confirms award atomically with game');
select is((select efficiency from public.game_player_awards where game_id='a8000000-0000-4000-8000-000000000001'),20,'stored efficiency uses misses and turnovers');
select is((select player_name from public.game_player_awards where game_id='a8000000-0000-4000-8000-000000000001'),'Player 1','name is snapshotted');
select is((select metrics->>'rebounds' from public.game_player_awards where game_id='a8000000-0000-4000-8000-000000000001'),'5','recorded stats are snapshotted');
reset role;
select throws_ok($$update public.game_player_awards set efficiency=99 where game_id='a8000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','award cannot be changed');
select throws_ok($$delete from public.game_player_awards where game_id='a8000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','award cannot be deleted');

-- A record for a game awaiting approval must never appear publicly.
insert into public.game_player_awards(game_id,league_id,player_id,player_name,side,efficiency,metrics)
values('a8000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Hidden award','away',1,'{}');
set local role anon;
select is((select count(*)::integer from public.game_player_awards where league_id='a2000000-0000-4000-8000-000000000001'),1,'public sees only the confirmed approved award');
select ok(not has_table_privilege('anon','public.game_player_awards','INSERT'),'public cannot write awards');
select ok(not has_table_privilege('authenticated','public.game_player_awards','UPDATE'),'signed-in users cannot rewrite awards');
select ok(not has_function_privilege('anon','public.approve_game_with_player(uuid,uuid,integer,integer,integer,jsonb,uuid[],uuid,integer[])','execute'),'public cannot approve results');
reset role;
select * from finish();
rollback;
