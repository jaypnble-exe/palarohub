begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function public.test_registration_payload(team uuid,season uuid,division uuid,players uuid[]) returns jsonb language sql immutable as $$
 select jsonb_build_object('teamId',team,'seasonId',season,'divisionId',division,'roster',coalesce((select jsonb_agg(jsonb_build_object('playerId',id,'jerseyNumber',ordinality)) from unnest(players) with ordinality as p(id,ordinality)),'[]'));
$$;
insert into auth.users(id,email,raw_user_meta_data) values
('71000000-0000-4000-8000-000000000001','registration-commissioner@example.test','{}'),
('71000000-0000-4000-8000-000000000002','registration-staff@example.test','{}'),
('71000000-0000-4000-8000-000000000003','registration-manager@example.test','{}'),
('71000000-0000-4000-8000-000000000004','registration-second-manager@example.test','{}'),
('71000000-0000-4000-8000-000000000005','registration-outsider@example.test','{}'),
('71000000-0000-4000-8000-000000000006','registration-other-league@example.test','{}'),
('71000000-0000-4000-8000-000000000007','registration-admin@example.test','{}');
update public.profiles set is_platform_admin=true where id='71000000-0000-4000-8000-000000000007';
insert into public.leagues(id,slug,name) values('72000000-0000-4000-8000-000000000001','registration-one','Registration One'),('72000000-0000-4000-8000-000000000002','registration-two','Registration Two');
insert into public.league_members(league_id,user_id,role) values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','commissioner'),
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','league_staff'),
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','team_manager'),
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004','team_manager'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000006','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Test cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'71000000-0000-4000-8000-000000000001'),
('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','Other cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'71000000-0000-4000-8000-000000000006');
insert into public.divisions(id,league_id,season_id,name,max_rating,roster_min,roster_max) values
('74000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','Division C','C',2,3),
('74000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','Division C','C',2,3),
('74000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','Open','A',2,3);
update public.seasons set status='published' where id::text like '73000000-%';
insert into public.registration_settings(league_id,season_id,is_open,deadline,fee_halalas) values
('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',true,now()+interval '1 day',180000),
('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002',false,now()+interval '1 day',0);
insert into public.teams(id,league_id,name,manager_id) values
('75000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Manager One Team','71000000-0000-4000-8000-000000000003'),
('75000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','Manager Two Team','71000000-0000-4000-8000-000000000004'),
('75000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000002','Other League Team','71000000-0000-4000-8000-000000000006');
insert into public.players(id,league_id,display_name,created_by) select ('76000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'72000000-0000-4000-8000-000000000001','Player '||i,'71000000-0000-4000-8000-000000000001' from generate_series(1,5) i;
insert into public.players(id,league_id,display_name,created_by) values('76000000-0000-4000-8000-000000000006','72000000-0000-4000-8000-000000000002','Foreign Player','71000000-0000-4000-8000-000000000006');
insert into public.player_checks(league_id,player_id) select league_id,id from public.players where id::text like '76000000-%';
insert into public.player_ratings(league_id,player_id,rating,effective_from,set_by,reason) select league_id,id,case when display_name='Player 4' then 'A' else 'C' end,now()-interval '2 days',created_by,'Initial evaluation' from public.players where id::text like '76000000-%' and display_name<>'Player 5';
select is((select count(*)::integer from pg_class where oid in('public.registration_settings'::regclass,'public.teams'::regclass,'public.players'::regclass,'public.player_checks'::regclass,'public.player_ratings'::regclass,'public.season_teams'::regclass,'public.roster_entries'::regclass,'public.roster_change_requests'::regclass,'public.registration_reviews'::regclass) and relrowsecurity),9,'all registration tables have RLS');
select throws_ok($$update public.player_ratings set rating='D' where player_id='76000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','even trusted SQL cannot overwrite rating history');

set local role anon;
select is((select count(*)::integer from public.published_season_teams where league_id::text like '72000000-%'),0,'no unapproved teams appear in the public projection');
select throws_ok('select * from public.players','42501',null,'public cannot read the private player registry');
select throws_ok('select * from public.roster_entries','42501',null,'public cannot read rosters');
select throws_ok('select review_comment from public.season_teams','42501',null,'public cannot read private review comments');
select throws_ok($$select public.join_league_registration('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001')$$,'42501',null,'public cannot enroll without signing in');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select is((select count(*)::integer from public.players),0,'outsider cannot read any private player registry');
select throws_ok($$select public.create_registration_team('72000000-0000-4000-8000-000000000001','Unauthorized')$$,'42501','team_manager_required','outsider cannot create a team without enrollment');
select throws_ok($$select public.join_league_registration('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002')$$,'23514','registration_closed','self-enrollment is blocked when registration is closed');
select lives_ok($$select public.join_league_registration('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001')$$,'published open registration permits team-manager enrollment');
select is((select count(*)::integer from public.league_members where user_id=auth.uid() and role='commissioner'),0,'enrollment cannot grant commissioner privileges');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]))$$,'manager saves own draft atomically');
select is((select count(*)::integer from public.roster_entries where league_id='72000000-0000-4000-8000-000000000001'),2,'manager can read own roster');
select throws_ok($$insert into public.player_ratings(league_id,player_id,rating,effective_from,set_by,reason) values('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','D',now(),auth.uid(),'Self-rating')$$,'42501',null,'manager cannot self-assign ratings directly');
select throws_ok($$select public.add_player_rating('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','D',now(),'Self-rating')$$,'42501','commissioner_required','manager cannot invoke the rating mutation');
select throws_ok($$select public.set_player_checks('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001',true,false)$$,'42501','staff_required','manager cannot mark their own documents verified');
select is((select count(*)::integer from public.player_checks),0,'verification records stay staff-only');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','{}'::uuid[]))$$,'42501','team_access_required','manager cannot edit another manager team');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002','{}'::uuid[]))$$,'23503','division_season_mismatch','cross-tenant division reference is rejected');
select throws_ok($$select public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','[{"playerId":"76000000-0000-4000-8000-000000000006","jerseyNumber":1}]')$$,'23503','player_league_mismatch','foreign-league player references are rejected');
select is(jsonb_array_length(public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','[]')),1,'preview enforces minimum roster size');
select is(public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','[{"playerId":"76000000-0000-4000-8000-000000000004","jerseyNumber":1}]')->1->>'code','ratingTooHigh','preview rejects a player rated above the division limit');
select throws_ok($$select public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','[{"playerId":"76000000-0000-4000-8000-000000000004","jerseyNumber":1},{"playerId":"76000000-0000-4000-8000-000000000004","jerseyNumber":2}]')$$,'23514','duplicatePlayer','duplicate players are rejected in the database');
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]),true,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'eligible draft can be submitted');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','{}'::uuid[]),false,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'23514','registration_locked','submitted rosters cannot be edited by managers');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.roster_entries where league_id='72000000-0000-4000-8000-000000000001'),0,'another manager cannot read a submitted private roster');
select is((select count(*)::integer from public.registration_reviews where league_id='72000000-0000-4000-8000-000000000001'),0,'another manager cannot read private review history');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]))$$,'23505',null,'a player cannot occupy two active teams in one division');
select is((select count(*)::integer from public.season_teams where team_id='75000000-0000-4000-8000-000000000002'),0,'failed roster save leaves no orphan registration');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.add_player_rating('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','B',now()-interval '1 day','Reassessment')$$,'commissioner appends a new rating');
select is((select count(*)::integer from public.player_ratings where player_id='76000000-0000-4000-8000-000000000001'),2,'earlier rating remains in history');
select throws_ok($$select public.set_registration_settings('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002',true,now()+interval '2 days',0,false)$$,'23514','published_season_required','settings cannot point into another league');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.review_team_registration('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'approved','')$$,'23514','roster_ineligible','approval rechecks ratings changed after submission');
select throws_ok($$select public.review_team_registration('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'returned','')$$,'23514','review_comment_required','return-for-changes requires a plain comment');
select lives_ok($$select public.review_team_registration('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'returned','Choose Open: the player is now rated B.')$$,'staff can return a submitted registration with a comment');
select throws_ok($$select public.set_registration_settings('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',true,now()+interval '2 days',0,false)$$,'42501','commissioner_required','staff cannot change registration settings');
select lives_ok($$select public.set_player_checks('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001',true,false)$$,'staff can record document verification');
select throws_ok($$select public.set_player_checks('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001',true,true)$$,'42501','commissioner_required','staff cannot assign suspensions');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000003',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]),true,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'manager can correct and resubmit a returned registration');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.review_team_registration('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'approved','Welcome to Open.')$$,'staff can approve an eligible roster');
select is((select rating_snapshot from public.roster_entries where player_id='76000000-0000-4000-8000-000000000001' and active),'B','approval snapshots the current rating');
reset role;
set local role anon;
select is((select count(*)::integer from public.published_season_teams where league_id='72000000-0000-4000-8000-000000000001'),1,'approved team appears in the narrow public projection');
select throws_ok('select review_comment from public.published_season_teams','42703',null,'public projection has no private comments');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),0,'approved team private columns remain hidden from another manager');
select is((select count(*)::integer from public.roster_entries where player_id='76000000-0000-4000-8000-000000000001'),0,'approval does not expose the private roster to another manager');

select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.add_player_rating('72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','D',now(),'Later reassessment')$$,'new ratings do not rewrite accepted participation');
select is((select rating_snapshot from public.roster_entries where player_id='76000000-0000-4000-8000-000000000001' and active),'B','accepted rating snapshot remains unchanged');
select lives_ok($$select public.set_registration_settings('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',false,now()-interval '1 second',200000,false)$$,'commissioner closes registration independently of season rules');
select is((select fee_halalas from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),180000,'accepted fee snapshot survives later setting changes');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000003','{}'::uuid[]),false,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'23514','registration_closed','deadline prevents direct roster editing');
select lives_ok($$select public.request_roster_change('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'[{"playerId":"76000000-0000-4000-8000-000000000001","jerseyNumber":7},{"playerId":"76000000-0000-4000-8000-000000000002","jerseyNumber":8}]','Jersey numbers need correction.')$$,'manager requests an eligible roster change after the deadline');
select throws_ok($$select public.request_roster_change('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'[{"playerId":"76000000-0000-4000-8000-000000000001","jerseyNumber":7},{"playerId":"76000000-0000-4000-8000-000000000002","jerseyNumber":8}]','Duplicate request')$$,'23505',null,'only one submitted change request is allowed per roster');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.review_roster_change('72000000-0000-4000-8000-000000000001',(select id from public.roster_change_requests where league_id='72000000-0000-4000-8000-000000000001'),true,'Approved correction.')$$,'staff approves a roster change after rechecking eligibility');
select is((select count(*)::integer from public.roster_entries where league_id='72000000-0000-4000-8000-000000000001' and not active and accepted_at is not null),2,'change approval preserves prior accepted roster entries');
select is((select jersey_number::integer from public.roster_entries where player_id='76000000-0000-4000-8000-000000000001' and active),7,'approved change activates the corrected roster');
reset role;
select throws_ok($$update public.roster_entries set rating_snapshot='A' where league_id='72000000-0000-4000-8000-000000000001' and accepted_at is not null$$,'23514','roster_history_locked','accepted roster history cannot be rewritten');
select throws_ok($$delete from public.registration_reviews where league_id='72000000-0000-4000-8000-000000000001'$$,'23514','history_is_append_only','review decisions are append-only');
-- Check independent eligibility flags and a deadline even when is_open remains true.
update public.registration_settings set require_documents=true,is_open=true,deadline=now()-interval '1 second' where league_id='72000000-0000-4000-8000-000000000001';
update public.player_checks set suspended=true where player_id='76000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.join_league_registration('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001')$$,'23514','registration_closed','expired deadline blocks enrollment even while is_open is true');
select ok(public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000003','[{"playerId":"76000000-0000-4000-8000-000000000002","jerseyNumber":8}]',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001')) @> '[{"code":"playerSuspended"}]'::jsonb,'suspended players fail eligibility');
select ok(public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000003','[{"playerId":"76000000-0000-4000-8000-000000000002","jerseyNumber":8}]',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001')) @> '[{"code":"documentsMissing"}]'::jsonb,'required document verification fails independently');
select throws_ok($$select public.check_registration_eligibility('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000003','[{"playerId":"76000000-0000-4000-8000-000000000002","jerseyNumber":8,"iqama":"unwanted-data"}]')$$,'23514','invalid_roster','roster payload rejects extra personal-data fields');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*)::integer from public.league_player_catalog where league_id='72000000-0000-4000-8000-000000000001'),0,'player catalog view preserves cross-league RLS');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
select is((select count(*)::integer from public.teams where league_id='72000000-0000-4000-8000-000000000001'),2,'platform admin sees all tenant teams');
reset role;
select * from finish();
rollback;
