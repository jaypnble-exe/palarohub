begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function public.test_season_payload(season_name text) returns jsonb language sql immutable as $$
select jsonb_build_object('name',season_name,'startDate','2027-01-01','endDate','2027-03-31',
  'sport','basketball','status','draft','ratingScale',jsonb_build_array('A','B','C','D'),
  'rules','{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}'::jsonb,
  'divisions','[{"name":"Division C","sport":"basketball","maxRating":"C","rosterMin":8,"rosterMax":15,"rules":null}]'::jsonb);
$$;

insert into auth.users(id,email,raw_user_meta_data) values
('40000000-0000-4000-8000-000000000001','season-commissioner@example.test','{}'),
('40000000-0000-4000-8000-000000000002','season-staff@example.test','{}'),
('40000000-0000-4000-8000-000000000003','season-outsider@example.test','{}'),
('40000000-0000-4000-8000-000000000004','season-other@example.test','{}'),
('40000000-0000-4000-8000-000000000005','season-admin@example.test','{}');
update public.profiles set is_platform_admin=true where id='40000000-0000-4000-8000-000000000005';
insert into public.leagues(id,slug,name) values
('41000000-0000-4000-8000-000000000001','season-test-one','Season One'),
('41000000-0000-4000-8000-000000000002','season-test-two','Season Two');
insert into public.league_members(league_id,user_id,role) values
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','commissioner'),
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','league_staff'),
('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,sport,rules,rating_scale,created_by) values
('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Own draft','2027-01-01','2027-03-31','basketball',public.test_season_payload('x')->'rules',array['A','B','C','D'],'40000000-0000-4000-8000-000000000001'),
('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','Other draft','2027-01-01','2027-03-31','basketball',public.test_season_payload('x')->'rules',array['A','B','C','D'],'40000000-0000-4000-8000-000000000004'),
('42000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001','Published','2026-01-01','2026-03-31','basketball',public.test_season_payload('x')->'rules',array['A','B','C','D'],'40000000-0000-4000-8000-000000000001');
insert into public.divisions(id,league_id,season_id,name,sport,max_rating) values
('43000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Division C','basketball','C'),
('43000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','Division C','basketball','C'),
('43000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000003','Division C','basketball','C');
update public.seasons set status='published' where id='42000000-0000-4000-8000-000000000003';

select is((select count(*)::integer from pg_class where oid in ('public.seasons'::regclass,'public.divisions'::regclass,'public.league_rating_scales'::regclass) and relrowsecurity),3,'RLS enabled on all season setup tables');
select is((select labels from public.league_rating_scales where league_id='41000000-0000-4000-8000-000000000001'),array['A','B','C','D'],'new leagues receive the default rating scale');
select is(private.valid_rating_scale(array['A','A']),false,'duplicate rating labels are rejected');
select is(private.valid_rating_scale(array['a','B']),false,'labels must be normalized in the database');
select is(private.valid_sport_rules('basketball',public.test_season_payload('x')->'rules'),true,'sport rules accept the defaults');
select is(private.valid_sport_rules('basketball','{}'),false,'empty rules cannot bypass database validation');
select is(private.valid_sport_rules('basketball',jsonb_set(public.test_season_payload('x')->'rules','{timeouts,firstHalf}','20')),false,'timeout bounds are enforced');
select is(private.valid_sport_rules('volleyball',public.test_season_payload('x')->'rules'),false,'unsupported sports cannot use basketball rules');

set local role anon;
select is((select count(*)::integer from public.seasons where league_id::text like '41000000-%'),1,'public reads published seasons only');
select is((select count(*)::integer from public.divisions where league_id::text like '41000000-%'),1,'public cannot read draft divisions');
select is((select count(*)::integer from public.league_rating_scales where league_id::text like '41000000-%'),2,'public can read league rating labels');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',public.test_season_payload('Public write'))$$,'42501',null,'public cannot call the save RPC');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.seasons where league_id::text like '41000000-%' and status='draft'),0,'non-member sees no drafts');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',public.test_season_payload('Outsider'))$$,'42501','commissioner_required','non-member cannot create season data');
with changed as (update public.league_rating_scales set labels=array['ELITE','OPEN'] where league_id='41000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed),0,'outsider cannot change rating labels');
with changed as (update public.divisions set name='Hacked' where league_id='41000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed),0,'outsider cannot alter division data');

select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.seasons where league_id::text like '41000000-%'),2,'staff can read own drafts and public seasons');
select is((select count(*)::integer from public.divisions where league_id::text like '41000000-%'),2,'staff cannot read another league draft divisions');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',public.test_season_payload('Staff write'))$$,'42501','commissioner_required','staff cannot change season settings');
with changed as (update public.seasons set name='Staff edit' where id='42000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed),0,'direct staff edits are also blocked');
with changed as (update public.league_rating_scales set labels=array['ELITE','OPEN'] where league_id='41000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed),0,'staff cannot change rating settings');

select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',public.test_season_payload('Created atomically'))$$,'commissioner creates a season and division atomically');
select is((select count(*)::integer from public.divisions d join public.seasons s on s.id=d.season_id where s.name='Created atomically'),1,'RPC saved the child division');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000002',public.test_season_payload('Wrong tenant'))$$,'42501','commissioner_required','commissioner cannot write another tenant');
with changed as (update public.seasons set name='Wrong tenant' where id='42000000-0000-4000-8000-000000000002' returning *) select is((select count(*)::integer from changed),0,'RLS blocks direct cross-tenant season edits');
select throws_ok($$insert into public.divisions(league_id,season_id,name,max_rating) values('41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000002','Wrong parent','C')$$,'23503',null,'division cannot reference another tenant season');
select throws_ok($$update public.divisions set league_id='41000000-0000-4000-8000-000000000002' where id='43000000-0000-4000-8000-000000000001'$$,'23514',null,'tenant identity cannot be moved');
select throws_ok($$update public.divisions set max_rating='UNKNOWN' where id='43000000-0000-4000-8000-000000000001'$$,'23514','invalid_division_rating','maximum rating must belong to season snapshot');
select throws_ok($$update public.divisions set roster_min=20,roster_max=10 where id='43000000-0000-4000-8000-000000000001'$$,'23514',null,'database enforces roster bounds');
select throws_ok($$update public.seasons set end_date='2026-01-01' where id='42000000-0000-4000-8000-000000000001'$$,'23514',null,'database enforces date order');
select throws_ok($$update public.seasons set rules='{}' where id='42000000-0000-4000-8000-000000000001'$$,'23514',null,'database rejects invalid rules');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(public.test_season_payload('Bad atomic'),'{divisions,0,maxRating}','"X"'))$$,'23514',null,'invalid division rejects the complete save');
select is((select count(*)::integer from public.seasons where name='Bad atomic'),0,'failed child validation leaves no orphan season');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(public.test_season_payload('Stale scale'),'{ratingScale}','["X","Y"]'))$$,'23514','rating_scale_changed','stale wizard scale is rejected');
select is((select count(*)::integer from public.seasons where name='Stale scale'),0,'stale scale save rolls back the season');
select lives_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(public.test_season_payload('Edited draft'),'{divisions,0,id}','"43000000-0000-4000-8000-000000000001"'),'42000000-0000-4000-8000-000000000001')$$,'commissioner can edit a draft without replacing division identity');
select is((select name from public.seasons where id='42000000-0000-4000-8000-000000000001'),'Edited draft','draft edits persist');
select throws_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(public.test_season_payload('Stolen division'),'{divisions,0,id}','"43000000-0000-4000-8000-000000000002"'))$$,null,null,'RPC cannot reuse another tenant division ID');
select is((select count(*)::integer from public.seasons where name='Stolen division'),0,'division identity collision rolls back all writes');
select lives_ok($$update public.league_rating_scales set labels=array['ELITE','SOCIAL'] where league_id='41000000-0000-4000-8000-000000000001'$$,'commissioner can configure custom rating labels');
select is((select rating_scale from public.seasons where id='42000000-0000-4000-8000-000000000001'),array['A','B','C','D'],'existing draft keeps its scale after league changes');
select is((select rating_scale from public.seasons where id='42000000-0000-4000-8000-000000000003'),array['A','B','C','D'],'published history keeps its scale');
select lives_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(public.test_season_payload('New custom scale'),'{ratingScale}','["ELITE","SOCIAL"]'),'{divisions,0,maxRating}','"SOCIAL"'))$$,'new seasons support the league custom scale');
select is((select rating_scale from public.seasons where name='New custom scale'),array['ELITE','SOCIAL'],'new season snapshots current league labels');
select throws_ok($$update public.seasons set rating_scale=array['ELITE','SOCIAL'] where id='42000000-0000-4000-8000-000000000001'$$,'23514','season_identity_locked','season snapshot cannot be rewritten');
select throws_ok($$update public.seasons set name='Rewritten history' where id='42000000-0000-4000-8000-000000000003'$$,'23514','published_season_locked','published season is immutable');
select throws_ok($$delete from public.seasons where id='42000000-0000-4000-8000-000000000003'$$,'23514','published_season_locked','published season cannot be deleted');
select throws_ok($$update public.divisions set name='Rewritten' where id='43000000-0000-4000-8000-000000000003'$$,'23514','published_season_locked','published divisions cannot change');
select throws_ok($$delete from public.divisions where id='43000000-0000-4000-8000-000000000003'$$,'23514','published_season_locked','published divisions cannot be deleted');
select lives_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(public.test_season_payload('Published atomically'),'{ratingScale}','["ELITE","SOCIAL"]'),'{divisions,0,maxRating}','"SOCIAL"') || '{"status":"published"}'::jsonb)$$,'wizard can publish with all divisions in one transaction');
select is((select status from public.seasons where name='Published atomically'),'published','published state is saved');

select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select is((select count(*)::integer from public.seasons where id='42000000-0000-4000-8000-000000000002'),1,'platform administrator reads other tenant drafts');
select lives_ok($$select public.save_season_setup('41000000-0000-4000-8000-000000000002',public.test_season_payload('Admin cross-tenant'))$$,'platform administrator can manage another league');

reset role;
select * from finish();
rollback;
