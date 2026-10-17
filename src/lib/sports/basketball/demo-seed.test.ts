// Generates supabase/seed-demo-playoffs.sql by playing every demo game with
// the basketball rules, and checks the committed file is up to date. After a
// change here, rewrite the file with:
// DEMO_SEED_WRITE=1 npx vitest run src/lib/sports/basketball/demo-seed.test.ts
import { expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { basketballRulesSchema, type BasketballRules } from "./rules";
import { reduceBasketballGame, validateBasketballEvent } from "./reducer";
import { summarizeBasketballGame } from "./summary";
import type { BasketballEvent } from "./events";

const L = "00000000-0000-4000-8000-000000000001";
const demoRules = {
  foulOut: 5,
  teamBonusAfter: 4,
  quarters: 4,
  quarterMinutes: 10,
  overtimeMinutes: 5,
  timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 },
};
const rulesC = basketballRulesSchema.parse(demoRules);
const rulesOpen = basketballRulesSchema.parse({
  ...demoRules,
  quarterMinutes: 12,
});

const pad = (n: number, width = 12) => String(n).padStart(width, "0");
const regId = (n: number) => `b0000000-0000-4000-8000-${pad(n)}`;
const playerId = (team: number, n: number) =>
  `90000000-0000-4000-8000-${pad(team * 100 + n)}`;
const gameId = (n: number) => `c0000000-0000-4000-8000-${pad(n)}`;
const managerId = (n: number) => `30000000-0000-4000-8000-${pad(n)}`;
const q = (value: string) => value.replaceAll("'", "''");

const firstNames = [
  "Paolo",
  "Jerome",
  "Kevin",
  "Mark",
  "Ryan",
  "Carlo",
  "Joshua",
  "Vince",
  "Arnel",
  "Dondon",
];
const jerseys = [3, 5, 7, 8, 10, 11, 12, 14, 23, 24];

interface Team {
  number: number;
  name: string;
  division: "Division C" | "Open";
  surname: string;
  manager: number;
  strength: number;
}
const teams: Team[] = [
  {
    number: 8,
    name: "Jeddah Jaguars",
    division: "Division C",
    surname: "Villanueva",
    manager: 7,
    strength: 0.8,
  },
  {
    number: 9,
    name: "Riyadh Rizal Stars",
    division: "Division C",
    surname: "Ramos",
    manager: 8,
    strength: 0.6,
  },
  {
    number: 10,
    name: "Al Khobar Sharks",
    division: "Division C",
    surname: "Torres",
    manager: 9,
    strength: 0.2,
  },
  {
    number: 11,
    name: "Jubail Stingers",
    division: "Division C",
    surname: "Aquino",
    manager: 10,
    strength: 0.9,
  },
  {
    number: 12,
    name: "Tabuk Eagles",
    division: "Division C",
    surname: "Navarro",
    manager: 11,
    strength: 0.7,
  },
  {
    number: 13,
    name: "Hofuf Rangers",
    division: "Division C",
    surname: "Castillo",
    manager: 12,
    strength: 0.4,
  },
  {
    number: 14,
    name: "Riyadh Ballers",
    division: "Open",
    surname: "Manalo",
    manager: 7,
    strength: 0.85,
  },
  {
    number: 15,
    name: "Jeddah Blue Wave",
    division: "Open",
    surname: "Salazar",
    manager: 8,
    strength: 0.7,
  },
  {
    number: 16,
    name: "Dammam Thunder",
    division: "Open",
    surname: "Domingo",
    manager: 9,
    strength: 0.75,
  },
  {
    number: 17,
    name: "Makkah Mavericks",
    division: "Open",
    surname: "Pascual",
    manager: 10,
    strength: 0.5,
  },
  {
    number: 18,
    name: "Abha Highlanders",
    division: "Open",
    surname: "Ocampo",
    manager: 11,
    strength: 0.4,
  },
  {
    number: 19,
    name: "Qassim Bulls",
    division: "Open",
    surname: "Tolentino",
    manager: 12,
    strength: 0.3,
  },
];
const managers = [
  [7, "Arvin Villanueva"],
  [8, "Noel Ramos"],
  [9, "Jun Torres"],
  [10, "Edgar Aquino"],
  [11, "Ramil Navarro"],
  [12, "Rolly Castillo"],
] as const;
const byNumber = new Map(teams.map((team) => [team.number, team]));
const playerName = (team: Team, n: number) =>
  `${firstNames[n - 1]} ${team.surname}`;

/** Deterministic random numbers, so regenerating gives the same seed. */
function random(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Row {
  id: string;
  sequence: number;
  type: string;
  payload: unknown;
  clockMs: number | null;
  period: number;
  at: number;
}

/** Plays one game possession by possession, checking every event with the rules. */
function playGame(
  number: number,
  homeNo: number,
  awayNo: number,
  winnerNo: number,
  rules: BasketballRules,
  attempt: number,
) {
  const rand = random(number * 7919 + attempt * 104729);
  const home = byNumber.get(homeNo)!;
  const away = byNumber.get(awayNo)!;
  const sideTeam = { home, away };
  const events: BasketballEvent[] = [];
  const rows: Row[] = [];
  let period = 0;
  let at = 0;
  const push = (type: string, payload: unknown, clockMs: number | null) => {
    const sequence = events.length + 1;
    const id = `e1${pad(number, 6)}-0000-4000-8000-${pad(sequence)}`;
    const event = {
      id,
      sequence,
      type,
      payload,
      clockMs,
      createdAt: new Date(Date.UTC(2026, 9, 1) + sequence * 1000).toISOString(),
    } as BasketballEvent;
    const state = reduceBasketballGame(events, rules);
    const error = validateBasketballEvent(state, event, rules);
    if (error) throw new Error(`game ${number} #${sequence} ${type}: ${error}`);
    events.push(event);
    rows.push({ id, sequence, type, payload, clockMs, period, at });
  };
  const state = () => reduceBasketballGame(events, rules);

  for (const side of ["home", "away"] as const)
    push(
      "roster",
      {
        team: side,
        players: Array.from({ length: 10 }, (_, i) => ({
          playerId: playerId(sideTeam[side].number, i + 1),
          name: playerName(sideTeam[side], i + 1),
          jersey: jerseys[i],
        })),
      },
      null,
    );
  for (const side of ["home", "away"] as const)
    for (let n = 1; n <= 10; n++)
      push(
        "checkin",
        { team: side, playerId: playerId(sideTeam[side].number, n) },
        null,
      );
  push(
    "officials",
    {
      referees: ["Ramon Aquino", "Dennis Lim"],
      scorer: "Carla Ramos",
      timekeeper: "Ben Torres",
    },
    null,
  );
  for (const side of ["home", "away"] as const)
    push(
      "starters",
      {
        team: side,
        playerIds: [1, 2, 3, 4, 5].map((n) =>
          playerId(sideTeam[side].number, n),
        ),
      },
      null,
    );

  const winnerSide = winnerNo === homeNo ? "home" : "away";
  const edge = (side: "home" | "away") =>
    0.41 +
    (sideTeam[side].strength -
      sideTeam[side === "home" ? "away" : "home"].strength) *
      0.08 +
    (side === winnerSide ? 0.03 : -0.03);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(rand() * items.length)];
  const onCourt = (side: "home" | "away") => state().teams[side].onCourt;

  for (period = 1; period <= rules.quarters; period++) {
    const length = rules.quarterMinutes * 60_000;
    push("period_start", {}, null);
    if (period > 1)
      for (const side of ["home", "away"] as const) {
        // Two changes at the start of each quarter, bench players in and out.
        const team = state().teams[side];
        const bench = Object.keys(team.players).filter(
          (id) => !team.onCourt.includes(id) && !team.players[id].disqualified,
        );
        for (let k = 0; k < 2 && bench.length; k++) {
          const out = team.onCourt[(period + k) % team.onCourt.length];
          const inn = bench.splice(Math.floor(rand() * bench.length), 1)[0];
          if (out && inn)
            push("substitution", { team: side, out, in: inn }, length);
        }
      }
    let clock = length;
    push("clock_start", {}, clock);
    let side: "home" | "away" = period % 2 ? "home" : "away";
    while (true) {
      const used = 14_000 + Math.floor(rand() * 12_000);
      if (clock - used < 4_000) break;
      clock -= used;
      at += used / 1000;
      const score = state().teams;
      const lead =
        score[winnerSide].score -
        score[winnerSide === "home" ? "away" : "home"].score;
      // Late in the last quarter the planned winner closes the game out.
      const closing = period === rules.quarters && clock < 240_000 && lead < 3;
      const shooter = pick(onCourt(side));
      const roll = rand();
      const chance = closing ? (side === winnerSide ? 0.8 : 0.3) : edge(side);
      if (roll < 0.1 && !closing) {
        // Shooting foul: two free throws, then the clock starts again.
        const defense = side === "home" ? "away" : "home";
        const players = state().teams[defense].players;
        const fouler = onCourt(defense).find(
          (id) => (players[id]?.foulCount ?? 0) < 3,
        );
        if (fouler) {
          push(
            "foul",
            { team: defense, playerId: fouler, kind: "personal" },
            clock,
          );
          for (let ft = 0; ft < 2; ft++)
            push(
              "score",
              { team: side, playerId: shooter, points: 1, made: rand() < 0.7 },
              clock,
            );
          push("clock_start", {}, clock);
          side = defense;
          continue;
        }
      }
      const three = rand() < 0.28;
      push(
        "score",
        {
          team: side,
          playerId: shooter,
          points: three ? 3 : 2,
          made: rand() < chance * (three ? 0.8 : 1.15),
        },
        clock,
      );
      side = side === "home" ? "away" : "home";
    }
    at += 60;
    push("period_end", {}, 0);
    at += period === 2 ? 600 : 120;
  }
  const final = state();
  const scores = { home: final.teams.home.score, away: final.teams.away.score };
  if (scores[winnerSide] <= scores[winnerSide === "home" ? "away" : "home"])
    throw new Error(
      `game ${number}: planned winner lost ${scores.home}-${scores.away}`,
    );
  push("game_end", {}, null);
  const done = state();
  const summary = summarizeBasketballGame(done, {
    home: home.name,
    away: away.name,
  });
  if (!summary) throw new Error(`game ${number} did not finish`);
  return { rows, summary, lastSequence: events.length };
}

/** Round-robin pairings by the circle method. */
function roundRobin(numbers: number[]) {
  const list = [...numbers];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < list.length - 1; r++) {
    const games: [number, number][] = [];
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

function gameBlock(
  number: number,
  homeNo: number,
  awayNo: number,
  rules: BasketballRules,
  when: string,
  round: number,
  division: "c" | "o",
  bracket?: { slot: string },
  upsetWinner?: number,
) {
  const home = byNumber.get(homeNo)!;
  const away = byNumber.get(awayNo)!;
  const winnerNo =
    upsetWinner ?? (home.strength >= away.strength ? homeNo : awayNo);
  let played: ReturnType<typeof playGame> | undefined;
  for (let attempt = 0; !played; attempt++) {
    try {
      played = playGame(number, homeNo, awayNo, winnerNo, rules, attempt);
    } catch (error) {
      if (!String(error).includes("planned winner lost") || attempt > 200)
        throw error;
    }
  }
  const { rows, summary, lastSequence } = played;
  const id = gameId(number);
  if (rows[24]?.type !== "starters" || rows[25]?.type !== "period_start")
    throw new Error(`game ${number}: unexpected pre-game events`);
  const no = (id: string) => Number(id.slice(-12)) % 100;
  const code = { home: "h", away: "a" } as const;
  const plays = rows.slice(25).map((row) => {
    const p = row.payload as Record<string, string & number & boolean>;
    const tail = `${row.clockMs ?? ""},${row.period},${Math.round(row.at)}`;
    switch (row.type) {
      case "score":
        return `s,${code[p.team as "home"]},${no(p.playerId)},${p.points},${p.made ? 1 : 0},${tail}`;
      case "foul":
        return `f,${code[p.team as "home"]},${no(p.playerId)},,,${tail}`;
      case "substitution":
        return `u,${code[p.team as "home"]},${no(p.out)},${no(p.in)},,${tail}`;
      case "clock_start":
        return `c,,,,,${tail}`;
      case "period_start":
        return `p,,,,,${tail}`;
      case "period_end":
        return `e,,,,,${tail}`;
      case "game_end":
        return `g,,,,,${tail}`;
      default:
        throw new Error(`game ${number}: cannot encode ${row.type}`);
    }
  });
  const lines: string[] = [];
  for (let i = 0; i < plays.length; i += 12)
    lines.push(plays.slice(i, i + 12).join(";"));
  const playText = lines.join(";\n");
  return `
 -- Game ${number}: ${home.name} ${summary.homeScore}-${summary.awayScore} ${away.name}.
 starts:=${when};
 inserted:=null;
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,scheduled_at,venue,status,created_by${bracket ? ",bracket_slot_id,bracket_game_number" : ""})
 values('${id}',l,s,${division === "c" ? "division_c" : "division_open"},'${regId(homeNo)}','${regId(awayNo)}',${round},starts,'Main court','approved',commissioner${bracket ? `,${bracket.slot},1` : ""})
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  perform pg_temp.demo_events('${id}'::uuid,${number},starts,${homeNo},${awayNo},'
${playText}');
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'${id}','submitted',commissioner,starts+interval '2 hours');
  insert into public.game_reviews(league_id,game_id,action,actor_id,created_at) values(l,'${id}','approved',commissioner,starts+interval '3 hours');
  insert into public.game_results(game_id,league_id,home_score,away_score,last_sequence,summary,approved_by,approved_at)
  values('${id}',l,${summary.homeScore},${summary.awayScore},${lastSequence},'${q(JSON.stringify(summary.summary))}'::jsonb,commissioner,starts+interval '3 hours');
 end if;`;
}

it("keeps the demo playoffs seed valid and up to date", () => {
  const out = join(process.cwd(), "supabase/seed-demo-playoffs.sql");
  const cTeams = teams
    .filter((t) => t.division === "Division C")
    .map((t) => t.number);
  const openTeams = teams
    .filter((t) => t.division === "Open")
    .map((t) => t.number);
  // Riyadh time 7:00 PM and 8:30 PM game slots, counted in whole days from today.
  const slot = (days: number, late: boolean) =>
    `date_trunc('day',now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'${days < 0 ? "-" : "+"}interval '${Math.abs(days)} days'+interval '${late ? "20 hours 30 minutes" : "19 hours"}'`;

  const cBlocks: string[] = [];
  let number = 101;
  roundRobin(cTeams).forEach((games, r) =>
    games.forEach(([h, a], i) =>
      cBlocks.push(
        gameBlock(
          number++,
          h,
          a,
          rulesC,
          slot(-38 + r * 7, i % 2 === 1),
          r + 1,
          "c",
        ),
      ),
    ),
  );
  // Final standings follow team strength: Stingers, Jaguars, Eagles, Rizal Stars.
  const seeds = [...cTeams]
    .sort((a, b) => byNumber.get(b)!.strength - byNumber.get(a)!.strength)
    .slice(0, 4);
  const semis = [
    gameBlock(116, seeds[0], seeds[3], rulesC, slot(-3, false), 1, "c", {
      slot: "semi_one",
    }),
    // The third seed upsets the second.
    gameBlock(
      117,
      seeds[1],
      seeds[2],
      rulesC,
      slot(-3, true),
      1,
      "c",
      { slot: "semi_two" },
      seeds[2],
    ),
  ];

  const openBlocks: string[] = [];
  const openSchedule: string[] = [];
  number = 201;
  roundRobin(openTeams).forEach((games, r) =>
    games.forEach(([h, a], i) => {
      const when = slot([-10, -3, 4, 11, 18][r], i === 2);
      if (r < 2)
        openBlocks.push(
          // One upset in the second round keeps the Open table interesting.
          gameBlock(
            number,
            h,
            a,
            rulesOpen,
            when,
            r + 1,
            "o",
            undefined,
            number === 205
              ? byNumber.get(h)!.strength < byNumber.get(a)!.strength
                ? h
                : a
              : undefined,
          ),
        );
      else
        openSchedule.push(
          `  ('${gameId(number)}','${regId(h)}','${regId(a)}',${r + 1},${when})`,
        );
      number++;
    }),
  );

  const teamRows = teams
    .map(
      (t) =>
        `  (${t.number},'${q(t.name)}','${t.division}','${t.surname}',${t.manager})`,
    )
    .join(",\n");
  const managerRows = managers
    .map(
      ([n, name]) =>
        `  ('${managerId(n)}'::uuid,'${name.toLowerCase().replace(" ", ".")}@sindikato.example.invalid','${name}')`,
    )
    .join(",\n");

  const sql = `-- Demo competition for Sindikato Cup 2026, generated with the basketball rules
-- (every event checked by the scorebook's validator). Division C has finished its
-- round-robin and is in the playoffs: semifinals played, final coming up. The Open
-- division is two rounds into its season. Fixed ids: reseeding adds nothing twice.
-- Fictional accounts are banned from signing in, have no passwords, and use .invalid emails.

-- Expands a game's compact play list into scorebook events. Plays are
-- "type,side,player,points|in,made,clock_ms,period,seconds_after_start" with
-- s=score, f=personal foul, u=substitution (player out, player in),
-- c=clock start, p=period start, e=period end, g=game end; h/a = home/away
-- and players are numbered 1-10 within their team. Session-only helper.
create or replace function pg_temp.demo_events(p_game uuid,p_number integer,p_starts timestamptz,p_home integer,p_away integer,p_plays text)
returns void language plpgsql as $f$
declare
 l uuid := '${L}';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 teams integer[] := array[p_home,p_away];
 sides text[] := array['home','away'];
 seq integer := 0; i integer; n integer; play record; part text[]; side_no integer; kind text; body jsonb;
begin
 for i in 1..2 loop
  seq:=seq+1;
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  values(pg_temp.demo_event_id(p_number,seq),l,p_game,seq,'roster',jsonb_build_object('team',sides[i],'players',
   (select jsonb_agg(jsonb_build_object('playerId',pl.id,'name',pl.display_name,'jersey',re.jersey_number) order by pl.id)
    from public.roster_entries re join public.players pl on pl.id=re.player_id and pl.league_id=re.league_id
    where re.league_id=l and re.registration_id=('b0000000-0000-4000-8000-'||lpad(teams[i]::text,12,'0'))::uuid)),
   null,0,p_starts,commissioner);
 end loop;
 for i in 1..2 loop
  for n in 1..10 loop
   seq:=seq+1;
   insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
   values(pg_temp.demo_event_id(p_number,seq),l,p_game,seq,'checkin',jsonb_build_object('team',sides[i],'playerId',pg_temp.demo_player(teams[i],n)),null,0,p_starts,commissioner);
  end loop;
 end loop;
 seq:=seq+1;
 insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
 values(pg_temp.demo_event_id(p_number,seq),l,p_game,seq,'officials','{"referees":["Ramon Aquino","Dennis Lim"],"scorer":"Carla Ramos","timekeeper":"Ben Torres"}',null,0,p_starts,commissioner);
 for i in 1..2 loop
  seq:=seq+1;
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  values(pg_temp.demo_event_id(p_number,seq),l,p_game,seq,'starters',jsonb_build_object('team',sides[i],'playerIds',
   jsonb_build_array(pg_temp.demo_player(teams[i],1),pg_temp.demo_player(teams[i],2),pg_temp.demo_player(teams[i],3),pg_temp.demo_player(teams[i],4),pg_temp.demo_player(teams[i],5))),
   null,0,p_starts,commissioner);
 end loop;
 for play in select btrim(t,' '||chr(10)||chr(13)||chr(9)) as t from regexp_split_to_table(p_plays,';') with ordinality as x(t,o) order by o loop
  part:=string_to_array(play.t,',');
  side_no:=case part[2] when 'h' then 1 when 'a' then 2 end;
  kind:=case part[1] when 's' then 'score' when 'f' then 'foul' when 'u' then 'substitution' when 'c' then 'clock_start'
   when 'p' then 'period_start' when 'e' then 'period_end' when 'g' then 'game_end' end;
  body:=case part[1]
   when 's' then jsonb_build_object('team',sides[side_no],'playerId',pg_temp.demo_player(teams[side_no],part[3]::integer),'points',part[4]::integer,'made',part[5]='1')
   when 'f' then jsonb_build_object('team',sides[side_no],'playerId',pg_temp.demo_player(teams[side_no],part[3]::integer),'kind','personal')
   when 'u' then jsonb_build_object('team',sides[side_no],'out',pg_temp.demo_player(teams[side_no],part[3]::integer),'in',pg_temp.demo_player(teams[side_no],part[4]::integer))
   else '{}'::jsonb end;
  seq:=seq+1;
  insert into public.game_events(id,league_id,game_id,sequence,type,payload,clock_ms,period,occurred_at,created_by)
  values(pg_temp.demo_event_id(p_number,seq),l,p_game,seq,kind,body,nullif(part[6],'')::integer,part[7]::integer,
   p_starts+make_interval(secs=>part[8]::integer),commissioner);
 end loop;
end;
$f$;
create or replace function pg_temp.demo_event_id(p_number integer,p_sequence integer) returns uuid language sql immutable as $f$
 select ('e1'||lpad(p_number::text,6,'0')||'-0000-4000-8000-'||lpad(p_sequence::text,12,'0'))::uuid;
$f$;
create or replace function pg_temp.demo_player(p_team integer,p_number integer) returns uuid language sql immutable as $f$
 select ('90000000-0000-4000-8000-'||lpad((p_team*100+p_number)::text,12,'0'))::uuid;
$f$;

-- Team managers for the new teams.
do $$
declare
 l uuid := '${L}';
 fixture record;
begin
 for fixture in select * from (values
${managerRows}
 ) as demo(user_id,email,display_name)
 loop
  if exists(select 1 from auth.users where id=fixture.user_id and (email is distinct from fixture.email or raw_user_meta_data->>'demo_fixture' is distinct from 'sindikato_v1')) then
   raise exception 'Demo user identity collision';
  end if;
  insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at,banned_until)
  values(fixture.user_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',fixture.email,now(),'','','','',
   '{"provider":"email","providers":["email"]}',jsonb_build_object('full_name',fixture.display_name,'demo_fixture','sindikato_v1'),now(),now(),'2099-12-31 23:59:59+00')
  on conflict(id) do nothing;
  update auth.users set email_change_token_current=coalesce(email_change_token_current,''),phone_change=coalesce(phone_change,''),
   phone_change_token=coalesce(phone_change_token,''),reauthentication_token=coalesce(reauthentication_token,'') where id=fixture.user_id;
  update public.profiles set display_name=fixture.display_name,is_platform_admin=false where id=fixture.user_id;
  insert into public.league_members(league_id,user_id,role) values(l,fixture.user_id,'team_manager') on conflict do nothing;
 end loop;
end;
$$;

-- Twelve approved teams with ten players each: six in Division C, six in the Open.
do $$
declare
 l uuid := '${L}';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 fixture record; team_uuid uuid; registration_uuid uuid; player_uuid uuid; manager uuid;
 division_uuid uuid; inserted_registration uuid; n integer; rating text;
 first_names text[] := array[${firstNames.map((n) => `'${n}'`).join(",")}];
 jerseys integer[] := array[${jerseys.join(",")}];
begin
 for fixture in select * from (values
${teamRows}
 ) as demo(number,name,division_name,surname,manager_number)
 loop
  team_uuid:=('80000000-0000-4000-8000-'||lpad(fixture.number::text,12,'0'))::uuid;
  registration_uuid:=('b0000000-0000-4000-8000-'||lpad(fixture.number::text,12,'0'))::uuid;
  manager:=('30000000-0000-4000-8000-'||lpad(fixture.manager_number::text,12,'0'))::uuid;
  select id into strict division_uuid from public.divisions where league_id=l and season_id=s and name=fixture.division_name;
  if exists(select 1 from public.teams where id=team_uuid and league_id<>l) then raise exception 'Demo team identity collision'; end if;
  insert into public.teams(id,league_id,name,manager_id) values(team_uuid,l,fixture.name,manager) on conflict(id) do nothing;
  for n in 1..10 loop
   player_uuid:=('90000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid;
   insert into public.players(id,league_id,display_name,created_by) values(player_uuid,l,first_names[n]||' '||fixture.surname,manager) on conflict(id) do nothing;
   insert into public.player_checks(player_id,league_id) values(player_uuid,l) on conflict(player_id) do nothing;
   rating:=case when fixture.division_name='Open' then case when n<=2 then 'A' when n<=5 then 'B' else 'C' end
                else case when n<=4 then 'C' else 'D' end end;
   insert into public.player_ratings(id,league_id,player_id,rating,effective_from,set_by,reason)
   values(('a0000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid,l,player_uuid,rating,'2026-09-01 00:00:00+00',commissioner,'Fictional demo preseason assessment')
   on conflict(id) do nothing;
  end loop;
  inserted_registration:=null;
  insert into public.season_teams(id,league_id,season_id,division_id,team_id,team_name,fee_halalas)
  values(registration_uuid,l,s,division_uuid,team_uuid,fixture.name,180000) on conflict(id) do nothing returning id into inserted_registration;
  if inserted_registration is not null then
   for n in 1..10 loop
    insert into public.roster_entries(league_id,season_id,registration_id,player_id,jersey_number)
    values(l,s,registration_uuid,('90000000-0000-4000-8000-'||lpad((fixture.number*100+n)::text,12,'0'))::uuid,jerseys[n]);
   end loop;
   update public.season_teams set status='submitted',submitted_at=now()-interval '45 days' where id=registration_uuid;
   insert into public.registration_reviews(league_id,registration_id,action,actor_id) values(l,registration_uuid,'submitted',manager);
   update public.roster_entries re set player_name=p.display_name,rating_snapshot=private.current_rating(l,p.id),accepted_at=now()
   from public.players p where re.registration_id=registration_uuid and re.player_id=p.id and p.league_id=l;
   update public.season_teams set status='approved',reviewed_at=now()-interval '44 days',review_comment='' where id=registration_uuid;
   insert into public.registration_reviews(league_id,registration_id,action,comment,actor_id) values(l,registration_uuid,'approved','',commissioner);
  end if;
  -- Every new team has paid its season fee in full.
  insert into public.team_ledger(id,league_id,season_id,season_team_id,kind,amount_halalas,method,note,paid_on,recorded_by)
  values(('f0000000-0000-4000-8000-'||lpad((100+fixture.number)::text,12,'0'))::uuid,l,s,registration_uuid,'payment',180000,
   case when fixture.number%3=0 then 'cash' when fixture.number%3=1 then 'bank_transfer' else 'stc_pay' end,'Full season fee','2026-09-05',commissioner)
  on conflict(id) do nothing;
 end loop;
end;
$$;

-- Division C: the full round-robin and the semifinals, then the final is drawn
-- by the bracket itself. Added only while the division has no playoffs yet.
do $$
declare
 l uuid := '${L}';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 division_c uuid; division_open uuid; starts timestamptz; inserted uuid;
 bracket uuid := 'c1000000-0000-4000-8000-000000000001';
 semi_one uuid := 'c1000000-0000-4000-8000-000000000011';
 semi_two uuid := 'c1000000-0000-4000-8000-000000000012';
 final_slot uuid := 'c1000000-0000-4000-8000-000000000021';
begin
 select id into strict division_c from public.divisions where league_id=l and season_id=s and name='Division C';
 select id into strict division_open from public.divisions where league_id=l and season_id=s and name='Open';
 if exists(select 1 from public.brackets where division_id=division_c) then return; end if;
${cBlocks.join("\n")}

 -- Playoffs: the top four, single elimination (1 v 4, 2 v 3).
 insert into public.brackets(id,league_id,season_id,division_id,preset,seeds,created_by)
 values(bracket,l,s,division_c,'single',array[${seeds.map((n) => `'${regId(n)}'`).join(",")}]::uuid[],commissioner);
 insert into public.bracket_slots(id,league_id,season_id,division_id,bracket_id,round_no,position,home_seed,away_seed,home_source,away_source,home_team_id,away_team_id,home_required,away_required) values
  (semi_one,l,s,division_c,bracket,1,1,1,4,null,null,'${regId(seeds[0])}','${regId(seeds[3])}',1,1),
  (semi_two,l,s,division_c,bracket,1,2,2,3,null,null,'${regId(seeds[1])}','${regId(seeds[2])}',1,1),
  (final_slot,l,s,division_c,bracket,2,1,null,null,semi_one,semi_two,null,null,1,1);
${semis.join("\n")}
 -- Records the semifinal winners and creates the final, which then gets its date.
 perform private.advance_bracket(bracket);
 update public.games set status='scheduled',scheduled_at=${slot(4, false)},venue='Main court'
 where bracket_slot_id=final_slot and league_id=l and status='postponed';
end;
$$;

-- The Open division: two rounds played, three still to come.
do $$
declare
 l uuid := '${L}';
 s uuid := '50000000-0000-4000-8000-000000000001';
 commissioner uuid := '30000000-0000-4000-8000-000000000001';
 division_c uuid; division_open uuid; starts timestamptz; inserted uuid;
begin
 select id into strict division_open from public.divisions where league_id=l and season_id=s and name='Open';
 if exists(select 1 from public.games where id='${gameId(201)}' and league_id<>l) then raise exception 'Demo game identity collision'; end if;
${openBlocks.join("\n")}
 insert into public.games(id,league_id,season_id,division_id,home_season_team_id,away_season_team_id,round,scheduled_at,venue,created_by)
 select fixture.id::uuid,l,s,division_open,fixture.home::uuid,fixture.away::uuid,fixture.round,fixture.starts_at,'Main court',commissioner
 from (values
${openSchedule.join(",\n")}
 ) as fixture(id,home,away,round,starts_at)
 on conflict(id) do nothing;
end;
$$;
`;
  if (process.env.DEMO_SEED_WRITE) writeFileSync(out, sql);
  expect(readFileSync(out, "utf8").replaceAll("\r\n", "\n")).toBe(sql);
}, 120_000);
