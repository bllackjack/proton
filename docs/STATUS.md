# Status — updated 2026-06-13 (end of session)

Resume point for tomorrow morning. Spec: [SPEC.md](SPEC.md). Tracker:
[issues](https://github.com/bllackjack/proton/issues) /
[milestones](https://github.com/bllackjack/proton/milestones).

## Where we are

- **M0 Scaffolding — done** (#1 closed). Next.js 16 (App Router, TS,
  Tailwind) at repo root, vitest, prettier, eslint, AGENTS.md rules.
- **M1 in progress — issue #2 ~90% done.** Task model + store built and
  tested: Drizzle schema (`src/core/schema.ts`), transition-enforced
  status changes with append-only history (`src/core/tasks.ts`),
  Neon/PGlite dual driver (`src/core/db.ts`), migrations in `drizzle/`.
  11 tests green; lint + build green.

## The one blocking item (user action)

Sign up at **neon.com** (GitHub login), create a project, put the
connection string in `.env` as `DATABASE_URL=…` (template in
`.env.example`). Until then everything runs on embedded PGlite under
`data/` — nothing else is blocked. Once the URL is in, verify migrations
apply against real Neon and tick the last box on #2 to close it.

## Next up

1. Close #2 (needs the Neon URL above).
2. **Issue #3 — day lifecycle**: plan → commit → check-in → close day,
   carry-over proposal. This is the heart of M1.
3. Then #4 (standup digest), #5 (CLI), #12 (edge-case tests). A simple
   tasks page in the web UI can come alongside, which is also when a
   Playwright e2e issue should be filed.

## Decisions log (chronological)

| Date | Decision |
|---|---|
| 06-12 | Spec-driven, 5 phases (M0–M4); core never knows about phones |
| 06-12 | Telephony: Twilio first (fast), migrate to Asterisk/FreePBX + SIP trunk later; adapter stays provider-agnostic |
| 06-12 | Coach mode (Phase 4): work coach grounded in task history, not a therapy service |
| 06-13 | Runtime: Node.js/TS, Next.js UI (Vercel later); user preference |
| 06-13 | DB: Neon Postgres free tier (auto-wake beats Supabase's manual unpause); Drizzle ORM; PGlite for tests/offline dev. Replaced SQLite, resolving the Vercel persistence tension |
| 06-13 | Free-tier-first for all infrastructure |

## Gotchas / working agreements

- **GitHub account:** all gh writes as `bllackjack`, never
  `gurjappan-dropyacht`. The active account is global and the user flips
  it for other work — check `gh api user -q .login` first, switch, and
  switch back after. Git push itself is safe (remote URL pins bllackjack;
  repo-local git identity set).
- Workflow: build an issue's worth, verify (tests/lint), push to `main`
  with `Closes #N` — one push per issue, no PRs (solo project).
- Next.js 16 has breaking changes vs. training data — read
  `node_modules/next/dist/docs/` before writing UI code (per AGENTS.md).
- Prettier ignores `*.md` (keeps SPEC.md tables stable).

## Commands

```sh
npm test          # vitest (PGlite, no network)
npm run dev       # web UI on :3000, local db under data/
npm run lint      # eslint
npx drizzle-kit generate   # after schema changes
```
