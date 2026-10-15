begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function public.test_edit_payload(team uuid,players uuid[]) returns jsonb language sql stable as $$
 select jsonb_build_object('teamId',team,'logoPath',(select league_id::text from public.teams where id=team)||'/'||team::text||'/logo/00000000-0000-4000-8000-000000000001.png','seasonId','a3000000-0000-4000-8000-000000000001','divisionId','a4000000-0000-4000-8000-000000000001','roster',coalesce((select jsonb_agg(jsonb_build_object('playerId',id,'jerseyNumber',ordinality)) from unnest(players) with ordinality as p(id,ordinality)),'[]'));
$$;
insert into auth.users(id,email,raw_user_meta_data) values
('a1000000-0000-4000-8000-000000000001','edits-commissioner@example.test','{}'),
('a1000000-0000-4000-8000-000000000002','edits-manager@example.test','{}'),
('a1000000-0000-4000-8000-000000000003','edits-other-manager@example.test','{}');
insert into public.leagues(id,slug,name) values('a2000000-0000-4000-8000-000000000001','registration-edits','Registration Edits');
insert into public.league_members(league_id,user_id,role) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','commissioner'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','team_manager'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','team_manager');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Edits cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'a1000000-0000-4000-8000-000000000001');
insert into public.divisions(id,league_id,season_id,name,max_rating,roster_min,roster_max) values
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Division C','C',1,3);
update public.seasons set status='published' where id='a3000000-0000-4000-8000-000000000001';
insert into public.registration_settings(league_id,season_id,is_open,deadline,fee_halalas) values
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',true,now()+interval '1 day',100000);
insert into public.teams(id,league_id,name,manager_id) values
('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Sent Team','a1000000-0000-4000-8000-000000000002'),
('a5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Draft Team','a1000000-0000-4000-8000-000000000002');
insert into public.players(id,league_id,display_name,created_by) select ('a6000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'a2000000-0000-4000-8000-000000000001','Edit '||i,'a1000000-0000-4000-8000-000000000001' from generate_series(1,3) i;
insert into public.player_checks(league_id,player_id) select league_id,id from public.players where id::text like 'a6000000-%';
insert into public.player_ratings(league_id,player_id,rating,effective_from,set_by,reason) select league_id,id,'C',now()-interval '1 day',created_by,'Initial evaluation' from public.players where id::text like 'a6000000-%';

-- Uploaded logos for the registration fixtures (object metadata only).
insert into storage.objects(bucket_id,name,metadata)
 select 'team-registration-media',league_id::text||'/'||id::text||'/logo/00000000-0000-4000-8000-000000000001.png',
 '{"mimetype":"image/png","size":70}'::jsonb from public.teams where id::text like 'a5000000-%';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000001',array['a6000000-0000-4000-8000-000000000001']::uuid[]),true)$$,'the manager submits a registration');
select lives_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000002',array['a6000000-0000-4000-8000-000000000003']::uuid[]))$$,'the manager keeps another team as a draft');
select lives_ok($$select public.withdraw_team_registration('a2000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'the manager takes back a registration waiting for review');
select is((select status||'|'||coalesce(submitted_at::text,'none') from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'),'draft|none','a taken-back registration is a draft again');
select is((select string_agg(action,',' order by action) from public.registration_reviews where registration_id=(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001')),'submitted,withdrawn','taking it back is kept in the history');
select throws_ok($$select public.withdraw_team_registration('a2000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'23514','registration_not_submitted','only a registration waiting for review can be taken back');
select lives_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000001',array['a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002']::uuid[]),true,(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'the manager fixes and sends it again');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.withdraw_team_registration('a2000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000000')$$,'42501','team_access_required','another manager cannot take back a registration');

reset role;
update public.registration_settings set deadline=now()-interval '1 hour' where season_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.withdraw_team_registration('a2000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'23514','registration_closed','after the deadline a registration cannot be taken back');
select throws_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000002',array['a6000000-0000-4000-8000-000000000003']::uuid[]),true,(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000002'))$$,'23514','registration_closed','a plain draft still closes at the deadline');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.review_team_registration('a2000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'),'returned','Please fix jersey #2')$$,'the commissioner returns it after the deadline');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000001',array['a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002']::uuid[]),false,(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'a returned roster can be saved after the deadline');
select is((select status from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'),'returned','saving keeps it returned so it stays editable');
select lives_ok($$select public.save_team_registration('a2000000-0000-4000-8000-000000000001',public.test_edit_payload('a5000000-0000-4000-8000-000000000001',array['a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002']::uuid[]),true,(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'))$$,'a returned roster can be resubmitted after the deadline');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.review_team_registration('a2000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='a5000000-0000-4000-8000-000000000001'),'approved','')$$,'the commissioner approves the fixed roster');
reset role;
select * from finish();
rollback;
