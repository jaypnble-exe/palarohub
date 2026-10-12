-- Rating labels are ordered highest to lowest. Seasons keep immutable snapshots.
create function private.valid_rating_scale(labels text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(array_ndims(labels) = 1 and cardinality(labels) between 2 and 12
    and not exists (select 1 from unnest(labels) label where label is null or char_length(label) not between 1 and 16 or label <> upper(btrim(label)))
    and (select count(distinct label) from unnest(labels) label) = cardinality(labels), false);
$$;

create function private.valid_basketball_rules(rules jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item record; value jsonb; number numeric; timeout_key text;
begin
  if jsonb_typeof(rules) is distinct from 'object' or (rules - array['foulOut','teamBonusAfter','quarters','quarterMinutes','overtimeMinutes','timeouts']) <> '{}'::jsonb then return false; end if;
  for item in select * from (values ('foulOut',1,10),('teamBonusAfter',0,20),('quarters',1,8),('quarterMinutes',1,30),('overtimeMinutes',1,15)) as bounds(key,minimum,maximum) loop
    value := rules -> item.key;
    if jsonb_typeof(value) is distinct from 'number' then return false; end if;
    number := (value #>> '{}')::numeric;
    if number <> trunc(number) or number < item.minimum or number > item.maximum then return false; end if;
  end loop;
  if jsonb_typeof(rules -> 'timeouts') is distinct from 'object' or ((rules -> 'timeouts') - array['firstHalf','secondHalf','overtime']) <> '{}'::jsonb then return false; end if;
  foreach timeout_key in array array['firstHalf','secondHalf','overtime'] loop
    value := rules -> 'timeouts' -> timeout_key;
    if jsonb_typeof(value) is distinct from 'number' then return false; end if;
    number := (value #>> '{}')::numeric;
    if number <> trunc(number) or number < 0 or number > 10 then return false; end if;
  end loop;
  return true;
end;
$$;

create function private.valid_sport_rules(sport text, rules jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when sport = 'basketball' then private.valid_basketball_rules(rules) else false end;
$$;

create table public.league_rating_scales (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  labels text[] not null default array['A','B','C','D'] check (private.valid_rating_scale(labels)),
  updated_at timestamptz not null default now()
);
insert into public.league_rating_scales (league_id) select id from public.leagues;
create function private.initialize_rating_scale()
returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.league_rating_scales (league_id) values (new.id); return new; end;
$$;
create trigger league_rating_scale_created after insert on public.leagues for each row execute function private.initialize_rating_scale();

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  status text not null default 'draft' check (status in ('draft','published')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  sport text not null default 'basketball' check (sport in ('basketball')),
  rules jsonb not null check (private.valid_sport_rules(sport, rules)),
  rating_scale text[] not null check (private.valid_rating_scale(rating_scale)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, league_id)
);
create index seasons_league_date_idx on public.seasons(league_id, start_date desc);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sport text not null default 'basketball' check (sport in ('basketball')),
  rules jsonb check (rules is null or private.valid_sport_rules(sport, rules)),
  max_rating text not null,
  roster_min smallint not null default 8 check (roster_min between 1 and 50),
  roster_max smallint not null default 15 check (roster_max between roster_min and 50),
  created_at timestamptz not null default now(),
  foreign key (season_id, league_id) references public.seasons(id, league_id) on delete restrict
);
create unique index divisions_season_name_idx on public.divisions(season_id, lower(btrim(name)));
create index divisions_league_season_idx on public.divisions(league_id, season_id);

create function private.guard_season_setup()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    if old.status = 'published' then raise exception 'published_season_locked' using errcode = '23514'; end if;
    if tg_op = 'UPDATE' and (new.id <> old.id or new.league_id <> old.league_id or new.rating_scale <> old.rating_scale or new.created_by <> old.created_by or new.created_at <> old.created_at) then
      raise exception 'season_identity_locked' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' and new.status <> 'draft' then raise exception 'create_draft_first' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and new.status = 'published' and not exists (select 1 from public.divisions where season_id = new.id and league_id = new.league_id) then
    raise exception 'season_requires_divisions' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_season_history before insert or update or delete on public.seasons for each row execute function private.guard_season_setup();

create function private.guard_division_setup()
returns trigger language plpgsql set search_path = '' as $$
declare parent public.seasons;
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.league_id <> old.league_id or new.season_id <> old.season_id or new.created_at <> old.created_at) then
    raise exception 'division_identity_locked' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    select * into parent from public.seasons where id = old.season_id and league_id = old.league_id for update;
  else
    select * into parent from public.seasons where id = new.season_id and league_id = new.league_id for update;
  end if;
  if parent.id is null then raise exception 'division_season_mismatch' using errcode = '23503'; end if;
  if parent.status <> 'draft' then raise exception 'published_season_locked' using errcode = '23514'; end if;
  if tg_op <> 'DELETE' then
    if not (new.max_rating = any(parent.rating_scale)) then raise exception 'invalid_division_rating' using errcode = '23514'; end if;
    if new.sport <> parent.sport and new.rules is null then raise exception 'sport_override_requires_rules' using errcode = '23514'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_division_setup before insert or update or delete on public.divisions for each row execute function private.guard_division_setup();

alter table public.league_rating_scales enable row level security;
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
revoke all on public.league_rating_scales, public.seasons, public.divisions from anon, authenticated;
grant select on public.league_rating_scales, public.seasons, public.divisions to anon, authenticated;
grant update(labels, updated_at) on public.league_rating_scales to authenticated;
grant insert, update, delete on public.seasons, public.divisions to authenticated;
grant all on public.league_rating_scales, public.seasons, public.divisions to service_role;
grant usage on schema private to service_role;

create policy rating_scales_public_read on public.league_rating_scales for select to anon, authenticated using (true);
create policy rating_scales_commissioner_update on public.league_rating_scales for update to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'))
with check ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));

create policy seasons_public_read on public.seasons for select to anon, authenticated using (status = 'published');
create policy seasons_member_read on public.seasons for select to authenticated using ((select private.is_platform_admin()) or private.is_league_member(league_id));
create policy seasons_create on public.seasons for insert to authenticated with check (((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner')) and created_by = (select auth.uid()));
create policy seasons_update on public.seasons for update to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'))
with check ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));
create policy seasons_delete on public.seasons for delete to authenticated using ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));

create policy divisions_public_read on public.divisions for select to anon, authenticated using (exists (select 1 from public.seasons s where s.id = season_id and s.league_id = divisions.league_id and s.status = 'published'));
create policy divisions_member_read on public.divisions for select to authenticated using ((select private.is_platform_admin()) or private.is_league_member(league_id));
create policy divisions_create on public.divisions for insert to authenticated with check ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));
create policy divisions_update on public.divisions for update to authenticated
using ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'))
with check ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));
create policy divisions_delete on public.divisions for delete to authenticated using ((select private.is_platform_admin()) or private.has_league_role(league_id,'commissioner'));

revoke all on function private.valid_rating_scale(text[]), private.valid_basketball_rules(jsonb), private.valid_sport_rules(text,jsonb), private.initialize_rating_scale(), private.guard_season_setup(), private.guard_division_setup() from public, anon, authenticated;
grant execute on function private.valid_rating_scale(text[]), private.valid_basketball_rules(jsonb), private.valid_sport_rules(text,jsonb) to authenticated, service_role;

-- Invoker privileges: RLS applies to every statement; the whole wizard saves atomically.
create function public.save_season_setup(p_league_id uuid, p_setup jsonb, p_season_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_season_id uuid; labels text[]; division jsonb; division_id uuid; saved_ids uuid[] := '{}'; affected integer;
begin
  if not (private.is_platform_admin() or private.has_league_role(p_league_id,'commissioner')) then raise exception 'commissioner_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_setup -> 'divisions') is distinct from 'array' then raise exception 'invalid_divisions' using errcode = '23514'; end if;
  if jsonb_array_length(p_setup -> 'divisions') not between 1 and 12 then raise exception 'invalid_divisions' using errcode = '23514'; end if;
  if p_setup ->> 'status' is null or p_setup ->> 'status' not in ('draft','published') then raise exception 'invalid_status' using errcode = '23514'; end if;
  if p_season_id is null then
    select s.labels into labels from public.league_rating_scales s where league_id = p_league_id for share;
    if labels is null then raise exception 'rating_scale_missing' using errcode = '23514'; end if;
    insert into public.seasons(league_id,name,start_date,end_date,sport,rules,rating_scale,created_by)
    values(p_league_id,p_setup->>'name',(p_setup->>'startDate')::date,(p_setup->>'endDate')::date,p_setup->>'sport',p_setup->'rules',labels,auth.uid()) returning id into saved_season_id;
  else
    select s.id, s.rating_scale into saved_season_id, labels from public.seasons s where id = p_season_id and league_id = p_league_id and status = 'draft' for update;
    if saved_season_id is null then raise exception 'season_not_editable' using errcode = '23514'; end if;
    update public.seasons set name=p_setup->>'name',start_date=(p_setup->>'startDate')::date,end_date=(p_setup->>'endDate')::date,sport=p_setup->>'sport',rules=p_setup->'rules' where id=saved_season_id and league_id=p_league_id;
  end if;
  if labels <> array(select jsonb_array_elements_text(p_setup->'ratingScale')) then raise exception 'rating_scale_changed' using errcode = '23514'; end if;
  for division in select * from jsonb_array_elements(p_setup->'divisions') loop
    division_id := coalesce((division->>'id')::uuid, gen_random_uuid());
    if division_id = any(saved_ids) then raise exception 'duplicate_division' using errcode = '23514'; end if;
    insert into public.divisions(id,league_id,season_id,name,sport,rules,max_rating,roster_min,roster_max)
    values(division_id,p_league_id,saved_season_id,division->>'name',division->>'sport',nullif(division->'rules','null'::jsonb),division->>'maxRating',(division->>'rosterMin')::smallint,(division->>'rosterMax')::smallint)
    on conflict(id) do update set name=excluded.name,sport=excluded.sport,rules=excluded.rules,max_rating=excluded.max_rating,roster_min=excluded.roster_min,roster_max=excluded.roster_max
    where public.divisions.league_id=p_league_id and public.divisions.season_id=saved_season_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'division_identity_locked' using errcode = '23514'; end if;
    saved_ids := array_append(saved_ids, division_id);
  end loop;
  delete from public.divisions d where d.league_id=p_league_id and d.season_id=saved_season_id and not(d.id=any(saved_ids));
  if p_setup->>'status'='published' then update public.seasons set status='published' where id=saved_season_id and league_id=p_league_id; end if;
  return saved_season_id;
end;
$$;
revoke all on function public.save_season_setup(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_season_setup(uuid,jsonb,uuid) to authenticated;
