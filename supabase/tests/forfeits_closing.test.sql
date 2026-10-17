begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Uses the seeded demo league. Division B teams: Royals b..01, Titans b..05,
-- Kings b..06, Hawks b..07. Game 07 is the live game (Royals 36, Kings 31).

-- Suspensions waiting to be served by Royals players (game 09 is approved).
insert into public.suspensions(league_id,player_id,game_id,reason,created_by,games,season_team_id) values
('00000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000101','c0000000-0000-4000-8000-000000000009','ejected','30000000-0000-4000-8000-000000000001',1,'b0000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000103','c0000000-0000-4000-8000-000000000009','ejected','30000000-0000-4000-8000-000000000001',1,'b0000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000104','c0000000-0000-4000-8000-000000000009','ejected','30000000-0000-4000-8000-000000000001',2,'b0000000-0000-4000-8000-000000000001');
update public.player_checks set suspended=true,suspension_source='ejection' where player_id in('90000000-0000-4000-8000-000000000101','90000000-0000-4000-8000-000000000104');
update public.player_checks set suspended=true,suspension_source='manual' where player_id='90000000-0000-4000-8000-000000000103';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','forfeit','away','No show')$$,'42501',null,'a team manager cannot record a forfeit');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Forfeit: a no-show loses 20-0.
select lives_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','forfeit','away','Yanbu Kings did not show up')$$,'the commissioner records a no-show');
select is((select home_score||'-'||away_score||' '||outcome||' '||forfeited_by from public.game_results where game_id='c0000000-0000-4000-8000-000000000002'),'20-0 forfeit away','a forfeit is 20-0 for the team that came');
select is((select status from public.games where id='c0000000-0000-4000-8000-000000000002'),'approved','a forfeit is an official result');
select is((select outcome from public.published_games where id='c0000000-0000-4000-8000-000000000002'),'forfeit','public game lists show it was a forfeit');
select throws_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','default','home','Not enough players')$$,'23514','invalid_forfeit','a default needs a game that was being played');
select throws_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','forfeit','away','')$$,'23514','invalid_forfeit','a forfeit needs a reason');

-- Default: the Royals run out of players while ahead, so the score becomes 0-2.
select lives_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000007','default','home','Only one Royals player left',36,31)$$,'a game being played can end by default');
select is((select home_score||'-'||away_score from public.game_results where game_id='c0000000-0000-4000-8000-000000000007'),'0-2','a default is 2-0 when the team that wins was behind');
-- That was the Royals' first game since the suspensions.
reset role;
select is((select count(*)::integer from public.suspension_completions where league_id='00000000-0000-4000-8000-000000000001'),2,'one-game suspensions are served by the next team game');
select is((select suspended from public.player_checks where player_id='90000000-0000-4000-8000-000000000101'),false,'a served ejection is lifted automatically');
select is((select suspended from public.player_checks where player_id='90000000-0000-4000-8000-000000000103'),true,'a suspension set by hand stays until the commissioner lifts it');
select is((select suspended from public.player_checks where player_id='90000000-0000-4000-8000-000000000104'),true,'a two-game suspension is not over after one game');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Both teams missing: both lose, 0-0. Game 05 (Royals v Titans) also serves suspensions.
select lives_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','forfeit','both','Neither team came')$$,'both teams can forfeit');
select is((select home_score||'-'||away_score from public.game_results where game_id='c0000000-0000-4000-8000-000000000005'),'0-0','a double forfeit is 0-0');

-- The second Royals game completes the two-game suspension.
reset role;
select is((select suspended from public.player_checks where player_id='90000000-0000-4000-8000-000000000104'),false,'a two-game suspension ends after the second game');

-- Correcting an approved result: archived first, then the game is open again.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.reopen_result('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Wrong team')$$,'42501','commissioner_required','only the commissioner corrects a result');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.reopen_result('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','')$$,'23514','review_comment_required','a correction needs a reason');
select lives_ok($$select public.reopen_result('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','The Kings were at the wrong gym')$$,'the commissioner reopens a result');
select is((select status from public.games where id='c0000000-0000-4000-8000-000000000002'),'scheduled','a reopened no-show goes back on the schedule');
select is((select count(*)::integer from public.game_results where game_id='c0000000-0000-4000-8000-000000000002'),0,'the replaced result no longer counts');
select is((select result->>'outcome' from public.game_result_history where game_id='c0000000-0000-4000-8000-000000000002'),'forfeit','the replaced result is kept in the history');
select lives_ok($$select public.reopen_result('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000009','Wrong player credited')$$,'a played game can be reopened');
select is((select status from public.games where id='c0000000-0000-4000-8000-000000000009'),'in_progress','a reopened played game goes back to the scorer');
select is((select award is not null from public.game_result_history where game_id='c0000000-0000-4000-8000-000000000009'),false,'a result without a game award archives none');
reset role;
select throws_ok($$delete from public.game_results where game_id='c0000000-0000-4000-8000-000000000008'$$,'23514','history_is_append_only','a result cannot be deleted without being archived');

-- Closing the season: every game needs a result first.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.close_season('00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','[]')$$,'23514','games_without_result','a season with unplayed games cannot close');
reset role;
-- Playoff games cannot be cancelled: the seeded Division C final gets its result instead.
insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by)
select id,league_id,60,55,0,'{}','30000000-0000-4000-8000-000000000001' from public.games
where season_id='50000000-0000-4000-8000-000000000001' and bracket_slot_id is not null and status not in('approved','cancelled');
update public.games set status='approved' where season_id='50000000-0000-4000-8000-000000000001' and bracket_slot_id is not null and status not in('approved','cancelled');
update public.games set status='cancelled' where season_id='50000000-0000-4000-8000-000000000001' and status not in('approved','cancelled');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.close_season('00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','[]')$$,'23514','invalid_standings','final standings are needed for every division');
select lives_ok($$select public.close_season('00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
 (select jsonb_agg(jsonb_build_object('divisionId',id,'divisionName',name,'rows','[]'::jsonb)) from public.divisions where season_id='50000000-0000-4000-8000-000000000001'))$$,'the commissioner closes a finished season');
select throws_ok($$select public.record_forfeit('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','forfeit','home','Late')$$,'23514',null,'nothing changes in a closed season');
select throws_ok($$select public.reopen_result('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000008','Late fix')$$,'23514','season_closed','results of a closed season stay final');
select is((select is_open from public.registration_settings where season_id='50000000-0000-4000-8000-000000000001'),false,'closing stops registration');
reset role;
set local role anon;
select is((select count(*)::integer from public.season_closures where season_id='50000000-0000-4000-8000-000000000001'),1,'final standings are public');
reset role;
select * from finish();
rollback;
