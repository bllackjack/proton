<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Proton

Personal accountability system: calls your phone for a morning planning call
and an evening check-in, generates Yesterday/Today/Blockers standup digests.
Single user, spec-driven. The spec is the source of truth: docs/SPEC.md.

## Commands
- `npm test` — vitest, `npm run test:watch` to watch
- `npm run lint` — eslint
- `npm run dev` — Next.js dev server (UI for tasks/conversations)

## Rules
- **The core never knows about phones or browsers.** All domain logic lives
  in `src/core/` as plain TypeScript — no Next.js, HTTP, or telephony imports.
  Web UI, CLI, and voice layers are adapters over it.
- Every interaction appends to history; digests are derived, never stored
  by hand.
- Work is tracked in GitHub issues/milestones at bllackjack/proton. Use the
  `bllackjack` gh account for this repo (`gh auth switch --user bllackjack`),
  never `gurjappan-dropyacht`.
