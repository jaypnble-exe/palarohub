begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001', 'rls-admin@example.test', '{}'),
('10000000-0000-4000-8000-000000000002', 'rls-commissioner@example.test', '{}'),
('10000000-0000-4000-8000-000000000003', 'rls-staff@example.test', '{}'),
('10000000-0000-4000-8000-000000000004', 'rls-manager@example.test', '{}'),
('10000000-0000-4000-8000-000000000005', 'rls-outsider@example.test', '{"is_platform_admin":true}'),
('10000000-0000-4000-8000-000000000006', 'rls-other@example.test', '{}');
update public.profiles set is_platform_admin = true where id = '10000000-0000-4000-8000-000000000001';
insert into public.leagues (id, slug, name) values
('20000000-0000-4000-8000-000000000001', 'rls-one', 'League One'),
('20000000-0000-4000-8000-000000000002', 'rls-two', 'League Two');
insert into public.league_members (league_id, user_id, role) values
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'commissioner'),
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'league_staff'),
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'team_manager'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'commissioner');

select is((select count(*)::integer from pg_class where oid in ('public.profiles'::regclass, 'public.leagues'::regclass, 'public.league_members'::regclass) and relrowsecurity), 3, 'RLS enabled on every application table');
select is((select count(*)::integer from public.profiles where id::text like '10000000-%'), 6, 'signup trigger created all profiles');
select is((select is_platform_admin from public.profiles where id = '10000000-0000-4000-8000-000000000005'), false, 'user metadata cannot promote a platform admin');
select throws_ok($$insert into public.leagues (name, slug) values ('Reserved', 'admin')$$, '23514', null, 'database reserves app route slugs');
select throws_ok($$insert into public.leagues (name, slug, sport) values ('Unsupported', 'unsupported', 'volleyball')$$, '23514', null, 'only implemented sports are accepted');

set local role anon;
select is((select count(*)::integer from public.leagues where slug in ('rls-one', 'rls-two')), 2, 'public can read both leagues');
select throws_ok('select * from public.league_members', '42501', null, 'public cannot read memberships');
select throws_ok('select * from public.profiles', '42501', null, 'public cannot read profiles');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*)::integer from public.league_members), 0, 'non-member sees no memberships');
select is((select count(*)::integer from public.profiles), 1, 'non-member sees only own profile');
select throws_ok($$insert into public.league_members (league_id, user_id, role) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'commissioner')$$, '42501', null, 'non-member cannot add themself');
with changed as (update public.league_members set role = 'league_staff' where league_id = '20000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed), 0, 'non-member cannot change another league memberships');
with removed as (delete from public.league_members where league_id = '20000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from removed), 0, 'non-member cannot delete another league memberships');
select throws_ok($$update public.profiles set is_platform_admin = true where id = '10000000-0000-4000-8000-000000000005'$$, '42501', null, 'self-promotion blocked by column privileges');
select lives_ok($$update public.profiles set display_name = 'Updated' where id = '10000000-0000-4000-8000-000000000005'$$, 'user can edit own display name');
with changed as (update public.profiles set display_name = 'Hacked' where id = '10000000-0000-4000-8000-000000000002' returning *) select is((select count(*)::integer from changed), 0, 'user cannot edit another profile');
select throws_ok($$insert into public.leagues (name, slug) values ('Unauthorized', 'unauthorized')$$, '42501', null, 'non-admin cannot create a league directly');
select throws_ok($$select public.create_league_with_commissioner('Unauthorized', 'unauthorized', 'basketball', 'rls-outsider@example.test')$$, '42501', 'platform_admin_required', 'non-admin cannot invoke creation RPC');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.league_members), 3, 'commissioner reads only own league members');
select is((select count(*)::integer from public.profiles), 3, 'shared-league profiles are visible without RLS recursion');
with changed as (update public.leagues set name = 'Updated One' where id = '20000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed), 1, 'commissioner updates own league');
with changed as (update public.leagues set name = 'Hacked' where id = '20000000-0000-4000-8000-000000000002' returning *) select is((select count(*)::integer from changed), 0, 'commissioner cannot update other league');
select lives_ok($$insert into public.league_members (league_id, user_id, role) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'team_manager')$$, 'commissioner adds a member to own league');
select throws_ok($$update public.league_members set league_id = '20000000-0000-4000-8000-000000000002' where league_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000005'$$, '42501', null, 'WITH CHECK prevents moving memberships into another tenant');
with removed as (delete from public.league_members where league_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000005' returning *) select is((select count(*)::integer from removed), 1, 'commissioner removes own league member');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::integer from public.league_members), 3, 'staff reads own league members');
with changed as (update public.leagues set name = 'Staff edit' where id = '20000000-0000-4000-8000-000000000001' returning *) select is((select count(*)::integer from changed), 0, 'staff cannot change league settings');
select throws_ok($$insert into public.league_members (league_id, user_id, role) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'team_manager')$$, '42501', null, 'staff cannot manage memberships');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.league_members where league_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')), 4, 'platform admin reads members across both test leagues');
select lives_ok($$select public.create_league_with_commissioner('Created', 'rls-created', 'basketball', 'rls-outsider@example.test')$$, 'platform admin creates league atomically');
select is((select count(*)::integer from public.league_members m join public.leagues l on l.id = m.league_id where l.slug = 'rls-created' and m.user_id = '10000000-0000-4000-8000-000000000005' and m.role = 'commissioner'), 1, 'creation assigns chosen user as commissioner');
select throws_ok($$select public.create_league_with_commissioner('Missing', 'rls-missing', 'basketball', 'missing@example.test')$$, 'P0001', 'commissioner_not_found', 'unknown commissioner rejected');
select is((select count(*)::integer from public.leagues where slug = 'rls-missing'), 0, 'failed assignment leaves no orphan league');
with changed as (update public.leagues set name = 'Admin edit' where id = '20000000-0000-4000-8000-000000000002' returning *) select is((select count(*)::integer from changed), 1, 'platform admin updates any league');

reset role;
select * from finish();
rollback;
