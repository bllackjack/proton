import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const priorityEnum = pgEnum("priority", ["P0", "P1", "P2", "P3"]);

export const taskStatusEnum = pgEnum("task_status", [
  "queued",
  "committed",
  "done",
  "partial",
  "blocked",
  "dropped",
]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  priority: priorityEnum("priority").notNull().default("P2"),
  notes: text("notes"),
  status: taskStatusEnum("status").notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Append-only: digests and carry-over decisions are derived from this,
// never from hand-maintained state (docs/SPEC.md §4).
export const taskStatusHistory = pgTable("task_status_history", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
  status: taskStatusEnum("status").notNull(),
  note: text("note"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskStatusHistoryRow = typeof taskStatusHistory.$inferSelect;

// A day plan moves planning → committed → closed: the morning call commits
// it, the evening check-in records outcomes, and closing re-queues the
// unfinished tasks as carry-overs (docs/SPEC.md §2).
export const dayPlanStatusEnum = pgEnum("day_plan_status", [
  "planning",
  "committed",
  "closed",
]);

// One plan per calendar date. Single user, so the date string is the key;
// stored as 'YYYY-MM-DD' text to stay free of timezone surprises.
export const dayPlans = pgTable("day_plans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  status: dayPlanStatusEnum("status").notNull().default("planning"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// The tasks proposed/committed for a day. `outcome` is null until check-in;
// `carriedOver` flags items that arrived unfinished from an earlier day.
// A task appears at most once per plan.
export const dayPlanItems = pgTable(
  "day_plan_items",
  {
    id: serial("id").primaryKey(),
    dayPlanId: integer("day_plan_id")
      .notNull()
      .references(() => dayPlans.id),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    outcome: taskStatusEnum("outcome"),
    carriedOver: boolean("carried_over").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.dayPlanId, t.taskId)],
);

export type DayPlan = typeof dayPlans.$inferSelect;
export type DayPlanItem = typeof dayPlanItems.$inferSelect;
