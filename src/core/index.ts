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

/** Statuses that end a task's day; `partial` and `blocked` carry over. */
export function carriesOver(status: TaskStatus): boolean {
  return status === "partial" || status === "blocked";
}
