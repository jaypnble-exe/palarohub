begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uses the seeded demo league: the live game c...07 is in the published season.
set local role anon;
select ok(public.tv_game('c0000000-0000-4000-8000-000000000007') is not null,'anyone can open the TV feed of a game in a published season');
select is(public.tv_game('c0000000-0000-4000-8000-000000000007')#>>'{game,homeName}','Riyadh Royals','the feed names the teams');
select ok(jsonb_array_length(public.tv_game('c0000000-0000-4000-8000-000000000007')->'events')>50,'the feed includes the game actions');
select is(jsonb_array_length(public.tv_game('c0000000-0000-4000-8000-000000000007',90)->'events'),1,'the screen can ask for only newer actions');
select ok(public.tv_game('00000000-0000-4000-8000-00000000dead') is null,'an unknown game shows nothing');
select throws_ok('select * from public.game_events','42501',null,'the public still cannot read game actions directly');
reset role;
-- A cancelled game is not shown on a screen.
update public.games set status='cancelled' where id='c0000000-0000-4000-8000-000000000006';
set local role anon;
select ok(public.tv_game('c0000000-0000-4000-8000-000000000006') is null,'a cancelled game is not shown');
reset role;
select * from finish();
rollback;
