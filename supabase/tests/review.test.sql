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
create function public.test_review_event(n integer,type text) returns jsonb language sql immutable as $$
 select jsonb_build_object('id',('a9000000-0000-4000-8000-'||lpad(n::text,12,'0')),'sequence',n,'type',type,'payload','{}'::jsonb,'clockMs',null,'period',4,'occurredAt','2030-01-04T16:00:00Z');
$$;
create function public.test_review_as(who text) returns void language sql as $$
 select set_config('request.jwt.claims',case who
  when 'commissioner' then '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}'
  when 'staff' then '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}'
  when 'manager' then '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}'
  when 'device' then '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}'
  when 'other' then '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}' end,true);
$$;
grant execute on function public.test_review_event(integer,text),public.test_review_as(text) to authenticated;
-- A tidy summary like the one the server action derives from the event log.
create function public.test_summary() returns jsonb language sql immutable as $$ select '{"sport":"basketball","home":{"score":52},"away":{"score":48}}'::jsonb $$;
grant execute on function public.test_summary() to authenticated;

select is((select count(*)::integer from pg_class where oid in('public.game_results'::regclass,'public.game_reviews'::regclass,'public.suspensions'::regclass) and relrowsecurity),3,'review tables have RLS');

set local role authenticated;
select public.test_review_as('device');
select is(public.record_game_events('a8000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_review_event(1,'period_start'),public.test_review_event(2,'period_end'))),2,'the scorer records the game');
select throws_ok($$select public.submit_game('a8000000-0000-4000-8000-000000000001',2)$$,'23514','game_not_finished','a game cannot be submitted before the final buzzer');
select is(public.record_game_events('a8000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_review_event(3,'game_end'))),1,'the final buzzer is recorded');
select throws_ok($$select public.submit_game('a8000000-0000-4000-8000-000000000001',2)$$,'23514','events_not_synced','a device that has not sent every action cannot submit');
select lives_ok($$select public.submit_game('a8000000-0000-4000-8000-000000000001',3)$$,'the scorer submits the finished game');
select throws_ok($$select public.record_game_events('a8000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_review_event(4,'period_start')))$$,'23514','game_not_open','no actions after submission');
select throws_ok($$select public.submit_game('a8000000-0000-4000-8000-000000000001',3)$$,'23514','game_not_open','a game is submitted once');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',3,52,48,public.test_summary())$$,'42501','staff_required','the scorer cannot approve their own game');
select is((select count(*)::integer from public.game_results),0,'the scorer device cannot read results');

select public.test_review_as('manager');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',3,52,48,public.test_summary())$$,'42501','staff_required','team managers cannot approve games');
select throws_ok($$select public.reopen_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','Fix it')$$,'42501','staff_required','team managers cannot reopen games');
select is((select count(*)::integer from public.game_reviews),0,'team managers cannot read review comments');

select public.test_review_as('staff');
select is((select status from public.games where id='a8000000-0000-4000-8000-000000000001'),'submitted','staff see the game waiting for approval');
select throws_ok($$select public.reopen_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','  ')$$,'23514','review_comment_required','reopening needs a reason for the scorer');
select lives_ok($$select public.reopen_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','Add the missing free throw in Q4.')$$,'staff reopen a game for correction');
select public.test_review_as('device');
select is((select comment from public.game_reviews where action='reopened'),'Add the missing free throw in Q4.','the scorer device sees why the game was reopened');
select is(public.record_game_events('a8000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_review_event(4,'clock_stop'))),1,'the scorer fixes the reopened game');
select lives_ok($$select public.submit_game('a8000000-0000-4000-8000-000000000001',4)$$,'the scorer submits again');

select public.test_review_as('other');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001',4,52,48,public.test_summary())$$,'23503','game_not_found','another league cannot approve this game');

select public.test_review_as('staff');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',3,52,48,public.test_summary())$$,'23514','events_changed','approval is tied to the events that were reviewed');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',4,52,48,public.test_summary(),array['a7000000-0000-4000-8000-000000000003'::uuid])$$,'23514','player_not_in_game','only players in this game can be suspended');
select is((select count(*)::integer from public.game_results),0,'a failed approval saves nothing');
select lives_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',4,52,48,public.test_summary(),array['a7000000-0000-4000-8000-000000000001'::uuid])$$,'staff approve the result and the suspension');
select is((select status from public.games where id='a8000000-0000-4000-8000-000000000001'),'approved','the game is final');
select is((select home_score||'-'||away_score from public.game_results),'52-48','the official score is stored');
select is((select approved_by::text from public.game_results),'a1000000-0000-4000-8000-000000000002','the result records who approved it');
select is((select count(*)::integer from public.suspensions where player_id='a7000000-0000-4000-8000-000000000001'),1,'the ejection becomes a suspension record');
select is((select suspended from public.player_checks where player_id='a7000000-0000-4000-8000-000000000001'),true,'the suspended player fails eligibility checks');
select is((select documents_present from public.player_checks where player_id='a7000000-0000-4000-8000-000000000001'),true,'other player checks are kept');
select is((select string_agg(action,',' order by created_at,action) from public.game_reviews),'approved,reopened,submitted,submitted','every review step is kept');
select is((public.scorer_game_setup('a8000000-0000-4000-8000-000000000002')->'teams'->'away'->'players'->0->>'suspended'),'true','the next scorebook flags the suspended player');
select throws_ok($$select public.approve_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',4,52,48,public.test_summary())$$,'23514','game_not_submitted','a result is approved once');
select throws_ok($$select public.reopen_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','Too late')$$,'23514','game_not_submitted','an approved game cannot be reopened');
select throws_ok($$select public.update_game('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',now(),'Gym','postponed')$$,'23514','game_locked','an approved game cannot be rescheduled');

select public.test_review_as('manager');
select is((select count(*)::integer from public.game_results),1,'league members can read results');
select is((select count(*)::integer from public.suspensions),0,'only staff can read suspensions');
select public.test_review_as('other');
select is((select count(*)::integer from public.game_results),0,'other leagues cannot read results');
reset role;

select throws_ok($$update public.game_results set home_score=99$$,'23514','history_is_append_only','an approved result cannot be rewritten');
select throws_ok($$delete from public.game_reviews$$,'23514','history_is_append_only','review history cannot be deleted');
select throws_ok($$delete from public.suspensions$$,'23514','history_is_append_only','suspension records cannot be deleted');

set local role anon;
select throws_ok('select * from public.game_results','42501',null,'the public cannot read the results table');
select is((select home_score||'-'||away_score from public.published_games where id='a8000000-0000-4000-8000-000000000001'),'52-48','the public schedule shows the approved score');
select is((select home_score from public.published_games where id='a8000000-0000-4000-8000-000000000002'),null,'unplayed games show no score');
reset role;
select * from finish();
rollback;
