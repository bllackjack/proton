# Proton — Daily Standup Call Assistant

**Status:** Draft v1 · **Author:** Gurjappan · **Date:** 2026-06-12

---

## 1. The Business Idea

Proton is a personal accountability system that runs your day like a good engineering
manager runs a standup — except it does it over a phone call, twice a day.

**The problem.** To-do apps fail silently. A task list in an app is passive: it waits
for you to open it, and when you don't, nothing happens. The discipline of a daily
standup — *yesterday I did X, today I'm doing Y, my blockers are Z* — works because
someone asks you out loud, at a fixed time, and you have to answer. Most individuals
have no one to ask them.

**The solution.** Proton calls your phone:

- **Morning call (planning):** reads out the tasks queued for today (carried-over
  items plus anything you added), lets you confirm, reprioritize, add, or drop tasks,
  and ends by reading back the committed plan.
- **Evening call (review):** walks through each committed task and asks for status —
  done, partial, blocked, or skipped — and captures blockers in your own words.
- **Standup digest:** from the two calls, Proton generates the classic standup
  summary: *Yesterday I worked on: [X]. Today I'm working on: [Y]. Blockers: [Z].*
  This compounds into a searchable daily log of what you actually did.

**Who it's for.** Initially a single user (the author). The architecture should not
preclude multi-user later, but no feature should be designed for it in v1. Think
"internal tool with product discipline": spec-driven, phased, tested — but no auth
screens, billing, or onboarding flows.

**Why a phone call and not a notification.** Notifications are dismissible with a
thumb-swipe; a ringing phone demands a synchronous, spoken answer. The friction is
the feature.

---

## 2. Core Concepts

| Concept | Definition |
|---|---|
| **Task** | A unit of work with a title, priority, status, and history of status changes. |
| **Day plan** | The set of tasks committed for a given date during the morning call. |
| **Check-in** | The evening review session producing a status per committed task. |
| **Carry-over** | An unfinished task automatically proposed for the next day's plan. |
| **Standup digest** | The generated Yesterday/Today/Blockers summary for a date. |

Task statuses: `queued → committed → (done | partial | blocked | dropped)`.
`partial` and `blocked` tasks become carry-overs.

---

## 3. Features by Phase

### Phase 1 — Task Engine & Standup Generator (no telephony)

Build the brain before the mouth. Everything is exercised through a CLI so the
domain logic is provable before any call infrastructure exists.

- Task CRUD with priorities (P0–P3) and free-text notes.
- Day lifecycle: open a day plan, commit tasks to it, close the day with statuses.
- Automatic carry-over of unfinished tasks into the next day's proposed plan.
- Standup digest generation (Yesterday/Today/Blockers) as plain text and JSON.
- Persistent local store (SQLite) with full status history per task.
- CLI: `proton add`, `proton plan`, `proton commit`, `proton checkin`,
  `proton standup`, `proton log`.

**Exit criteria:** a full day can be simulated end-to-end from the CLI — plan in the
morning, check in at night, and get a correct digest — with the rollover and
carry-over logic covered by tests.

### Phase 2 — Scheduled Voice Calls (structured dialogs)

Give it a mouth and ears, but keep the conversation on rails.

- Outbound calls at configurable morning/evening times. Start on Twilio
  Programmable Voice (fastest to ship, ~$5–6/mo at our volume); plan to
  migrate to self-hosted Asterisk/FreePBX with a budget SIP trunk
  (VoIP.ms or Telnyx, ~$0.005/min) once the call flows are stable.
  The voice adapter must stay provider-agnostic so this migration is a
  contained change, not a rewrite.
- Morning call: text-to-speech reads the proposed plan; keypad (DTMF) or short
  voice responses confirm/skip/reorder tasks.
- Evening call: per-task status prompts ("Press 1 for done, 2 for partial,
  3 for blocked…"); blockers captured as a recorded snippet, transcribed and
  attached to the task.
- Scheduler (cron-driven) with retry policy: no answer → retry twice at 15-minute
  intervals → fall back to an SMS containing the same plan or check-in link.
- Call/session log persisted alongside the day plan.

**Exit criteria:** two unattended calls per day drive the same state transitions
Phase 1 did from the CLI, with the CLI remaining a fallback interface.

### Phase 3 — Conversational Intelligence & Insight

Replace the keypad menus with a real conversation and make the history useful.

- LLM-driven natural dialog on both calls: "push the database migration to
  tomorrow and make the tax filing top priority" just works.
- Smart prioritization: suggested ordering based on age, declared priority,
  repeated carry-overs, and blocker patterns ("this is the third day X is
  blocked — want to drop it or break it down?").
- Ad-hoc reminder calls: during any call, "call me back at 4 about the visa
  form" creates a one-off scheduled call. The LLM gets a `schedule_call`
  tool; reminders live in the same scheduler as the standup calls.
- Weekly review digest: completion rate, chronic carry-overs, blocker themes.
- Searchable history: "what did I do last Tuesday?", "show everything blocked
  on the visa paperwork."

**Exit criteria:** a morning call can be completed hands-free in natural speech,
an ad-hoc reminder requested by voice fires on time, and the weekly digest is
generated from at least one full week of real usage.

### Phase 4 — Coach Mode (open-ended companion)

Beyond structured standups: a conversational coach you can call (or who calls
you) to talk through problems — technical or not — and who pushes you to act.

- Open-ended conversation mode, reachable by calling the Proton number or by
  asking for "a longer chat" during a standup call.
- Persistent conversational memory across sessions: ongoing problems, stated
  goals, what kind of pushing works on you. Stored as periodically summarized
  notes, not raw transcripts, so context stays small and reviewable.
- Grounded in the task history: the coach sees your plans, completion rates,
  and chronic blockers, so "you've carried this for a week — what's the real
  obstacle?" is backed by data, not vibes.
- Problem decomposition as a first-class move: conversations should tend to
  end with concrete tasks pushed into tomorrow's plan, closing the loop back
  into Phases 1–3.
- Persona boundary: a motivational work coach and thinking partner — explicitly
  **not** a therapy or mental-health service. The system prompt should keep it
  oriented toward action, planning, and accountability, and deflect genuine
  mental-health territory toward real humans.

**Exit criteria:** a 15-minute unstructured call about a non-technical problem
ends with at least one task in tomorrow's plan, and a later call demonstrates
memory of that conversation without being reminded.

### Phase 5 (parking lot — explicitly out of scope for now)

Calendar integration, multi-user support, mobile app companion, integrations
with external task sources (GitHub issues, email). Listed only so we don't
accidentally design Phases 1–4 around them — or against them.

---

## 4. Architecture Sketch

```
┌────────────┐     ┌──────────────────────┐     ┌─────────────┐
│ Scheduler  │────▶│  Core (task engine,  │◀───▶│   SQLite    │
│ (cron)     │     │  day lifecycle,      │     └─────────────┘
└────────────┘     │  digest generator)   │
                   └─────────┬────────────┘
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   CLI (Phase 1)     Voice adapter (Ph 2)   LLM dialog (Ph 3)
   Web UI (Next.js)  Twilio → Asterisk       on top of voice
```

Guiding rules:

1. **The core never knows about phones.** Voice, CLI, and LLM layers are adapters
   over the same task-engine API. This is what makes the phases independently
   shippable.
2. **Every interaction is replayable.** Calls, check-ins, and edits append to a
   history; digests are derived, never hand-maintained.
3. **Single-user, local-first.** SQLite on disk; no accounts, no cloud database
   until a phase explicitly demands one.

---

## 5. Open Questions

- Telephony: decided 2026-06-12 — Twilio for the initial Phase 2 build
  (single user, fastest path), migrating to self-hosted Asterisk/FreePBX
  over a metered SIP trunk (VoIP.ms vs. Telnyx) later. At ~300
  call-minutes/month every option is under $10/mo, so the choice optimizes
  for shipping speed now and control later, not cost. Confirm per-minute
  rates and DID availability for the destination country before Phase 2.
- Call times: fixed config first (e.g., 08:30 / 21:00); per-day overrides later?
- Hosting for Asterisk: small VPS vs. home machine (needs to be reachable by
  the SIP trunk and running at call times).
- Language/runtime: decided 2026-06-13 — Node.js/TypeScript. Next.js (App
  Router) hosts a web UI for tasks and conversations (deployable to Vercel
  later); the core stays a plain TypeScript module under `src/core/`.
- Vercel + SQLite tension: serverless has no persistent disk. Local-first
  SQLite stands for now; revisit (Turso/libSQL or hosted Postgres) when the
  UI actually deploys.
