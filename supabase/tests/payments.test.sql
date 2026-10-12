begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('b1000000-0000-4000-8000-000000000001','pay-commissioner@example.test','{}'),
('b1000000-0000-4000-8000-000000000002','pay-staff@example.test','{}'),
('b1000000-0000-4000-8000-000000000003','pay-manager-one@example.test','{}'),
('b1000000-0000-4000-8000-000000000004','pay-manager-two@example.test','{}'),
('b1000000-0000-4000-8000-000000000005','pay-other-league@example.test','{}');
insert into public.leagues(id,slug,name,settings) values('b2000000-0000-4000-8000-000000000001','pay-one','Pay One','{"is_demo":true}'),('b2000000-0000-4000-8000-000000000002','pay-two','Pay Two','{}');
insert into public.league_members(league_id,user_id,role) values
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','commissioner'),
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','league_staff'),
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','team_manager'),
('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','team_manager'),
('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000005','commissioner');
insert into public.seasons(id,league_id,name,start_date,end_date,rules,rating_scale,created_by) values
('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Pay cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'b1000000-0000-4000-8000-000000000001'),
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Other cup',current_date,current_date+60,'{"foulOut":5,"teamBonusAfter":4,"quarters":4,"quarterMinutes":10,"overtimeMinutes":5,"timeouts":{"firstHalf":2,"secondHalf":3,"overtime":1}}',array['A','B','C','D'],'b1000000-0000-4000-8000-000000000005');
insert into public.divisions(id,league_id,season_id,name,max_rating) values
('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','Open','A'),
('b4000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','Open','A');
update public.seasons set status='published' where id::text like 'b3000000-%';
insert into public.teams(id,league_id,name,manager_id) values
('b5000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Team One','b1000000-0000-4000-8000-000000000003'),
('b5000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','Team Two','b1000000-0000-4000-8000-000000000004'),
('b5000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','Draft Team','b1000000-0000-4000-8000-000000000004'),
('b5000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000002','Other Team','b1000000-0000-4000-8000-000000000005');
insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,status,fee_halalas) values
('b6000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','Team One','approved',180000),
('b6000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000002','Team Two','approved',180000),
('b6000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000003','Draft Team','draft',180000),
('b6000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000004','Other Team','approved',100000);
-- Four games for Team One: one approved, one cancelled, the current one, and a future one.
insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,scheduled_at,venue,created_by) select
 ('b8000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001',
 case when i%2=0 then 'b6000000-0000-4000-8000-000000000001'::uuid else 'b6000000-0000-4000-8000-000000000002'::uuid end,
 case when i%2=0 then 'b6000000-0000-4000-8000-000000000002'::uuid else 'b6000000-0000-4000-8000-000000000001'::uuid end,
 now()+(i||' days')::interval,'Gym','b1000000-0000-4000-8000-000000000001' from generate_series(1,4) i;
update public.games set status='approved' where id='b8000000-0000-4000-8000-000000000001';
update public.games set status='cancelled' where id='b8000000-0000-4000-8000-000000000002';
create function public.test_pay_as(who text) returns void language sql as $$
 select set_config('request.jwt.claims',case who
  when 'commissioner' then '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}'
  when 'staff' then '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}'
  when 'manager1' then '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}'
  when 'manager2' then '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}'
  when 'other' then '{"sub":"b1000000-0000-4000-8000-000000000005","role":"authenticated"}' end,true);
$$;
grant execute on function public.test_pay_as(text) to authenticated;

select is((select relrowsecurity from pg_class where oid='public.team_ledger'::regclass),true,'the ledger has RLS');
set local role authenticated;

select public.test_pay_as('manager1');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',90000,'cash',null,'',current_date)$$,'42501','staff_required','team managers cannot record their own payments');

select public.test_pay_as('staff');
select throws_ok($$insert into public.team_ledger(league_id,season_id,season_team_id,kind,amount_halalas,method,paid_on,recorded_by) values('b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',1,'cash',current_date,auth.uid())$$,'42501',null,'the ledger has no direct writes');
select set_config('test.payment',public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',90000,'cash',null,' Half paid ',current_date)::text,true);
select ok(current_setting('test.payment') ~ '^[0-9a-f-]{36}$','staff record a cash payment');
select set_config('test.second',public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',15000,'stc_pay',null,'',current_date)::text,true);
select lives_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','fine',5000,null,'technical','Coach technical',current_date)$$,'staff add a fine to the same ledger');
select is((select note from public.team_ledger where id=current_setting('test.payment')::uuid),'Half paid','notes are trimmed');
select is((select recorded_by::text from public.team_ledger where id=current_setting('test.payment')::uuid),'b1000000-0000-4000-8000-000000000002','each entry records who entered it');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',90000,null,null,'',current_date)$$,'23514',null,'a payment needs a method');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','fine',5000,null,null,'',current_date)$$,'23514',null,'a fine needs a reason');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',0,'cash',null,'',current_date)$$,'23514',null,'amounts must be positive');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',100,'cheque',null,'',current_date)$$,'23514',null,'only known payment methods');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','payment',100,'cash',null,'',current_date+30)$$,'23514','invalid_date','payments cannot be dated in the future');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','reversal',100,null,null,'',current_date)$$,'23514','invalid_entry','reversals go through their own action');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000003','payment',100,'cash',null,'',current_date)$$,'23514','team_not_registered','draft registrations have no ledger yet');
select throws_ok($$select public.record_ledger_entry('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000004','payment',100,'cash',null,'',current_date)$$,'23503','team_not_found','teams from another league are not found');

select throws_ok($$select public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000001',current_setting('test.second')::uuid,'  ')$$,'23514','reason_required','a reversal needs a reason');
select set_config('test.reversal',public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000001',current_setting('test.second')::uuid,'Entered twice')::text,true);
select is((select amount_halalas from public.team_ledger where id=current_setting('test.reversal')::uuid),15000,'a reversal matches the original amount');
select throws_ok($$select public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000001',current_setting('test.second')::uuid,'Again')$$,'23514','already_reversed','an entry is reversed once');
select throws_ok($$select public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000001',current_setting('test.reversal')::uuid,'Undo undo')$$,'23514','cannot_reverse_reversal','a reversal cannot be reversed');

select is((public.scorer_game_setup('b8000000-0000-4000-8000-000000000003')->'teams'->'away'->'payment'),
 '{"quotaHalalas":180000,"paidHalalas":90000,"finesHalalas":5000,"gamesTotal":3,"gamesPlayed":1}'::jsonb,
 'the scorer gets payment totals without reversed entries, cancelled games, or the current game');
select is((public.scorer_game_setup('b8000000-0000-4000-8000-000000000003')->>'paymentPolicy'),'warn','the league warns by default');
select throws_ok($$select public.set_payment_policy('b2000000-0000-4000-8000-000000000001','block')$$,'42501','commissioner_required','staff cannot change the payment rule');

select public.test_pay_as('commissioner');
select throws_ok($$select public.set_payment_policy('b2000000-0000-4000-8000-000000000001','maybe')$$,'23514','invalid_policy','only warn or block');
select lives_ok($$select public.set_payment_policy('b2000000-0000-4000-8000-000000000001','block')$$,'the commissioner blocks teams that are behind');
select is((select settings from public.leagues where id='b2000000-0000-4000-8000-000000000001'),'{"is_demo":true,"paymentPolicy":"block"}'::jsonb,'other league settings are kept');
select is((public.scorer_game_setup('b8000000-0000-4000-8000-000000000003')->>'paymentPolicy'),'block','the scorer sees the blocking rule');

select public.test_pay_as('manager1');
select is((select count(*)::integer from public.team_ledger),4,'a manager sees their own team''s ledger');
select public.test_pay_as('manager2');
select is((select count(*)::integer from public.team_ledger),0,'a manager cannot see another team''s ledger');
select public.test_pay_as('other');
select is((select count(*)::integer from public.team_ledger),0,'another league cannot see the ledger');
select throws_ok($$select public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000001',current_setting('test.payment')::uuid,'Not mine')$$,'42501','staff_required','another league cannot reverse entries');
select throws_ok($$select public.reverse_ledger_entry('b2000000-0000-4000-8000-000000000002',current_setting('test.payment')::uuid,'Not mine')$$,'23503','entry_not_found','entries are not found through another league');
reset role;

select throws_ok($$update public.team_ledger set amount_halalas=1$$,'23514','history_is_append_only','ledger entries cannot be changed');
select throws_ok($$delete from public.team_ledger$$,'23514','history_is_append_only','ledger entries cannot be deleted');
set local role anon;
select throws_ok('select * from public.team_ledger','42501',null,'the public cannot read payments');
reset role;
select * from finish();
rollback;
