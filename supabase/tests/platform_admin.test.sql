begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uses the seeded demo league: Rey (…01) is commissioner, Mia (…02) staff, Paolo (…04) a team manager.
-- Ben (…06) becomes the platform admin for this test.
update public.profiles set is_platform_admin=true where id='30000000-0000-4000-8000-000000000006';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.admin_overview()$$,'42501','platform_admin_required','a commissioner cannot see the platform overview');
select throws_ok($$select * from public.admin_leagues()$$,'42501','platform_admin_required','a commissioner cannot list every league');
select throws_ok($$select * from public.admin_find_users('example')$$,'42501','platform_admin_required','a commissioner cannot search users');
select throws_ok($$select public.admin_set_league_paused('00000000-0000-4000-8000-000000000001',true,'x')$$,'42501','platform_admin_required','a commissioner cannot pause their league');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select ok((public.admin_overview()->>'leagues')::integer>=1,'the overview counts leagues');
select is((select commissioners->0->>'email' from public.admin_leagues() where id='00000000-0000-4000-8000-000000000001'),'rey.santos@sindikato.example.invalid','each league lists its commissioner');
select ok((select teams>0 from public.admin_leagues() where id='00000000-0000-4000-8000-000000000001'),'each league counts its teams');
select is((select count(*)::integer from public.admin_league_members('00000000-0000-4000-8000-000000000001') where role='league_staff'),2,'members of a league are listed');
select throws_ok($$select * from public.admin_find_users('ab')$$,'23514','query_too_short','a search needs at least 3 characters');
select is((select memberships->0->>'role' from public.admin_find_users('paolo.cruz')),'team_manager','a user search shows their league roles');

-- Staff: add and remove.
select throws_ok($$select public.admin_add_member('00000000-0000-4000-8000-000000000001','nobody@example.invalid','league_staff')$$,'P0001','user_not_found','only people with an account can be added');
select throws_ok($$select public.admin_add_member('00000000-0000-4000-8000-000000000001','paolo.cruz@sindikato.example.invalid','team_manager')$$,'23514','invalid_role','team managers join through registration');
select lives_ok($$select public.admin_add_member('00000000-0000-4000-8000-000000000001','PAOLO.CRUZ@sindikato.example.invalid','league_staff')$$,'the admin adds staff by email');
select is((select count(*)::integer from public.league_members where league_id='00000000-0000-4000-8000-000000000001' and user_id='30000000-0000-4000-8000-000000000004'),2,'a person can hold two roles');
select lives_ok($$select public.admin_remove_member('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','league_staff')$$,'the admin removes staff');
select throws_ok($$select public.admin_remove_member('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','league_staff')$$,'P0001','member_not_found','removing twice is reported');
select throws_ok($$select public.admin_remove_member('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','commissioner')$$,'23514','last_commissioner','a league always keeps a commissioner');

-- Changing the commissioner.
select lives_ok($$select public.admin_replace_commissioner('00000000-0000-4000-8000-000000000001','mia.delacruz@sindikato.example.invalid')$$,'the admin hands the league to a new commissioner');
select is((select array_agg(user_id::text) from public.league_members where league_id='00000000-0000-4000-8000-000000000001' and role='commissioner'),array['30000000-0000-4000-8000-000000000002'],'the old commissioner loses the role');
select is((select count(*)::integer from public.league_members where league_id='00000000-0000-4000-8000-000000000001' and user_id='30000000-0000-4000-8000-000000000002' and role='league_staff'),1,'their other roles stay');

-- Pausing.
select throws_ok($$select public.admin_set_league_paused('00000000-0000-4000-8000-000000000001',true,'')$$,'23514','reason_required','pausing needs a reason');
select lives_ok($$select public.admin_set_league_paused('00000000-0000-4000-8000-000000000001',true,'Unpaid platform fee')$$,'the admin pauses a league');
reset role;
set local role anon;
select is((select count(*)::integer from public.leagues where id='00000000-0000-4000-8000-000000000001'),0,'a paused league is hidden from the public');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.leagues where id='00000000-0000-4000-8000-000000000001'),1,'members still see their paused league');
-- Checked as the table owner so that row security does not hide the rows first.
reset role;
select throws_ok($$update public.season_teams set status=status where league_id='00000000-0000-4000-8000-000000000001' and team_id in(select id from public.teams where manager_id='30000000-0000-4000-8000-000000000004')$$,'23514','league_paused','team managers cannot change registrations while paused');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$update public.leagues set paused_at=null where id='00000000-0000-4000-8000-000000000001'$$,'42501',null,'a commissioner cannot unpause by hand');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select lives_ok($$select public.admin_set_league_paused('00000000-0000-4000-8000-000000000001',false)$$,'the admin resumes the league');
reset role;
set local role anon;
select is((select count(*)::integer from public.leagues where id='00000000-0000-4000-8000-000000000001'),1,'a resumed league is public again');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select array_agg(action order by created_at, action) from public.admin_league_log('00000000-0000-4000-8000-000000000001')),
  array['commissioner_replaced','league_paused','league_resumed','member_added','member_removed'],'every change is logged');
reset role;
select throws_ok($$delete from public.platform_audit_log$$,'23514','history_is_append_only','the log cannot be erased');
select * from finish();
rollback;
