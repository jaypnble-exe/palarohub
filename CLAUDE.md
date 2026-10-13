# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**Palaro Hub** (palarohub.com) is a multi-tenant league management platform for Filipino community sports leagues in Saudi Arabia. Each commissioner runs their own league (tenant) on the same system.

**Basketball is the first sport. Volleyball comes next**, and other sports may follow. Build everything sport-aware from day one (see "Multi-sport design").

It replaces paper scoresheets, group-chat registration, and manual standings with:
- Season and team registration with automatic eligibility checks (player ratings)
- A digital scoresheet for table officials that works offline
- Live scoreboard on a gym TV, live commissioner dashboard, and public live scores
- Automatic standings, brackets, stats, and permanent season history
- Team payment tracking (full payment or per-game until the quota is reached)

**Primary users are non-technical.** Simplicity beats features. See "UX rules".

## Users and roles

Roles are **per league** (a person can hold different roles in different leagues):

| Role | Can do |
|---|---|
| `platform_admin` | Everything across all leagues (the developer) |
| `commissioner` | Full control of their league: seasons, divisions, rules, ratings, approvals, payments |
| `league_staff` | Help the commissioner: approvals, schedules, payments; no league settings |
| `team_manager` | Register and manage their own team and roster |
| `scorer` | Score a specific game only, unlocked by a game PIN/QR (no account required) |
| public | View league pages, schedules, standings, live scores, TV display |

## Tech stack

- **Next.js (App Router) + TypeScript** (strict mode)
- **Tailwind CSS + shadcn/ui**
- **react-hook-form + zod** for forms; zod schemas shared between client and server
- **Supabase**: Postgres, Auth, Realtime, Storage
- **Supabase Auth**: email + password (forgot password emails a reset link), Google when enabled. No email sign-in links. **No phone/SMS login** for now.
- **PWA**: Serwist (service worker) + Dexie (IndexedDB) for offline scoring
- **@react-pdf/renderer** for PDF scoresheets
- **next-intl** for UI text (English only; no other languages planned)
- **Sentry** (free tier) for error tracking
- **Vercel** for hosting, deployed from GitHub

Stay within free tiers until leagues are paying. Do not add paid services without asking.

## Commands

```bash
pnpm dev                 # start Next.js dev server
pnpm build               # production build
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # unit tests (Vitest)
pnpm test:e2e            # end-to-end tests (Playwright)

supabase start           # local Supabase (Docker)
supabase migration new <name>
supabase db reset        # reapply all migrations + seed locally
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Run `pnpm lint && pnpm typecheck && pnpm test` before considering a task done.

## Project structure

```
src/
  app/
    (public)/[league]/          # public league pages: schedule, standings, stats, live
    (admin)/admin/[league]/     # commissioner & staff dashboard
    (team)/team/[league]/       # team manager: registration, roster
    score/[gameId]/             # scorer screen (PIN-unlocked, offline-capable)
    tv/[gameId]/                # TV scoreboard display (public, read-only)
    api/                        # route handlers (webhooks, PDF generation)
  components/
    ui/                         # shadcn/ui components
    scorer/  tv/  admin/  public/
  lib/
    supabase/                   # clients (server, browser, service), generated types
    domain/                     # sport-neutral pure logic (no I/O): standings, brackets, eligibility, payments
    sports/
      types.ts                  # SportModule interface
      basketball/               # basketball events, reducer, rules, stats, scorer/TV/PDF config
      volleyball/               # later
    offline/                    # Dexie db, sync queue
    validation/                 # zod schemas
  messages/                     # next-intl: en.json (English only)
supabase/
  migrations/                   # SQL migrations (source of truth for schema + RLS)
  seed.sql                      # demo league, teams, players for local dev
```

## Core domain rules

### Multi-tenancy (critical)
- Every tenant-owned table has a non-null `league_id`.
- **Row Level Security is enabled on every table.** Access is enforced in the database, not only in app code.
- RLS policies check membership via a `league_members (league_id, user_id, role)` table, using helper SQL functions (e.g. `is_league_member(league_id)`, `has_league_role(league_id, role)`).
- Never use the Supabase service-role key in client code. Use it only in server-side code that truly needs to bypass RLS, and filter by `league_id` explicitly.
- Player ID / iqama data is visible only to commissioners and staff of that league (Saudi PDPL). Store as little ID data as possible.

### Multi-sport design
Only basketball is built in Phase 1, but nothing outside the sport modules may assume basketball.

- `sport` (`basketball` | `volleyball` | …) is set on each **league** (default) and can be overridden per **season or division**. Games inherit it.
- **Shared, sport-neutral core**: leagues, members, seasons, divisions, teams, players, ratings, registration, eligibility, payments, schedules, standings tables, brackets, announcements, history.
- **Sport modules** in `src/lib/sports/<sport>/`, each implementing one common interface:
  - event types and their zod schemas (stored in `game_events.type` + `game_events.payload` jsonb)
  - `reduceGame(events, rules)` → derived game state (score, period/set, alerts)
  - default rules and the settings form for that sport
  - box score / stats definitions
  - standings points and tiebreakers
  - scorer screen, TV display layout and flashes, PDF scoresheet layout
- Rules per sport live in a typed `rules` jsonb on the season/division, validated by that sport's zod schema.
- Never add basketball-specific columns (fouls, quarters, timeouts) to shared tables. They belong in event payloads, rules, or the basketball module.
- UI routes (`/score`, `/tv`) load the right module by the game's sport.

**Volleyball notes (for later; do not build yet):** no game clock; best-of-3 or best-of-5 sets to 25 (deciding set to 15), win by 2; rally scoring; rotations and serving order; libero; substitutions limit per set; timeouts per set; standings may use match points and set/point ratios as tiebreakers.

### History is never overwritten
- Everything is scoped to a **season**. Teams and players persist across seasons; their per-season participation lives in `season_teams` and `roster_entries`.
- Ratings live in `player_ratings` as rows with `effective_from`, `set_by`, `reason`. The current rating is the latest row. Never update a rating in place.
- Final standings are snapshotted when a season closes.

### Player ratings and eligibility
- Ratings are a league-configurable scale (default `A`, `B`, `C`, `D`; `A` is highest).
- Each division sets a **maximum allowed rating**, and optionally composition limits (e.g. max 2 B-rated players) or a points cap.
- Eligibility checks (all in `lib/domain/eligibility.ts`, also enforced in DB where practical):
  - rating allowed in division
  - roster min/max size
  - player not on another team in the same season
  - player not suspended
  - required documents present
- Error messages are plain language, e.g. *"Juan Dela Cruz is rated A and cannot join Division C (max rating: C)."*
- Ratings may be shared across leagues later (opt-in). Design so this is possible, but default to per-league.

### Season registration flow
1. Commissioner creates season, divisions, rules, fees, deadline (step-by-step wizard).
2. Commissioner shares a registration link.
3. Team manager registers team and roster; eligibility is checked live.
4. Team submits; commissioner approves, rejects, or returns with a comment.
5. Rosters lock after the deadline. Later changes are request-and-approve with the same checks.

### Team payments
- Each `season_team` has a **quota** (total fee, e.g. SAR 1,800).
- Teams may pay in full or per game; `team_payments` records each payment (amount, method: cash / bank transfer / STC Pay / other, recorded_by, date).
- Balance = quota + fines − payments. Fines (technicals, no-shows) are added to the same ledger.
- League setting: when a team is behind, either **warn** or **block** them from playing.
- Currency is SAR. Store money as integer halalas (1 SAR = 100 halalas), never floats.

### Games and the event log
- Game actions are stored as an append-only log in `game_events` (score, miss, foul types, substitution, timeout, period start/end, correction).
- Each event has a client-generated UUID, `game_id`, `league_id`, `sequence`, game clock, period, `created_by`, `created_at`. Inserts are idempotent on the UUID (safe for offline retries).
- **Box scores, foul counts, team fouls, bonus, timeouts left, minutes played, and stats are derived from events** by the sport module's pure functions in `lib/sports/<sport>/`. Do not store derived counters as the source of truth (caching/materialized views are fine).
- Corrections are new events that void earlier ones; never delete events.
- Foul rules come from league settings (defaults: foul out at 5, team bonus after 4 team fouls per quarter, standard timeouts per half).
- One scorer device is the official record for a game.

### Digital scorebook (scorer screen, `/score/[gameId]`)
Replaces the paper scoresheet at the scorer's table. Must be faster than writing on paper, or scorers will go back to paper.

**Access**
- The commissioner or staff opens the game and generates a **scorer PIN / QR code** valid only for that game. No account needed.
- The PIN unlocks only that game's scorebook, nothing else in the league.

**Pre-game**
- Both rosters load automatically from approved `roster_entries`, with jersey numbers.
- Mark players present; late arrivals can be marked present during the game.
- Allow a jersey number change for the game only, logged as an event.
- Select the starting five per team.
- Record referees and table officials (names).
- Payment check: show if a team is behind on payments (warn or block, per league setting).
- Optional captain and referee confirmation before tip-off.

**During the game (one or two taps per action)**
- **Score**: tap player → +1 / +2 / +3; missed shots optional (league setting for shooting stats).
- **Foul**: tap player → personal, technical, unsportsmanlike, disqualifying. Coach/bench technicals are attributed to the team, not a player.
- **Substitution**: tap player out → tap player in. The app always knows the five players on court per team; block subs that would leave 4 or 6 on court.
- **Timeout**: tap team; block when none are left.
- **Clock and periods**: start/stop game clock, next quarter, halftime, overtime. Quarter length and number of periods come from league settings.
- **Possession arrow** (if the league uses it).
- **Optional stats** (league setting): rebounds, assists, steals, blocks, turnovers. Off by default to keep scoring fast.

**Automatic alerts**
- Player's 4th foul (warning) and foul-out at the league limit; fouled-out players cannot be subbed back in.
- Ejection on technical/unsportsmanlike/disqualifying limits.
- Team fouls per quarter and bonus/penalty.
- Timeouts remaining.

**Mistakes and corrections**
- Large **Undo** for the last action, plus an editable event list ("play-by-play") to fix older entries.
- Every correction is a new event that voids the earlier one, recorded with who and when. Never delete events.

**Two-device mode (optional)**
- Second device for the clock and substitutions, synced with the main scorer device. The main scorer device remains the official record.

**Ending the game**
- Final buzzer → review screen: final score, box score, fouls, any ejections.
- Optional digital confirmation by referees/captains.
- Scorer submits; the commissioner sees it as "finished, awaiting approval" and can approve or reopen it for correction.
- On approval: standings, stats, and brackets update; suspensions from ejections are created; the official **PDF scoresheet** is generated in the familiar paper layout.

**Scorer screen design**
- Landscape tablet layout first, phone landscape supported.
- Score always visible at the top; both teams' on-court players as big buttons.
- No navigation menus during the game; only game controls.

### Offline scoring
- The scorer screen must work with no connection: rosters are cached when the game is opened, events are written to Dexie first, then synced by a queue.
- Always show sync status: "Saved on this device" / "Synced".
- Warn before closing the page if events are unsynced.

### Realtime: TV, dashboard, public live
- TV display (`/tv/[gameId]`), commissioner live dashboard, and public live scores subscribe to `game_events` via Supabase Realtime and render from derived state.
- TV flashes: 4th foul, foul-out, substitution, made 3-pointer, timeout, bonus. Show ~3–4 seconds, never hide the score.
- TV design: huge numbers, high contrast, readable across a court. Sponsor slot on screen and during timeouts/breaks.

### Brackets
- `stages` (elimination, quarterfinals, …) and `bracket_slots` that reference their sources ("seed 1", "winner of QF1").
- Support single elimination, best-of-N series, and twice-to-beat (per-slot win requirements).
- When a game or series finishes, advance the winner automatically. Seeds come from final elimination standings.
- Commissioners pick a preset format; slots are generated for them.

## UX rules (non-technical users)

- **Phone-first.** Design for a 380px-wide screen before desktop.
- Big tap targets, one primary action per screen, icons always with labels.
- Plain words, no jargon ("Teams waiting for approval", not "Pending registrations").
- Every user-facing string goes through next-intl (`en.json`). No hard-coded UI text. English is the only language; do not add Tagalog or other translations.
- Multi-field setup uses step-by-step wizards with sensible defaults and "copy from last season".
- Confirm before destructive actions; prefer undo.
- Commissioner home is a to-do list (approvals, unpaid teams, missing referees, appeals).
- Share buttons for WhatsApp and Facebook on schedules, results, and registration links.
- Rule of thumb: if a commissioner can't do it in under a minute without help, simplify it.

## Coding conventions

- TypeScript strict; no `any` without a comment explaining why.
- Business logic in `lib/domain/` and `lib/sports/` is pure and unit-tested (fouls, bonus, standings, tiebreakers, eligibility, bracket advancement, payment balance).
- Server Components by default; Client Components only where interactivity is needed.
- Mutations via Server Actions or route handlers, validated with zod on the server.
- All schema changes are SQL migrations in `supabase/migrations/`, including RLS policies. Regenerate types after every migration.
- Times stored in UTC (`timestamptz`); display in `Asia/Riyadh`.
- Do not commit secrets. Env vars live in `.env.local` (see below).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # optional legacy fallback for local/older projects
SUPABASE_SERVICE_ROLE_KEY=        # optional, server-only privileged jobs
NEXT_PUBLIC_SITE_URL=             # https://palarohub.com in production
SENTRY_DSN=
```

Use Supabase Cloud for the app. The publishable key is the primary public API key;
the legacy anon key remains supported for optional local development. Local Docker
commands above are for migration/RLS testing. Apply cloud schema changes through
tracked migrations using `supabase link` and `supabase db push`, never a cloud reset.

## Roadmap

**Phase 1 – MVP (pilot season)**
1. Auth (email + password, Google), leagues, members, roles, RLS
2. Seasons, divisions, rules, rating scale
3. Teams, players, rating history, registration flow with eligibility checks
4. Schedule (round-robin generator) and announcements
5. Digital scorebook (see "Digital scorebook") with offline sync, game approval, PDF scoresheet
6. Automatic standings
7. Team payment tracking (full / per game)

**Phase 2**
- TV scoreboard display and flashes, commissioner live dashboard, public live scores
- Player profiles and career stats, brackets, awards, sponsor slots

**Phase 3**
- Volleyball sport module
- Online payments, livestream overlay (OBS browser source), shared ratings across leagues, inter-league tournaments, platform billing (per team per season or per game)

## Out of scope for now

- Phone/SMS OTP login
- Native mobile apps (PWA only)
- Paid third-party services
