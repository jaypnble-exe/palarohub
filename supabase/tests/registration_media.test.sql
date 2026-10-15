begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function public.test_registration_payload(team uuid,season uuid,division uuid,players uuid[]) returns jsonb language sql stable as $$
 select jsonb_build_object('teamId',team,'logoPath',(select league_id::text from public.teams where id=team)||'/'||team::text||'/logo/00000000-0000-4000-8000-000000000001.png','seasonId',season,'divisionId',division,'roster',coalesce((select jsonb_agg(jsonb_build_object('playerId',id,'jerseyNumber',ordinality)) from unnest(players) with ordinality as p(id,ordinality)),'[]'));
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
-- Metadata fixtures exercise storage RLS without keeping any uploaded files.
insert into storage.objects(bucket_id,name,metadata)
 select 'team-registration-media','72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000001/'||kind||'/00000000-0000-4000-8000-000000000001.png',
 '{"mimetype":"image/png","size":70}'::jsonb from unnest(array['logo','jersey']) kind;
insert into storage.objects(bucket_id,name,metadata) values
 ('team-registration-media','72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000002/logo/00000000-0000-4000-8000-000000000001.png','{"mimetype":"image/png","size":70}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='team-registration-media' and name like '72000000-%'),2,'manager sees only own team artwork');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('team-registration-media','72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000002/logo/00000000-0000-4000-8000-000000000002.png','{"mimetype":"image/png","size":70}')$$,'42501',null,'manager cannot upload for another team');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('team-registration-media','invalid-path.png','{"mimetype":"image/png","size":70}')$$,'42501',null,'unscoped upload is rejected');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])-'logoPath',true)$$,'23514','team_logo_required','submission requires a logo');
select is((select count(*)::integer from public.season_teams where league_id='72000000-0000-4000-8000-000000000001'),0,'missing logo leaves no partial registration');
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])-'logoPath',false)$$,'draft may omit logo');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])||'{"logoPath":"72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000002/logo/00000000-0000-4000-8000-000000000001.png"}',true,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'23514','invalid_team_media','another team logo cannot be attached');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])||'{"logoPath":"72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000001/logo/00000000-0000-4000-8000-000000000099.png"}',true,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'23514','invalid_team_media','nonexistent image cannot be attached');
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]),true,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'logo alone is enough to submit');
select is((select jersey_design_path from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),null::text,'jersey design is optional');
select isnt((select logo_path from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),null::text,'logo is saved with registration');
select throws_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[]),false,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'23514','registration_locked','submitted artwork is locked with the roster');
select lives_ok($$select public.withdraw_team_registration('72000000-0000-4000-8000-000000000001',(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'manager can take back registration to edit artwork');
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])||'{"jerseyDesignPath":"72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000001/jersey/00000000-0000-4000-8000-000000000001.png"}',false,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'optional jersey design is saved with draft');
select is((select jersey_design_path from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),'72000000-0000-4000-8000-000000000001/75000000-0000-4000-8000-000000000001/jersey/00000000-0000-4000-8000-000000000001.png','stored jersey path identifies uploaded file');
select lives_ok($$select public.save_team_registration('72000000-0000-4000-8000-000000000001',public.test_registration_payload('75000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',array['76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002']::uuid[])||'{"jerseyDesignPath":null}',false,(select id from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'))$$,'manager can clear optional jersey design');
select is((select jersey_design_path from public.season_teams where team_id='75000000-0000-4000-8000-000000000001'),null::text,'cleared jersey design remains empty');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='team-registration-media' and name like '72000000-%'),3,'league staff can review all team artwork');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='team-registration-media' and name like '72000000-%'),0,'other leagues cannot read artwork');
reset role;
set local role anon;
select is((select count(*)::integer from storage.objects where bucket_id='team-registration-media' and name like '72000000-%'),0,'artwork is private to the registration workspace');
reset role;
select * from finish();
rollback;
