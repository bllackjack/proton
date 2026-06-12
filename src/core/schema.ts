import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
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
