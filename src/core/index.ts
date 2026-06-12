/**
 * Proton core: task engine, day lifecycle, digest generation.
 *
 * This module must stay free of any delivery concerns — no Next.js, no
 * telephony, no HTTP. The web UI, CLI, and voice layers are adapters on
 * top of this API (docs/SPEC.md §4).
 */

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TaskStatus =
  | "queued"
  | "committed"
  | "done"
  | "partial"
  | "blocked"
  | "dropped";

/**
 * queued → committed → (done | partial | blocked | dropped).
 * partial/blocked re-enter the queue as carry-overs (docs/SPEC.md §2);
 * done and dropped are terminal.
 */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["committed", "dropped"],
  committed: ["done", "partial", "blocked", "dropped"],
  partial: ["queued", "committed"],
  blocked: ["queued", "committed"],
  done: [],
  dropped: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: TaskStatus,
    public readonly to: TaskStatus,
  ) {
    super(`invalid task status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Statuses that end a task's day; `partial` and `blocked` carry over. */
export function carriesOver(status: TaskStatus): boolean {
  return status === "partial" || status === "blocked";
}
