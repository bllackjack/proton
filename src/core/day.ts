import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import {
  dayPlanItems,
  dayPlans,
  tasks,
  type DayPlan,
  type DayPlanItem,
  type Task,
} from "./schema";
import { setStatus } from "./tasks";

/** The outcomes a committed task can be checked in with (docs/SPEC.md §2). */
export type CheckInOutcome = "done" | "partial" | "blocked" | "dropped";

export interface DayItem extends DayPlanItem {
  task: Task;
}

export interface DayPlanWithItems extends DayPlan {
  items: DayItem[];
}

/** Loads a plan's items joined to their tasks, ordered like listTasks. */
async function loadItems(db: Db, dayPlanId: number): Promise<DayItem[]> {
  const items = await db.query.dayPlanItems.findMany({
    where: eq(dayPlanItems.dayPlanId, dayPlanId),
  });
  if (items.length === 0) return [];
  const taskRows = await db.query.tasks.findMany({
    where: inArray(
      tasks.id,
      items.map((i) => i.taskId),
    ),
  });
  const byId = new Map(taskRows.map((t) => [t.id, t]));
  return items
    .map((i) => ({ ...i, task: byId.get(i.taskId)! }))
    .sort((a, b) =>
      a.task.priority === b.task.priority
        ? a.task.createdAt.getTime() - b.task.createdAt.getTime()
        : a.task.priority.localeCompare(b.task.priority),
    );
}

export async function getDay(
  db: Db,
  date: string,
): Promise<DayPlanWithItems | undefined> {
  const plan = await db.query.dayPlans.findFirst({
    where: eq(dayPlans.date, date),
  });
  if (!plan) return undefined;
  return { ...plan, items: await loadItems(db, plan.id) };
}

async function requirePlan(
  db: Db,
  date: string,
  status: DayPlan["status"],
): Promise<DayPlan> {
  const plan = await db.query.dayPlans.findFirst({
    where: eq(dayPlans.date, date),
  });
  if (!plan) throw new Error(`no day plan for ${date}`);
  if (plan.status !== status) {
    throw new Error(`day ${date} is ${plan.status}, expected ${status}`);
  }
  return plan;
}

/**
 * Opens the planning session for a date. Idempotent: returns the existing
 * plan untouched if one is already open. A fresh plan is seeded with the
 * whole queue — carried-over items plus anything added since (docs/SPEC.md
 * §1) — flagging which entries arrived unfinished from an earlier day.
 */
export async function openDay(db: Db, date: string): Promise<DayPlanWithItems> {
  const existing = await getDay(db, date);
  if (existing) return existing;

  const queued = await db.query.tasks.findMany({
    where: eq(tasks.status, "queued"),
  });

  await db.transaction(async (tx) => {
    const [plan] = await tx.insert(dayPlans).values({ date }).returning();
    if (queued.length === 0) return;

    const ids = queued.map((t) => t.id);
    const priorUnfinished = await tx.query.dayPlanItems.findMany({
      where: and(
        inArray(dayPlanItems.taskId, ids),
        inArray(dayPlanItems.outcome, ["partial", "blocked"]),
      ),
    });
    const carried = new Set(priorUnfinished.map((i) => i.taskId));

    await tx.insert(dayPlanItems).values(
      queued.map((t) => ({
        dayPlanId: plan.id,
        taskId: t.id,
        carriedOver: carried.has(t.id),
      })),
    );
  });

  return (await getDay(db, date))!;
}

/** Adds a queued task to a plan still in planning. */
export async function addToDay(
  db: Db,
  date: string,
  taskId: number,
): Promise<DayPlanWithItems> {
  const plan = await requirePlan(db, date, "planning");
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) throw new Error(`task ${taskId} not found`);
  if (task.status !== "queued") {
    throw new Error(`task ${taskId} is ${task.status}, not queued`);
  }
  const existing = await db.query.dayPlanItems.findFirst({
    where: and(
      eq(dayPlanItems.dayPlanId, plan.id),
      eq(dayPlanItems.taskId, taskId),
    ),
  });
  if (!existing) {
    await db.insert(dayPlanItems).values({ dayPlanId: plan.id, taskId });
  }
  return (await getDay(db, date))!;
}

/** Drops a task from a plan still in planning. The task stays queued. */
export async function removeFromDay(
  db: Db,
  date: string,
  taskId: number,
): Promise<DayPlanWithItems> {
  const plan = await requirePlan(db, date, "planning");
  await db
    .delete(dayPlanItems)
    .where(
      and(eq(dayPlanItems.dayPlanId, plan.id), eq(dayPlanItems.taskId, taskId)),
    );
  return (await getDay(db, date))!;
}

/**
 * Locks the plan and commits its tasks — the end of the morning call.
 * Each item's task moves queued → committed.
 */
export async function commitDay(
  db: Db,
  date: string,
): Promise<DayPlanWithItems> {
  const plan = await requirePlan(db, date, "planning");
  const items = await db.query.dayPlanItems.findMany({
    where: eq(dayPlanItems.dayPlanId, plan.id),
  });
  for (const item of items) {
    await setStatus(db, item.taskId, "committed");
  }
  await db
    .update(dayPlans)
    .set({ status: "committed", committedAt: new Date() })
    .where(eq(dayPlans.id, plan.id));
  return (await getDay(db, date))!;
}

/**
 * Records the evening outcome for one committed task and mirrors it onto the
 * day item (so a closed day keeps its own record even after the task moves
 * on). A blocker note flows into both the task history and the item.
 */
export async function checkIn(
  db: Db,
  date: string,
  taskId: number,
  outcome: CheckInOutcome,
  note?: string,
): Promise<DayPlanWithItems> {
  const plan = await requirePlan(db, date, "committed");
  const item = await db.query.dayPlanItems.findFirst({
    where: and(
      eq(dayPlanItems.dayPlanId, plan.id),
      eq(dayPlanItems.taskId, taskId),
    ),
  });
  if (!item) throw new Error(`task ${taskId} is not in the ${date} plan`);
  await setStatus(db, taskId, outcome, note);
  await db
    .update(dayPlanItems)
    .set({ outcome, note })
    .where(eq(dayPlanItems.id, item.id));
  return (await getDay(db, date))!;
}

/**
 * Closes the day after every task is checked in, then re-queues the
 * unfinished ones (partial/blocked) so the next openDay proposes them as
 * carry-overs (docs/SPEC.md §2). Throws if any task is still uncommitted.
 */
export async function closeDay(
  db: Db,
  date: string,
): Promise<DayPlanWithItems> {
  const plan = await requirePlan(db, date, "committed");
  const items = await db.query.dayPlanItems.findMany({
    where: eq(dayPlanItems.dayPlanId, plan.id),
  });
  const pending = items.filter((i) => i.outcome == null);
  if (pending.length > 0) {
    throw new Error(
      `cannot close ${date}: ${pending.length} task(s) not checked in`,
    );
  }
  for (const item of items) {
    if (item.outcome === "partial" || item.outcome === "blocked") {
      await setStatus(db, item.taskId, "queued");
    }
  }
  await db
    .update(dayPlans)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(dayPlans.id, plan.id));
  return (await getDay(db, date))!;
}

/** The carried-over items of a plan — unfinished work inherited from before. */
export async function carryOvers(db: Db, date: string): Promise<DayItem[]> {
  const day = await getDay(db, date);
  return day ? day.items.filter((i) => i.carriedOver) : [];
}
