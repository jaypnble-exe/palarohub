begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('91000000-0000-4000-8000-000000000001','scoring-commissioner@example.test','{}'),
('91000000-0000-4000-8000-000000000002','scoring-staff@example.test','{}'),
('91000000-0000-4000-8000-000000000003','scoring-manager@example.test','{}'),
('91000000-0000-4000-8000-000000000004',null,'{}'),
('91000000-0000-4000-8000-000000000005',null,'{}'),
('91000000-0000-4000-8000-000000000006','scoring-outsider@example.test','{}'),
('91000000-0000-4000-8000-000000000007','scoring-other-league@example.test','{}');
insert into public.leagues(id,slug,name) values('92000000-0000-4000-8000-000000000001','scoring-one','Scoring One'),('92000000-0000-4000-8000-000000000002','scoring-two','Scoring Two');
insert into public.league_members(league_id,user_id,role) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','commissioner'),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','league_staff'),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','team_manager'),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000007','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Scoring cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'91000000-0000-4000-8000-000000000001'),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Other cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'91000000-0000-4000-8000-000000000007');
insert into public.divisions(id,league_id,season_id,name,max_rating,rules) values
('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Open','A','{"foulOut":6,"teamBonusAfter":4,"quarters":4,"quarterMinutes":12,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}'),
('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','Open','A',null);
update public.seasons set status='published' where id::text like '93000000-%';
insert into public.registration_settings(league_id,season_id,is_open,deadline,fee_halalas) values('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',true,now()+interval '1 day',0);
insert into public.teams(id,league_id,name,manager_id) values
('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Home Team','91000000-0000-4000-8000-000000000003'),
('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Away Team','91000000-0000-4000-8000-000000000003'),
('95000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','Other A','91000000-0000-4000-8000-000000000007'),
('95000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','Other B','91000000-0000-4000-8000-000000000007');
insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,status,fee_halalas) values
('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Home Team','approved',0),
('96000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','Away Team','approved',0),
('96000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003','Other A','approved',0),
('96000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000004','Other B','approved',0);
insert into public.players(id,league_id,display_name,created_by) select ('97000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'92000000-0000-4000-8000-000000000001','Player '||i,'91000000-0000-4000-8000-000000000001' from generate_series(1,4) i;
insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number,player_name,rating_snapshot,accepted_at,active) values
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001',7,'Player 1','B',now(),true),
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002',11,'Player 2','C',now(),true),
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000003',4,'Player 3','C',now(),true),
-- A replaced roster line and an unreviewed draft line must not reach the scorer.
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',9,'Player 4','C',now(),false),
('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',10,null,null,null,true);
insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,created_by) values
('98000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002',now(),'Main court','91000000-0000-4000-8000-000000000001'),
('98000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000004',now(),'Gym','91000000-0000-4000-8000-000000000007');
create function public.test_scoring_event(n integer,type text default 'period_start',payload jsonb default '{}') returns jsonb language sql immutable as $$
 select jsonb_build_object('id',('99000000-0000-4000-8000-'||lpad(n::text,12,'0')),'sequence',n,'type',type,'payload',payload,'clockMs',null,'period',0,'occurredAt','2030-01-04T16:00:00Z');
$$;
grant execute on function public.test_scoring_event(integer,text,jsonb) to authenticated;
-- Device sessions: two anonymous scorer devices and three named accounts.
create function public.test_as(who text) returns void language sql as $$
 select set_config('request.jwt.claims',case who
  when 'commissioner' then '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}'
  when 'staff' then '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}'
  when 'manager' then '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}'
  when 'device1' then '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}'
  when 'device2' then '{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":true}'
  when 'outsider' then '{"sub":"91000000-0000-4000-8000-000000000006","role":"authenticated"}'
  when 'other' then '{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated"}' end,true);
$$;
grant execute on function public.test_as(text) to authenticated;

select is((select count(*)::integer from pg_class where oid in('public.game_scorer_access'::regclass,'public.game_scorers'::regclass,'public.game_events'::regclass) and relrowsecurity),3,'scoring tables have RLS');

set local role anon;
select throws_ok('select * from public.game_events','42501',null,'public cannot read game events');
select throws_ok($$select public.claim_scorer_access('98000000-0000-4000-8000-000000000001','000000')$$,'42501',null,'signed-out visitors cannot claim a scorebook');
reset role;
set local role authenticated;

select public.test_as('device1');
select throws_ok($$select public.join_league_registration('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001')$$,'42501','sign_in_required','anonymous scorer sessions cannot enroll as team managers');
select throws_ok($$select public.scorer_game_setup('98000000-0000-4000-8000-000000000001')$$,'42501','scorer_required','a device without the PIN cannot load the scorebook');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(1)))$$,'42501','scorer_required','a device without the PIN cannot record events');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001','123456'),'invalid','no PIN has been issued yet');

select public.test_as('manager');
select throws_ok($$select public.create_scorer_pin('92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001')$$,'42501','staff_required','team managers cannot issue scorer PINs');
select public.test_as('other');
select throws_ok($$select public.create_scorer_pin('92000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000001')$$,'23503','game_not_found','another league cannot issue a PIN for this game');
select public.test_as('staff');
select set_config('test.pin',public.create_scorer_pin('92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001'),true);
select ok(current_setting('test.pin') ~ '^\d{6}$','staff issue a 6-digit PIN');
select throws_ok('select pin_hash from public.game_scorer_access','42501',null,'the PIN hash is never readable');
select is((select count(*)::integer from public.game_scorer_access where expires_at between now()+interval '23 hours' and now()+interval '25 hours'),1,'PINs expire after a day');

select public.test_as('device1');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001',case when current_setting('test.pin')='000000' then '000001' else '000000' end),'invalid','a wrong PIN is refused');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001','12345'),'invalid','a malformed PIN is refused');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001',current_setting('test.pin')),'granted','the right PIN unlocks the scorebook');
select is((select count(*)::integer from public.games),1,'the scorer device sees only its own game');
select is((public.scorer_game_setup('98000000-0000-4000-8000-000000000001')->'teams'->'home'->'players'->0->>'name'),'Player 1','setup includes the approved home roster');
select is(jsonb_array_length(public.scorer_game_setup('98000000-0000-4000-8000-000000000001')->'teams'->'away'->'players'),1,'replaced and unreviewed roster lines are left out');
select is((public.scorer_game_setup('98000000-0000-4000-8000-000000000001')->'rules'->>'foulOut'),'6','division rules override season rules');
select is((public.scorer_game_setup('98000000-0000-4000-8000-000000000001')->>'sport'),'basketball','setup names the sport module');
select is((select count(*)::integer from public.players),0,'the scorer device cannot browse the player registry');

select is(public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(1,'roster','{"team":"home","players":[]}'),public.test_scoring_event(2))),2,'the official device records a batch');
select is((select status from public.games where id='98000000-0000-4000-8000-000000000001'),'in_progress','the first event marks the game in progress');
select is(public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(1,'roster','{"team":"home","players":[]}'),public.test_scoring_event(2))),0,'re-sending the same batch is harmless');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(2,'period_end')))$$,'23505','event_conflict','an event id cannot be reused for different content');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(3)||'{"sequence":2}'))$$,'23505','sequence_conflict','two events cannot share a sequence number');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(3)||'{"ipAddress":"x"}'))$$,'23514','invalid_events','unknown event fields are refused');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(3,'Drop Table')))$$,'23514',null,'event types are restricted');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001','[]')$$,'23514','invalid_events','an empty batch is refused');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(3),public.test_scoring_event(4)||'{"sequence":"x"}'))$$,'23514','invalid_events','a bad event rejects the whole batch');
select is((select count(*)::integer from public.game_events),2,'the scorer reads the saved events');

-- A second device takes over; the first can no longer write or read.
select public.test_as('device2');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001',current_setting('test.pin')),'granted','a replacement device takes over with the PIN');
select is(public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(3,'clock_start'))),1,'the replacement device records events');
select public.test_as('device1');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(4,'clock_stop')))$$,'42501','scorer_required','the replaced device is no longer the official record');
select is((select count(*)::integer from public.game_events),0,'the replaced device cannot read the event log');
select is((select count(*)::integer from public.games),0,'the replaced device cannot see the game');

select public.test_as('manager');
select is((select count(*)::integer from public.game_events where game_id='98000000-0000-4000-8000-000000000001'),3,'league members can follow the event log');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(4,'clock_stop')))$$,'42501','scorer_required','league members cannot write events');
select public.test_as('other');
select is((select count(*)::integer from public.game_events where game_id='98000000-0000-4000-8000-000000000001'),0,'other leagues cannot read the event log');
select is((select count(*)::integer from public.game_scorers),0,'other leagues cannot see scorer devices');

select public.test_as('outsider');
-- Attempts count per PIN: the two wrong tries above plus seven more leave one.
select is((select array_agg(public.claim_scorer_access('98000000-0000-4000-8000-000000000001','999999'))::text from generate_series(1,7)),case when current_setting('test.pin')='999999' then null else '{invalid,invalid,invalid,invalid,invalid,invalid,invalid}' end,'wrong guesses are counted');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001','999999'),case when current_setting('test.pin')='999999' then 'granted' else 'locked' end,'the tenth wrong guess locks the PIN');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001',current_setting('test.pin')),case when current_setting('test.pin')='999999' then 'granted' else 'locked' end,'a locked PIN stays locked even when correct');
select public.test_as('staff');
select set_config('test.pin',public.create_scorer_pin('92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001'),true);
select is((select failed_attempts::integer from public.game_scorer_access),0,'a new PIN clears the lockout');
select is((select count(*)::integer from public.game_scorers where revoked_at is null and user_id='91000000-0000-4000-8000-000000000005'),1,'a new PIN keeps the current device in place');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001'),'granted','staff take over the scorebook without a PIN');
select is(public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(4,'clock_stop'))),1,'staff can score from their own device');
select is((select count(*)::integer from public.game_scorers where game_id='98000000-0000-4000-8000-000000000001' and revoked_at is null),1,'exactly one official scorer device remains');
select throws_ok($$select public.update_game('92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001',now(),'Gym','postponed')$$,'23514','game_locked','a game in progress cannot be rescheduled');
reset role;

select throws_ok($$update public.game_events set payload='{}' where game_id='98000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','even trusted SQL cannot rewrite events');
select throws_ok($$delete from public.game_events where game_id='98000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','even trusted SQL cannot delete events');
update public.game_scorer_access set expires_at=now()-interval '1 minute';
set local role authenticated;
select public.test_as('device1');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001',current_setting('test.pin')),'expired','expired PINs are refused');
reset role;
update public.games set status='submitted' where id='98000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.test_as('staff');
select is(public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(4,'clock_stop'))),0,'offline retries of saved events still succeed after submission');
select throws_ok($$select public.record_game_events('98000000-0000-4000-8000-000000000001',jsonb_build_array(public.test_scoring_event(5,'clock_start')))$$,'23514','game_not_open','no new events after the game is submitted');
select is(public.claim_scorer_access('98000000-0000-4000-8000-000000000001'),'closed','a submitted game cannot be claimed');
select throws_ok($$select public.create_scorer_pin('92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001')$$,'23514','game_not_open','no PINs for a submitted game');
reset role;
select * from finish();
rollback;
