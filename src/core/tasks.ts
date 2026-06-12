import { desc, eq } from "drizzle-orm";
import { InvalidTransitionError, canTransition, type Priority } from "./index";
import type { Db } from "./db";
import {
  taskStatusHistory,
  tasks,
  type Task,
  type TaskStatusHistoryRow,
} from "./schema";
import type { TaskStatus } from "./index";

export interface CreateTaskInput {
  title: string;
  priority?: Priority;
  notes?: string;
}

export async function createTask(
  db: Db,
  input: CreateTaskInput,
): Promise<Task> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        title: input.title,
        priority: input.priority ?? "P2",
        notes: input.notes,
      })
      .returning();
    await tx
      .insert(taskStatusHistory)
      .values({ taskId: task.id, status: task.status });
    return task;
  });
}

export async function getTask(db: Db, id: number): Promise<Task | undefined> {
  return db.query.tasks.findFirst({ where: eq(tasks.id, id) });
}

export async function listTasks(
  db: Db,
  filter?: { status?: TaskStatus },
): Promise<Task[]> {
  return db.query.tasks.findMany({
    where: filter?.status ? eq(tasks.status, filter.status) : undefined,
    orderBy: [tasks.priority, tasks.createdAt],
  });
}

/**
 * The only way a task's status may change. Validates the transition and
 * appends to the history in the same transaction, so the append-only log
 * can never disagree with the task row.
 */
export async function setStatus(
  db: Db,
  id: number,
  to: TaskStatus,
  note?: string,
): Promise<Task> {
  return db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!task) throw new Error(`task ${id} not found`);
    if (!canTransition(task.status, to)) {
      throw new InvalidTransitionError(task.status, to);
    }
    const [updated] = await tx
      .update(tasks)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    await tx.insert(taskStatusHistory).values({ taskId: id, status: to, note });
    return updated;
  });
}

export async function statusHistory(
  db: Db,
  id: number,
): Promise<TaskStatusHistoryRow[]> {
  return db.query.taskStatusHistory.findMany({
    where: eq(taskStatusHistory.taskId, id),
    orderBy: [desc(taskStatusHistory.at), desc(taskStatusHistory.id)],
  });
}
