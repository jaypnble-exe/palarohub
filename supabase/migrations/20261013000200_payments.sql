-- Team payments: one append-only ledger per season team (payments, fines, and
-- reversals that cancel a mistaken entry). Balances are derived in the app by
-- lib/domain/payments.ts from these rows; money is integer halalas.

create table public.team_ledger (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null,
  season_team_id uuid not null,
  kind text not null check(kind in('payment','fine','reversal')),
  amount_halalas integer not null check(amount_halalas between 1 and 100000000),
  method text check(method in('cash','bank_transfer','stc_pay','other')),
  fine_reason text check(fine_reason in('technical','no_show','other')),
  reverses_id uuid unique references public.team_ledger(id) on delete restrict,
  note text not null default '' check(char_length(note)<=500),
  -- The day the money changed hands, in Riyadh.
  paid_on date not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check((kind='payment')=(method is not null)),
  check((kind='fine')=(fine_reason is not null)),
  check((kind='reversal')=(reverses_id is not null)),
  foreign key(season_team_id,league_id,season_id) references public.season_teams(id,league_id,season_id) on delete restrict
);
create index team_ledger_team_idx on public.team_ledger(league_id,season_team_id,created_at);
create trigger team_ledger_append_only before update or delete on public.team_ledger for each row execute function private.append_only_history();

alter table public.team_ledger enable row level security;
revoke all on public.team_ledger from anon, authenticated;
grant select on public.team_ledger to authenticated;
grant all on public.team_ledger to service_role;
-- Staff see every team; a team manager sees only their own team's ledger.
create policy team_ledger_read on public.team_ledger for select to authenticated
using(private.staffs_league(league_id) or (not private.is_anonymous() and private.reads_registration(league_id,season_team_id)));

create function public.record_ledger_entry(p_league_id uuid,p_season_team_id uuid,p_kind text,p_amount_halalas integer,p_method text,p_fine_reason text,p_note text,p_paid_on date) returns uuid language plpgsql security definer set search_path='' as $$
 declare registration public.season_teams; entry_id uuid;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in('payment','fine') then raise exception 'invalid_entry' using errcode='23514'; end if;
  if p_paid_on is null or p_paid_on>(now() at time zone 'Asia/Riyadh')::date+1 or p_paid_on<'2020-01-01' then raise exception 'invalid_date' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into registration from public.season_teams where id=p_season_team_id and league_id=p_league_id;
  if registration.id is null then raise exception 'team_not_found' using errcode='23503'; end if;
  if registration.status not in('submitted','approved') then raise exception 'team_not_registered' using errcode='23514'; end if;
  insert into public.team_ledger(league_id,season_id,season_team_id,kind,amount_halalas,method,fine_reason,note,paid_on,recorded_by)
  values(p_league_id,registration.season_id,registration.id,p_kind,p_amount_halalas,
   case when p_kind='payment' then p_method end,case when p_kind='fine' then p_fine_reason end,btrim(coalesce(p_note,'')),p_paid_on,auth.uid())
  returning id into entry_id;
  return entry_id;
 end;
$$;

-- Cancels a mistaken payment or fine by adding a matching reversal.
create function public.reverse_ledger_entry(p_league_id uuid,p_entry_id uuid,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
 declare original public.team_ledger; entry_id uuid;
 begin
  if auth.uid() is null or not private.staffs_league(p_league_id) then raise exception 'staff_required' using errcode='42501'; end if;
  if p_note is null or char_length(btrim(p_note)) not between 1 and 500 then raise exception 'reason_required' using errcode='23514'; end if;
  perform 1 from public.leagues where id=p_league_id for update;
  select * into original from public.team_ledger where id=p_entry_id and league_id=p_league_id;
  if original.id is null then raise exception 'entry_not_found' using errcode='23503'; end if;
  if original.kind='reversal' then raise exception 'cannot_reverse_reversal' using errcode='23514'; end if;
  if exists(select 1 from public.team_ledger where reverses_id=original.id) then raise exception 'already_reversed' using errcode='23514'; end if;
  insert into public.team_ledger(league_id,season_id,season_team_id,kind,amount_halalas,reverses_id,note,paid_on,recorded_by)
  values(p_league_id,original.season_id,original.season_team_id,'reversal',original.amount_halalas,original.id,btrim(p_note),(now() at time zone 'Asia/Riyadh')::date,auth.uid())
  returning id into entry_id;
  return entry_id;
 end;
$$;

-- League rule for teams behind on payments: warn the scorer, or block the game.
create function public.set_payment_policy(p_league_id uuid,p_policy text) returns void language plpgsql security definer set search_path='' as $$
 begin
  if auth.uid() is null or not(private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode='42501'; end if;
  if p_policy is null or p_policy not in('warn','block') then raise exception 'invalid_policy' using errcode='23514'; end if;
  update public.leagues set settings=settings||jsonb_build_object('paymentPolicy',p_policy) where id=p_league_id;
 end;
$$;

create function private.team_payment_totals(target_league uuid,target_team uuid,current_game uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'quotaHalalas',(select fee_halalas from public.season_teams where id=target_team and league_id=target_league),
  'paidHalalas',coalesce((select sum(l.amount_halalas) from public.team_ledger l where l.league_id=target_league and l.season_team_id=target_team and l.kind='payment'
    and not exists(select 1 from public.team_ledger r where r.reverses_id=l.id)),0),
  'finesHalalas',coalesce((select sum(l.amount_halalas) from public.team_ledger l where l.league_id=target_league and l.season_team_id=target_team and l.kind='fine'
    and not exists(select 1 from public.team_ledger r where r.reverses_id=l.id)),0),
  'gamesTotal',(select count(*) from public.games g where g.league_id=target_league and target_team in(g.home_season_team_id,g.away_season_team_id) and g.status<>'cancelled'),
  -- Earlier games already played; the scorer adds the game about to start.
  'gamesPlayed',(select count(*) from public.games g where g.league_id=target_league and target_team in(g.home_season_team_id,g.away_season_team_id)
    and g.status in('in_progress','submitted','approved') and g.id<>current_game));
$$;

-- The scorer setup now carries each team's payment totals and the league rule.
create or replace function public.scorer_game_setup(p_game_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare game public.games; division public.divisions; season public.seasons;
 begin
  select * into game from public.games where id=p_game_id;
  if game.id is null or auth.uid() is null or not(private.scores_game(game.id) or private.staffs_league(game.league_id)) then raise exception 'scorer_required' using errcode='42501'; end if;
  select * into division from public.divisions where id=game.division_id and league_id=game.league_id;
  select * into season from public.seasons where id=game.season_id and league_id=game.league_id;
  return jsonb_build_object(
   'gameId',game.id,'leagueId',game.league_id,
   'leagueName',(select name from public.leagues where id=game.league_id),
   'paymentPolicy',coalesce((select settings->>'paymentPolicy' from public.leagues where id=game.league_id),'warn'),
   'seasonName',season.name,'divisionName',division.name,
   'sport',division.sport,'rules',coalesce(division.rules,season.rules),
   'scheduledAt',game.scheduled_at,'venue',game.venue,'status',game.status,
   'teams',(select jsonb_object_agg(side.name,jsonb_build_object(
     'seasonTeamId',st.id,'name',st.team_name,
     'payment',private.team_payment_totals(game.league_id,st.id,game.id),
     'players',coalesce((select jsonb_agg(jsonb_build_object('playerId',re.player_id,'name',re.player_name,'jersey',re.jersey_number,
        'suspended',coalesce((select c.suspended from public.player_checks c where c.player_id=re.player_id and c.league_id=game.league_id),false)) order by re.jersey_number,re.player_name)
       from public.roster_entries re where re.registration_id=st.id and re.league_id=game.league_id and re.active and re.accepted_at is not null),'[]'::jsonb)))
    from (values('home',game.home_season_team_id),('away',game.away_season_team_id)) as side(name,season_team_id)
    join public.season_teams st on st.id=side.season_team_id and st.league_id=game.league_id));
 end;
$$;

do $$ declare signature text; begin
 revoke all on function private.team_payment_totals(uuid,uuid,uuid) from public,anon,authenticated;
 foreach signature in array array[
  'public.record_ledger_entry(uuid,uuid,text,integer,text,text,text,date)',
  'public.reverse_ledger_entry(uuid,uuid,text)','public.set_payment_policy(uuid,text)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end; $$;
