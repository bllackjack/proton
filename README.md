# Proton

Personal accountability system that runs your day like a good manager runs a
standup — over a phone call, twice a day. Morning call plans the day, evening
call reviews it, and every day compounds into a *Yesterday / Today / Blockers*
log.

- **Spec:** [docs/SPEC.md](docs/SPEC.md) — the source of truth
- **Tracking:** [issues](https://github.com/bllackjack/proton/issues) and
  [milestones](https://github.com/bllackjack/proton/milestones) (M0–M4)

## Stack

Node.js / TypeScript. Next.js (App Router) provides the web UI for tasks and
conversations; the domain logic lives in `src/core/` as plain TypeScript with
no framework imports. Neon Postgres (free tier) via Drizzle ORM is the
primary store; tests and offline dev run on embedded PGlite, so no network
or signup is needed locally. Set `DATABASE_URL` in `.env` (see
`.env.example`) to point at Neon; migrations in `drizzle/` apply at startup.

## Develop

```sh
npm install
npm run dev    # web UI at localhost:3000
npm test       # vitest
npm run lint
```
