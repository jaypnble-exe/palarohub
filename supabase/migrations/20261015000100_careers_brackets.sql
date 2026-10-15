-- Public sports history is derived only from approved games in published seasons.
-- Identity documents, ratings, accounts and disciplinary records are never returned.
create function public.career_games(p_league_id uuid, p_season_id uuid default null, p_player_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',g.id,'seasonId',s.id,'seasonName',s.name,'divisionId',d.id,'divisionName',d.name,
  'sport',d.sport,'rules',coalesce(d.rules,s.rules),'playedAt',g.scheduled_at,
  'homeName',h.team_name,'awayName',a.team_name,'homeScore',r.home_score,'awayScore',r.away_score,
  'events',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'sequence',e.sequence,'type',e.type,'payload',e.payload,'clock_ms',e.clock_ms,'occurred_at',e.occurred_at
   ) order by e.sequence),'[]'::jsonb) from public.game_events e
   where e.league_id=p_league_id and e.game_id=g.id and e.sequence<=r.last_sequence
    and e.type not in('officials','team_staff','confirmation','protest'))
 ) order by g.scheduled_at desc,g.id),'[]'::jsonb)
 from public.games g join public.game_results r on r.game_id=g.id and r.league_id=g.league_id
 join public.seasons s on s.id=g.season_id and s.league_id=g.league_id and s.status='published'
 join public.divisions d on d.id=g.division_id and d.league_id=g.league_id
 join public.season_teams h on h.id=g.home_season_team_id and h.league_id=g.league_id
 join public.season_teams a on a.id=g.away_season_team_id and a.league_id=g.league_id
 where g.league_id=p_league_id and g.status='approved' and (p_season_id is null or g.season_id=p_season_id)
 and (p_player_id is null or exists(select 1 from public.game_events e where e.game_id=g.id and e.league_id=p_league_id
   and e.type='roster' and e.sequence<=r.last_sequence
   and e.payload->'players' @> jsonb_build_array(jsonb_build_object('playerId',p_player_id))));
$$;
revoke all on function public.career_games(uuid,uuid,uuid) from public;
grant execute on function public.career_games(uuid,uuid,uuid) to anon,authenticated;

create table public.brackets (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id) on delete restrict,
 season_id uuid not null,
 division_id uuid not null unique,
 preset text not null check(preset in('single','best3','best5','twice')),
 seeds uuid[] not null check(cardinality(seeds) between 2 and 16),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(id,league_id,season_id,division_id),
 foreign key(division_id,league_id,season_id) references public.divisions(id,league_id,season_id) on delete restrict
);
create table public.bracket_slots (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id) on delete restrict,
 season_id uuid not null,
 division_id uuid not null,
 bracket_id uuid not null,
 round_no smallint not null check(round_no between 1 and 4),
 position smallint not null check(position between 1 and 8),
 home_seed smallint,
 away_seed smallint,
 home_source uuid,
 away_source uuid,
 home_team_id uuid,
 away_team_id uuid,
 winner_id uuid,
 home_required smallint not null check(home_required between 1 and 3),
 away_required smallint not null check(away_required between 1 and 3),
 unique(bracket_id,round_no,position),
 unique(id,league_id,season_id,division_id),
 unique(id,bracket_id,league_id),
 foreign key(bracket_id,league_id,season_id,division_id) references public.brackets(id,league_id,season_id,division_id) on delete restrict,
 foreign key(home_source,bracket_id,league_id) references public.bracket_slots(id,bracket_id,league_id) on delete restrict,
 foreign key(away_source,bracket_id,league_id) references public.bracket_slots(id,bracket_id,league_id) on delete restrict,
 foreign key(home_team_id,league_id,season_id,division_id) references public.season_teams(id,league_id,season_id,division_id) on delete restrict,
 foreign key(away_team_id,league_id,season_id,division_id) references public.season_teams(id,league_id,season_id,division_id) on delete restrict,
 foreign key(winner_id,league_id,season_id,division_id) references public.season_teams(id,league_id,season_id,division_id) on delete restrict,
 check(home_team_id is null or away_team_id is null or home_team_id<>away_team_id),
 check(winner_id is null or winner_id=home_team_id or winner_id=away_team_id)
);
alter table public.games add column bracket_slot_id uuid;
alter table public.games add column bracket_game_number smallint check(bracket_game_number between 1 and 200);
alter table public.games add constraint games_bracket_slot_fk foreign key(bracket_slot_id,league_id,season_id,division_id)
 references public.bracket_slots(id,league_id,season_id,division_id) on delete restrict;
alter table public.games add constraint games_bracket_number unique(bracket_slot_id,bracket_game_number);
alter table public.games add constraint games_bracket_fields check((bracket_slot_id is null)=(bracket_game_number is null));
create index games_bracket_slot_idx on public.games(bracket_slot_id) where bracket_slot_id is not null;

alter table public.brackets enable row level security;
alter table public.bracket_slots enable row level security;
revoke all on public.brackets,public.bracket_slots from anon,authenticated;
grant select(id,league_id,season_id,division_id,preset,seeds,created_at) on public.brackets to anon,authenticated;
grant select on public.bracket_slots to anon,authenticated;
grant all on public.brackets,public.bracket_slots to service_role;
create policy brackets_read on public.brackets for select to anon,authenticated using(
 exists(select 1 from public.seasons s where s.id=brackets.season_id and s.league_id=brackets.league_id and s.status='published'));
create policy bracket_slots_read on public.bracket_slots for select to anon,authenticated using(
 exists(select 1 from public.seasons s where s.id=bracket_slots.season_id and s.league_id=bracket_slots.league_id and s.status='published'));
create policy brackets_staff_read on public.brackets for select to authenticated using(private.staffs_league(league_id));
create policy bracket_slots_staff_read on public.bracket_slots for select to authenticated using(private.staffs_league(league_id));

-- Serializing on the bracket prevents duplicate next games when approvals arrive together.
create function private.advance_bracket(p_bracket_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare b public.brackets; slot public.bracket_slots; home uuid; away uuid; winner uuid;
 home_wins integer; away_wins integer; next_number integer;
begin
 select * into b from public.brackets where id=p_bracket_id for update;
 if b.id is null then return; end if;
 for slot in select * from public.bracket_slots where bracket_id=b.id and league_id=b.league_id order by round_no,position loop
  if slot.winner_id is not null then continue; end if;
  home:=slot.home_team_id; away:=slot.away_team_id; winner:=null;
  if slot.home_source is not null then select winner_id into home from public.bracket_slots where id=slot.home_source and league_id=b.league_id; end if;
  if slot.away_source is not null then select winner_id into away from public.bracket_slots where id=slot.away_source and league_id=b.league_id; end if;
  update public.bracket_slots set home_team_id=home,away_team_id=away where id=slot.id;
  if slot.round_no=1 and (home is null or away is null) then winner:=coalesce(home,away);
  elsif home is not null and away is not null then
   select count(*) filter(where (g.home_season_team_id=home and r.home_score>r.away_score) or (g.away_season_team_id=home and r.away_score>r.home_score)),
     count(*) filter(where (g.home_season_team_id=away and r.home_score>r.away_score) or (g.away_season_team_id=away and r.away_score>r.home_score))
    into home_wins,away_wins
    from public.games g join public.game_results r on r.game_id=g.id and r.league_id=g.league_id
    where g.bracket_slot_id=slot.id and g.league_id=b.league_id and g.status='approved';
   if home_wins>=slot.home_required then winner:=home;
   elsif away_wins>=slot.away_required then winner:=away;
   elsif not exists(select 1 from public.games g where g.bracket_slot_id=slot.id and g.status not in('approved','cancelled')) then
    select coalesce(max(g.bracket_game_number),0)+1 into next_number from public.games g where g.bracket_slot_id=slot.id;
    insert into public.games(league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,status,scheduled_at,created_by,bracket_slot_id,bracket_game_number)
    values(b.league_id,b.season_id,b.division_id,home,away,slot.round_no,'postponed',null,b.created_by,slot.id,next_number);
   end if;
  end if;
  if winner is not null then update public.bracket_slots set winner_id=winner where id=slot.id; end if;
 end loop;
end;
$$;

create function public.create_bracket(p_league_id uuid,p_division_id uuid,p_preset text,p_team_ids uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.divisions; b uuid; seed_order integer[]:=array[1,2]; next_order integer[];
 size integer; seed integer; r integer:=1; pos integer; slot_count integer; slot_id uuid; ids jsonb:='{}';
 home_seed integer; away_seed integer; required integer;
begin
 if auth.uid() is null or not (private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then
  raise exception 'commissioner_required' using errcode='42501'; end if;
 perform 1 from public.leagues where id=p_league_id for update;
 select * into d from public.divisions where id=p_division_id and league_id=p_league_id;
 if d.id is null or not exists(select 1 from public.seasons where id=d.season_id and status='published') then
  raise exception 'published_division_required' using errcode='23514'; end if;
 if p_preset is null or p_preset not in('single','best3','best5','twice') or p_team_ids is null or cardinality(p_team_ids) not between 2 and 16
  or (select count(distinct id) from unnest(p_team_ids) id)<>cardinality(p_team_ids)
  or (select count(*) from public.season_teams t where t.id=any(p_team_ids) and t.league_id=p_league_id and t.division_id=d.id and t.status='approved')<>cardinality(p_team_ids) then
  raise exception 'invalid_bracket_seeds' using errcode='23514'; end if;
 if exists(select 1 from public.brackets where division_id=d.id) then raise exception 'bracket_exists' using errcode='23514'; end if;
 if exists(select 1 from public.games where division_id=d.id and league_id=p_league_id and bracket_slot_id is null and status not in('approved','cancelled')) then
  raise exception 'regular_games_pending' using errcode='23514'; end if;
 insert into public.brackets(league_id,season_id,division_id,preset,seeds,created_by)
 values(p_league_id,d.season_id,d.id,p_preset,p_team_ids,auth.uid()) returning id into b;
 while cardinality(seed_order)<cardinality(p_team_ids) loop
  size:=cardinality(seed_order)*2; next_order:='{}';
  foreach seed in array seed_order loop next_order:=next_order||array[seed,size+1-seed]; end loop;
  seed_order:=next_order;
 end loop;
 required:=case p_preset when 'best3' then 2 when 'best5' then 3 else 1 end;
 slot_count:=cardinality(seed_order)/2;
 while slot_count>=1 loop
  for pos in 1..slot_count loop
   slot_id:=gen_random_uuid(); home_seed:=null; away_seed:=null;
   if r=1 then home_seed:=seed_order[(pos-1)*2+1]; away_seed:=seed_order[(pos-1)*2+2]; end if;
   insert into public.bracket_slots(id,league_id,season_id,division_id,bracket_id,round_no,position,home_seed,away_seed,
     home_source,away_source,home_team_id,away_team_id,home_required,away_required)
   values(slot_id,p_league_id,d.season_id,d.id,b,r,pos,home_seed,away_seed,
    (ids->>((r-1)::text||':'||(pos*2-1)::text))::uuid,(ids->>((r-1)::text||':'||(pos*2)::text))::uuid,
    p_team_ids[home_seed],p_team_ids[away_seed],required,case when p_preset='twice' and r=1 then 2 else required end);
   ids:=ids||jsonb_build_object(r||':'||pos,slot_id);
  end loop;
  r:=r+1; slot_count:=slot_count/2;
 end loop;
 perform private.advance_bracket(b);
 return b;
end;
$$;

create function private.bracket_after_approval() returns trigger language plpgsql security definer set search_path='' as $$
declare bracket uuid;
begin
 if new.bracket_slot_id is not null and new.status='approved' and old.status is distinct from new.status then
  select bracket_id into bracket from public.bracket_slots where id=new.bracket_slot_id and league_id=new.league_id;
  perform private.advance_bracket(bracket);
 end if;
 return new;
end;
$$;
create trigger advance_bracket_after_approval after update of status on public.games for each row execute function private.bracket_after_approval();

create function private.guard_bracket_game() returns trigger language plpgsql security definer set search_path='' as $$
declare slot public.bracket_slots;
begin
 if tg_op='DELETE' then
  if old.bracket_slot_id is not null then raise exception 'bracket_game_locked' using errcode='23514'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.bracket_slot_id is distinct from old.bracket_slot_id then raise exception 'bracket_game_locked' using errcode='23514'; end if;
 if new.bracket_slot_id is not null then
  select * into slot from public.bracket_slots where id=new.bracket_slot_id and league_id=new.league_id;
  if slot.id is null or new.status='cancelled' or
    new.home_season_team_id is distinct from slot.home_team_id or new.away_season_team_id is distinct from slot.away_team_id then
   raise exception 'bracket_game_locked' using errcode='23514'; end if;
 end if;
 return new;
end;
$$;
create trigger guard_bracket_game before insert or update or delete on public.games for each row execute function private.guard_bracket_game();
revoke all on function private.advance_bracket(uuid),private.bracket_after_approval(),private.guard_bracket_game() from public,anon,authenticated;
revoke all on function public.create_bracket(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function public.create_bracket(uuid,uuid,text,uuid[]) to authenticated;

create or replace view public.published_games with(security_barrier=true) as
 select g.id,g.league_id,g.season_id,g.division_id,d.name as division_name,g.round,g.scheduled_at,g.venue,g.status,
  g.home_season_team_id,home.team_name as home_team_name,g.away_season_team_id,away.team_name as away_team_name,
  r.home_score,r.away_score,g.bracket_slot_id,g.bracket_game_number
 from public.games g join public.seasons s on s.id=g.season_id and s.league_id=g.league_id
 join public.divisions d on d.id=g.division_id and d.league_id=g.league_id and d.season_id=g.season_id
 join public.season_teams home on home.id=g.home_season_team_id and home.league_id=g.league_id
 join public.season_teams away on away.id=g.away_season_team_id and away.league_id=g.league_id
 left join public.game_results r on r.game_id=g.id and r.league_id=g.league_id and g.status='approved'
 where s.status='published';
