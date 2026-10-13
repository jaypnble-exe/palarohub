-- The basketball rules may now include an optional shot clock. Seasons without
-- one keep working: the app treats a missing shot clock as off.

create or replace function private.valid_basketball_rules(rules jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item record; value jsonb; number numeric; timeout_key text;
begin
  if jsonb_typeof(rules) is distinct from 'object' or (rules - array['foulOut','teamBonusAfter','quarters','quarterMinutes','overtimeMinutes','timeouts','shotClock']) <> '{}'::jsonb then return false; end if;
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
  -- Optional shot clock: on/off, its length, and the shorter reset.
  if rules ? 'shotClock' then
    value := rules -> 'shotClock';
    if jsonb_typeof(value) is distinct from 'object' or (value - array['enabled','seconds','resetSeconds']) <> '{}'::jsonb
      or jsonb_typeof(value -> 'enabled') is distinct from 'boolean'
      or jsonb_typeof(value -> 'seconds') is distinct from 'number'
      or jsonb_typeof(value -> 'resetSeconds') is distinct from 'number' then return false; end if;
    if (value ->> 'seconds')::numeric <> trunc((value ->> 'seconds')::numeric)
      or (value ->> 'resetSeconds')::numeric <> trunc((value ->> 'resetSeconds')::numeric)
      or (value ->> 'seconds')::numeric not between 10 and 35
      or (value ->> 'resetSeconds')::numeric not between 1 and 35
      or (value ->> 'resetSeconds')::numeric > (value ->> 'seconds')::numeric then return false; end if;
  end if;
  return true;
end;
$$;
