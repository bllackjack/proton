import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "./db";
import { createTask, getTask } from "./tasks";
import {
  addToDay,
  carryOvers,
  checkIn,
  closeDay,
  commitDay,
  getDay,
  openDay,
  removeFromDay,
} from "./day";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("openDay", () => {
  it("seeds the plan with the whole queue", async () => {
    await createTask(db, { title: "file the visa form", priority: "P1" });
    await createTask(db, { title: "call the bank", priority: "P0" });

    const day = await openDay(db, "2026-06-13");
    expect(day.status).toBe("planning");
    expect(day.items.map((i) => i.task.title)).toEqual([
      "call the bank", // P0 sorts ahead of P1
      "file the visa form",
    ]);
    expect(day.items.every((i) => i.carriedOver)).toBe(false);
  });

  it("is idempotent — reopening returns the same plan untouched", async () => {
    const t = await createTask(db, { title: "ship the digest" });
    const first = await openDay(db, "2026-06-13");
    await removeFromDay(db, "2026-06-13", t.id);
    const second = await openDay(db, "2026-06-13");

    expect(second.id).toBe(first.id);
    expect(second.items).toHaveLength(0); // the removal stuck
  });
});

describe("planning edits", () => {
  it("adds a queued task created after the day opened", async () => {
    await openDay(db, "2026-06-13");
    const late = await createTask(db, { title: "added after planning opened" });
    const day = await addToDay(db, "2026-06-13", late.id);
    expect(day.items.map((i) => i.taskId)).toContain(late.id);
  });

  it("refuses to add a non-queued task", async () => {
    const t = await createTask(db, { title: "already moving" });
    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13"); // t is now committed, plan locked
    // a fresh planning day so requirePlan passes; t is committed elsewhere
    await openDay(db, "2026-06-14");
    await expect(addToDay(db, "2026-06-14", t.id)).rejects.toThrow(
      /not queued/,
    );
  });

  it("only edits a plan that is still in planning", async () => {
    const t = await createTask(db, { title: "locked in" });
    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13");
    await expect(removeFromDay(db, "2026-06-13", t.id)).rejects.toThrow(
      /is committed, expected planning/,
    );
  });
});

describe("commitDay", () => {
  it("commits every task and locks the plan", async () => {
    const t = await createTask(db, { title: "ship it" });
    await openDay(db, "2026-06-13");
    const day = await commitDay(db, "2026-06-13");
    expect(day.status).toBe("committed");
    expect(day.committedAt).toBeInstanceOf(Date);
    expect((await getTask(db, t.id))?.status).toBe("committed");
  });
});

describe("checkIn and closeDay", () => {
  it("records outcomes and mirrors the blocker note onto the item", async () => {
    const done = await createTask(db, { title: "shipped" });
    const blocked = await createTask(db, { title: "call the bank" });
    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13");

    await checkIn(db, "2026-06-13", done.id, "done");
    await checkIn(
      db,
      "2026-06-13",
      blocked.id,
      "blocked",
      "waiting on callback",
    );

    const day = await getDay(db, "2026-06-13");
    const blockedItem = day!.items.find((i) => i.taskId === blocked.id);
    expect(blockedItem?.outcome).toBe("blocked");
    expect(blockedItem?.note).toBe("waiting on callback");
  });

  it("refuses to check in a task that is not on the plan", async () => {
    await createTask(db, { title: "planned" });
    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13");
    // created after the plan locked, so it never made it onto the plan
    const off = await createTask(db, { title: "not planned" });
    await expect(checkIn(db, "2026-06-13", off.id, "done")).rejects.toThrow(
      /not in the 2026-06-13 plan/,
    );
  });

  it("won't close until every task is checked in", async () => {
    await createTask(db, { title: "one" });
    await createTask(db, { title: "two" });
    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13");
    await expect(closeDay(db, "2026-06-13")).rejects.toThrow(/not checked in/);
  });
});

describe("carry-over across days", () => {
  it("re-queues unfinished work and proposes it the next day, flagged", async () => {
    const finished = await createTask(db, { title: "done today" });
    const partial = await createTask(db, { title: "half done" });

    await openDay(db, "2026-06-13");
    await commitDay(db, "2026-06-13");
    await checkIn(db, "2026-06-13", finished.id, "done");
    await checkIn(db, "2026-06-13", partial.id, "partial", "ran out of time");
    const closed = await closeDay(db, "2026-06-13");
    expect(closed.status).toBe("closed");

    // the partial task is back in the queue; the done one is terminal
    expect((await getTask(db, partial.id))?.status).toBe("queued");
    expect((await getTask(db, finished.id))?.status).toBe("done");

    const tomorrow = await openDay(db, "2026-06-14");
    expect(tomorrow.items.map((i) => i.taskId)).toEqual([partial.id]);
    expect(tomorrow.items[0].carriedOver).toBe(true);

    const carried = await carryOvers(db, "2026-06-14");
    expect(carried.map((i) => i.task.title)).toEqual(["half done"]);
  });

  it("does not flag a brand-new task as a carry-over", async () => {
    const fresh = await createTask(db, { title: "first time seen" });
    const day = await openDay(db, "2026-06-14");
    expect(day.items.find((i) => i.taskId === fresh.id)?.carriedOver).toBe(
      false,
    );
  });
});
