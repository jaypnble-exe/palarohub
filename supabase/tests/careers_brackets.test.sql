begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- This integration test uses an isolated league and always rolls back.
insert into auth.users(id,email,raw_user_meta_data) values
 ('f1000000-0000-4000-8000-000000000001','competition-commissioner@example.test','{}'),
 ('f1000000-0000-4000-8000-000000000002','competition-outsider@example.test','{}');
insert into public.leagues(id,slug,name) values('f2000000-0000-4000-8000-000000000001','competition-test','Competition Test');
insert into public.league_members(league_id,user_id,role) values('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Test cup',current_date,current_date+60,
 '{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'f1000000-0000-4000-8000-000000000001');
insert into public.divisions(id,league_id,season_id,name,max_rating)
 select ('f4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','Division '||i,'A' from generate_series(1,6) i;
update public.seasons set status='published' where id='f3000000-0000-4000-8000-000000000001';
insert into public.teams(id,league_id,name,manager_id)
 select ('f5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2000000-0000-4000-8000-000000000001','Team '||i,'f1000000-0000-4000-8000-000000000001' from generate_series(1,4) i;
insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,status,fee_halalas)
 select ('f6000000-0000-4000-8000-'||lpad((d*100+t)::text,12,'0'))::uuid,'f2000000-0000-4000-8000-000000000001',
 'f3000000-0000-4000-8000-000000000001',('f4000000-0000-4000-8000-'||lpad(d::text,12,'0'))::uuid,
 ('f5000000-0000-4000-8000-'||lpad(t::text,12,'0'))::uuid,'Team '||t,'approved',0 from generate_series(1,6) d cross join generate_series(1,4) t;

do $$
declare league uuid:='f2000000-0000-4000-8000-000000000001'; div uuid; b uuid; team_ids uuid[];
 slot public.bracket_slots; game public.games; presets text[]:=array['single','best3','best5','twice']; p integer; n integer; expected integer;
begin
 perform set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 begin
  perform public.create_bracket(league,'f4000000-0000-4000-8000-000000000001','single',array['f6000000-0000-4000-8000-000000000101','f6000000-0000-4000-8000-000000000102']::uuid[]);
  raise exception 'outsider created a bracket';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 begin
  perform public.create_bracket(league,'f4000000-0000-4000-8000-000000000001','single',array['f6000000-0000-4000-8000-000000000101','f6000000-0000-4000-8000-000000000201']::uuid[]);
  raise exception 'foreign division seed accepted';
 exception when check_violation then null; end;
 for p in 1..4 loop
  div:=('f4000000-0000-4000-8000-'||lpad(p::text,12,'0'))::uuid;
  select array_agg(id order by team_name) into team_ids from public.season_teams where division_id=div;
  b:=public.create_bracket(league,div,presets[p],team_ids);
  assert (select count(*)=3 from public.bracket_slots where bracket_id=b),'four teams must create three slots';
  assert (select count(*)=2 from public.games g join public.bracket_slots s on s.id=g.bracket_slot_id where s.bracket_id=b),'first round must create two games';
  select * into slot from public.bracket_slots where bracket_id=b and round_no=1 and position=1;
  assert slot.home_team_id=team_ids[1] and slot.away_team_id=team_ids[4],'first seed must play fourth';
  expected:=case presets[p] when 'best3' then 2 when 'best5' then 3 when 'twice' then 2 else 1 end;
  for n in 1..expected loop
   select * into game from public.games where bracket_slot_id=slot.id and status='postponed';
   assert game.id is not null,'next series game must exist';
   -- The lower seed wins: twice-to-beat requires two wins, higher seed only one.
   insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by)
    values(game.id,league,40,50,1,'{}','f1000000-0000-4000-8000-000000000001');
   assert (select winner_id is null from public.bracket_slots where id=slot.id),'unapproved results must not advance';
   update public.games set scheduled_at=now(),status='approved' where id=game.id;
   if n<expected then assert (select winner_id is null from public.bracket_slots where id=slot.id),'series advanced too early'; end if;
  end loop;
  assert (select winner_id=team_ids[4] from public.bracket_slots where id=slot.id),'series winner did not advance';
  assert (select home_team_id=team_ids[4] from public.bracket_slots where bracket_id=b and round_no=2),'winner must reach final';
  assert (select count(*)=expected from public.games where bracket_slot_id=slot.id),'unnecessary extra series game';
  begin
   delete from public.games where bracket_slot_id=slot.id;
   raise exception 'bracket game could be deleted';
  exception when check_violation then null; end;
  -- Finish the other semifinal, then the final, through the same approval trigger.
  select * into slot from public.bracket_slots where bracket_id=b and round_no=1 and position=2;
  for n in 1..slot.home_required loop
   select * into game from public.games where bracket_slot_id=slot.id and status='postponed';
   insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by)
    values(game.id,league,50,40,1,'{}','f1000000-0000-4000-8000-000000000001');
   update public.games set scheduled_at=now(),status='approved' where id=game.id;
  end loop;
  select * into slot from public.bracket_slots where bracket_id=b and round_no=2;
  assert slot.home_team_id is not null and slot.away_team_id is not null,'both finalists must be resolved';
  for n in 1..slot.home_required loop
   select * into game from public.games where bracket_slot_id=slot.id and status='postponed';
   insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by)
    values(game.id,league,50,40,1,'{}','f1000000-0000-4000-8000-000000000001');
   update public.games set scheduled_at=now(),status='approved' where id=game.id;
  end loop;
  assert (select winner_id=slot.home_team_id from public.bracket_slots where id=slot.id),'champion must resolve';
  assert not exists(select 1 from public.games g join public.bracket_slots s on s.id=g.bracket_slot_id where s.bracket_id=b and g.status='postponed'),'finished bracket created another game';
 end loop;
 div:='f4000000-0000-4000-8000-000000000005';
 select array_agg(id order by team_name) into team_ids from public.season_teams where division_id=div;
 b:=public.create_bracket(league,div,'single',team_ids[1:3]);
 assert (select count(*)=1 from public.bracket_slots where bracket_id=b and round_no=1 and winner_id is not null),'top seed bye must advance automatically';
 assert (select count(*)=1 from public.games g join public.bracket_slots s on s.id=g.bracket_slot_id where s.bracket_id=b),'bye must not create a game';
 assert jsonb_array_length(public.career_games(league))=22,'careers must include approved games only';
 assert jsonb_array_length(public.career_games(league,null,'ffffffff-ffff-4fff-8fff-ffffffffffff'))=0,'unknown player leaked game histories';
end;
$$;
set local role anon;
do $$ begin
 assert (select count(*)=5 from public.brackets where league_id='f2000000-0000-4000-8000-000000000001'),'public bracket read failed';
 begin
  perform created_by from public.brackets limit 1;
  raise exception 'public creator ID exposed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bracket_slots(league_id) values('f2000000-0000-4000-8000-000000000001');
  raise exception 'public bracket write allowed';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select pass('career privacy, bracket permissions, seeding, byes, series, champion advancement and game history integrity');
select * from finish();
rollback;
