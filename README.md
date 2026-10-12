# Palaro Hub

Community sports league management for Filipino leagues in Saudi Arabia.
Read [CLAUDE.md](./CLAUDE.md) for the project's source of truth.

## Development with Supabase Cloud

Use Node.js 24 LTS and pnpm 11.22.0. Docker is optional for local RLS testing.
Copy `.env.example` to `.env.local` and set your cloud URL,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
The app's auth and league creation work without a service-role key.

```sh
pnpm install
pnpm dev
```

Use an account with access to your project to apply the tracked migration:

```sh
pnpm db:cloud login --agent no --output-format text
pnpm db:cloud projects list
pnpm db:cloud link --project-ref ttmbymzlmfjrfgiyxdiy
pnpm db:cloud db push --dry-run
pnpm db:cloud db push --yes
pnpm db:cloud db query --linked --file supabase/seed.sql
pnpm db:types:cloud
```

The dry run shows the pending migrations before applying them. Do not reset a
cloud database. Sindikato was seeded in this cloud project for trying the
commissioner and public screens. The seed command is safe to repeat.

The seed keeps the original demo league UUID and your real commissioner access,
renames it to **Sindikato** (`sindikato`), and adds six fictional members: one
commissioner, two league staff, and three team managers. These have reserved
`.invalid` email addresses, no passwords, and are banned from signing in.
Use your real demo account to explore the sample data. The dashboard shows the
member names and roles from the database and labels the league as a demo.
It also creates **Sindikato Cup 2026** (published) and **Sindikato Cup 2027**
(draft), each with Open, Division B, and Division C. The Open division uses
12-minute quarters; the other divisions inherit 10-minute quarters. Each permits
8–15 players. Repeating the seed preserves existing season edits and published
history. Step 3 also adds four teams and 32 fictional players. Riyadh Royals is
approved, Jeddah Aces awaits review, Dammam Warriors was returned for jersey-number
confirmation, and Khobar Falcons is a draft with one unrated player. Registration
starts open for 30 days with a SAR 1,800 fee and **no required documents**. Repeating
the seed preserves registration decisions, deadlines, accepted rosters, and rating
history. The fee is a registration snapshot; payment tracking comes later.
The old `/demo-liga`, `/admin/demo-liga`, and `/team/demo-liga` links redirect to
the corresponding Sindikato pages.

The minimal `config/cloud/supabase/config.toml` declares only development Auth
URLs. Review and apply it with:

```sh
supabase config diff --workdir config/cloud --project-ref ttmbymzlmfjrfgiyxdiy
supabase config push --workdir config/cloud --project-ref ttmbymzlmfjrfgiyxdiy
```

Other cloud Auth, database, and storage settings are left unchanged. Change the
site origin and allowlist appropriately before a production deployment.

In Supabase Cloud **Authentication → URL Configuration**, set the Site URL to
`http://localhost:3000` during development and allow
`http://localhost:3000/auth/callback**` so the callback's `next` query is accepted.
Use your production app origin when deploying. Enable Google under Auth providers
and register `https://ttmbymzlmfjrfgiyxdiy.supabase.co/auth/v1/callback` in your
Google OAuth web client. Email links arrive in your real inbox. Supabase's default
email sender has testing restrictions; configure email delivery for your pilot.

After signing in once, grant your own platform-admin access using trusted SQL in
the cloud project's SQL Editor (replace the email):

```sql
begin;
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where lower(email) = lower('your-email@example.com'));
insert into public.league_members (league_id, user_id, role)
select l.id, u.id, 'commissioner'
from public.leagues l cross join auth.users u
where l.slug = 'sindikato' and lower(u.email) = lower('your-email@example.com')
on conflict (league_id, user_id, role) do nothing;
commit;
```

Then open `/admin` to create your first league and assign its commissioner.
`SUPABASE_SERVICE_ROLE_KEY` is optional and server-only for future privileged
jobs. Local bootstrap and verification scripts refuse cloud URLs.

## Optional local database development

Use Node.js 24 LTS, pnpm 11.22.0 (pinned in package.json), Docker Desktop with
the Linux engine running, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(verified CLI: 2.119.0).

```sh
pnpm install
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm db:env
pnpm dev
```

Open http://localhost:3000. On PowerShell systems that block .ps1 launchers,
use pnpm.cmd in place of pnpm.

The local services use ports **55321–55324**, keeping the standard Supabase ports
free for other projects: API 55321, database 55322, Studio 55323, email inbox 55324.
The foundation start script excludes services that this phase does not use.
Run `supabase start` for the full stack later.

`db:env` writes local credentials to ignored `.env.local` without printing them.
It refuses to overwrite an existing file. `.env.example` lists every application
variable from CLAUDE.md. Never commit real credentials. The service-role key is
server-only; application league creation uses the signed-in client's authorized
database RPC rather than this key.

### Local sign-in and Sindikato

1. Open http://localhost:3000/login and send a link to your email address.
2. Open the local test inbox at http://127.0.0.1:55324 and follow the link **in the
   same browser** that requested it (the sign-in flow uses PKCE cookies).
3. Once signed in, bootstrap your local account:

   ```sh
   pnpm db:bootstrap your-email@example.com
   ```

4. Refresh `/leagues`. You can now open `/admin/sindikato`, `/sindikato`, and
   `/admin` to create a league and choose its commissioner's existing email.

Bootstrap works only against a loopback Supabase URL. It grants platform admin
and Sindikato commissioner access to the named, already signed-in account.
The seed creates the demo league and fictional, non-login member profiles. No
platform-admin account or login credentials are seeded. A database reset removes
local accounts, so sign in and bootstrap your real local account again.

### Google sign-in

The Google auth flow and callback are implemented. To enable it locally, create
a free Google OAuth web client and authorize
`http://127.0.0.1:55321/auth/v1/callback` as its redirect URI. Set
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the shell used to start Supabase, then
set `[auth.external.google].enabled = true` in `supabase/config.toml` and restart
the local stack. These provider credentials are not Next.js environment variables
and must never be committed.

For hosted Supabase, enable Google in the Auth dashboard, register that project's
callback with Google, set the Auth site URL to your app origin, and allow
`<app-origin>/auth/callback` (including its `next` query). Configure the app's
variables from `.env.example`. Bootstrap production admin access explicitly
through trusted SQL; the local bootstrap script refuses hosted URLs.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm db:test
pnpm build
pnpm format:check
```

## Security and verification

`supabase/migrations/` is the schema and RLS source of truth. Membership checks
run through stable security-definer helpers in the non-exposed `private` schema,
with an empty search path and fully qualified table names. Profile updates grant
only display-name/avatar columns, preventing self-promotion to platform admin.
The creation RPC authorizes platform admins before looking up an email, then
creates the league and commissioner membership in one transaction.

`pnpm db:test` runs the transactional pgTAP suites in
`supabase/tests/`. The tenancy suite uses six identities and two leagues, checking
public reads, non-member isolation, shared-league profile reads, commissioner and
staff permissions, cross-tenant membership moves, self-promotion attempts, and
atomic platform-admin league creation. Fixtures roll back after the tests.
The season suite checks public/draft visibility, cross-tenant isolation,
commissioner-only writes, rating snapshots, database rules and roster validation,
atomic wizard saves, and immutable published seasons and divisions.

`pnpm test` covers rule defaults and invalid values, reserved slugs, safe auth
redirects, language-cookie validation, translation parity, and email form behavior.
It also covers custom rating labels, rating limits, season validation, and the
four-step wizard's copy, validation, and publication flows.

Verified in this workspace: local database reset and seed, 151 pgTAP checks, 88 Vitest
checks, lint, strict typecheck, and production build. With the app running,
`pnpm db:verify-auth` verifies a real local email link, the HTTP callback and session
cookies, My leagues, signed-out redirects, denied non-member league access, and
Sindikato's commissioner/public pages. It creates and removes a temporary local
test user. Google requires your OAuth credentials and has not been tested against
a real Google account here. Browser visual QA was unavailable; HTTP and component
checks were used.

The tenancy and season migrations and Sindikato seed are also applied to the linked cloud
project. All three tenancy tables have RLS enabled, and the 34 pgTAP checks were
run against that cloud schema inside a rolled-back transaction. The public
Sindikato page was verified over HTTP using the cloud backend. Local sign-in
verification remains a separate local-only script; it does not send real emails.
The 53 season pgTAP checks passed against cloud in a rolled-back transaction.
An anonymous cloud API and HTTP check verified that the published Sindikato Cup
2026 and three divisions are visible, while Sindikato Cup 2027 stays private.

## Current scope and next step

Phase 1, step 1: Google/email-link auth, server/browser/session-refresh clients,
protected admin/team routes, profiles, leagues, memberships, RLS, seed, generated
database types, shadcn-compatible UI components, league creation, league placeholders,
and English UI text via next-intl.

Only the basketball module interface and rules schema are present. Event reduction,
statistics, standings calculations, scoring UI, TV, and PDFs are deliberately
unimplemented; stubs throw rather than return invented results.

Phase 1, step 2 adds `/admin/[league]/seasons`, a four-step setup wizard with
copy-from-last-published-season, per-division rating and roster limits, sport-aware
rules and division overrides, and `/admin/[league]/ratings` for ordered custom
labels. Commissioners and platform admins manage these settings; staff can view
them. Each season snapshots its rating scale. Publishing makes the season and
divisions public and permanently locks this setup to preserve history. The public
league page lists published seasons; drafts remain private to league members.

Phase 1, step 3 adds persistent teams and players, append-only player ratings,
and a three-step team registration wizard. Live checks cover division rating caps,
roster size, duplicate players/jerseys, another team in the same season, suspensions,
and document verification. Staff approve, reject, or return submissions with a
comment; approval rechecks eligibility and snapshots player names and ratings.
After approval, changes require a request and another eligibility check; prior
accepted entries remain in history. Deadline checks run in the database.

Open `/admin/sindikato` for approval counts, teams, players, and seasons. Open a
published season's **Registration settings** to set its fee/deadline and copy its
share link. `/admin/sindikato/registrations` contains the demo review queue.
Commissioners can open a demo registration's **Open manager workspace** button
to explore its roster flow. Actual managers use `/team/sindikato`; the public
registration link lets signed-in users enroll only as team managers. Unrated
players can be saved in drafts; only the commissioner can append their ratings.

All nine new tables have RLS. Managers see their own registrations and roster
history; staff see their league's queue. Database mutations verify roles and
tenant references, serialize changes per league, and commit atomically. Private
player checks stay staff-only; eligibility returns only the needed status flags.
No ID/iqama numbers or document images are collected. Public pages use a narrow
approved-team projection without fees or private comments.

The registration migration and demo seed are applied to Supabase Cloud, types
were regenerated from cloud, and all 64 registration pgTAP checks passed there
in a rolled-back transaction. Anonymous cloud API/HTTP checks confirm approved
team visibility and private player/roster/review protection. Your existing real
admin and commissioner memberships were preserved.
Signed-in HTTP checks also passed for nine admin and manager screens against an
isolated local app using a temporary test account, removed afterward. The test
app left the running cloud app and `.env.local` unchanged. Browser visual QA
remains unverified.

Next: **Phase 1, step 4 — round-robin schedule generation and announcements**.
