# Palaro Hub

Community sports league management for Filipino leagues in Saudi Arabia.
Read [CLAUDE.md](./CLAUDE.md) for the project's source of truth.

## Local development

Use Node.js 24 LTS and pnpm 11.22.0 (pinned in package.json).

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. On PowerShell systems that block .ps1 launchers,
use pnpm.cmd in place of pnpm.

Copy .env.example to .env.local when configuring Supabase. Never commit
real credentials. The scaffold runs without Supabase credentials.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Current scope

Next.js App Router, strict TypeScript, Tailwind, ESLint, Prettier, Vitest,
Testing Library, and cookie-based English/Tagalog translations are configured.
Supabase clients and form libraries are installed for the next implementation.

Auth, league screens, migrations, RLS, and sport modules are pending approval of
the Phase 1, step 1 plan. shadcn/ui initialization is also pending that phase.
Offline scoring, PDF generation, and error tracking belong to later work.
