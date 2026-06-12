import { beforeEach, describe, expect, it } from "vitest";
import { InvalidTransitionError } from "./index";
import { createTestDb, type Db } from "./db";
import {
  createTask,
  getTask,
  listTasks,
  setStatus,
  statusHistory,
} from "./tasks";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("createTask", () => {
  it("defaults to queued status and P2 priority", async () => {
    const task = await createTask(db, { title: "file the visa form" });
    expect(task.status).toBe("queued");
    expect(task.priority).toBe("P2");
  });

  it("writes the initial history row", async () => {
    const task = await createTask(db, { title: "file the visa form" });
    const history = await statusHistory(db, task.id);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("queued");
  });
});

describe("setStatus", () => {
  it("walks the happy path queued → committed → done", async () => {
    const task = await createTask(db, { title: "ship the digest" });
    await setStatus(db, task.id, "committed");
    const done = await setStatus(db, task.id, "done");
    expect(done.status).toBe("done");
  });

  it("rejects skipping the committed step", async () => {
    const task = await createTask(db, { title: "ship the digest" });
    await expect(setStatus(db, task.id, "done")).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects leaving a terminal status", async () => {
    const task = await createTask(db, { title: "ship the digest" });
    await setStatus(db, task.id, "committed");
    await setStatus(db, task.id, "done");
    await expect(setStatus(db, task.id, "queued")).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("attaches blocker notes to the history, append-only", async () => {
    const task = await createTask(db, { title: "call the bank" });
    await setStatus(db, task.id, "committed");
    await setStatus(db, task.id, "blocked", "waiting on a callback");
    const history = await statusHistory(db, task.id);
    expect(history.map((h) => h.status)).toEqual([
      "blocked",
      "committed",
      "queued",
    ]);
    expect(history[0].note).toBe("waiting on a callback");
  });

  it("lets blocked tasks re-queue as carry-overs", async () => {
    const task = await createTask(db, { title: "call the bank" });
    await setStatus(db, task.id, "committed");
    await setStatus(db, task.id, "blocked");
    const requeued = await setStatus(db, task.id, "queued");
    expect(requeued.status).toBe("queued");
  });

  it("leaves the task untouched when the transition is invalid", async () => {
    const task = await createTask(db, { title: "call the bank" });
    await expect(setStatus(db, task.id, "done")).rejects.toThrow();
    expect((await getTask(db, task.id))?.status).toBe("queued");
    expect(await statusHistory(db, task.id)).toHaveLength(1);
  });
});

describe("listTasks", () => {
  it("filters by status and orders by priority", async () => {
    const low = await createTask(db, { title: "low", priority: "P3" });
    await createTask(db, { title: "urgent", priority: "P0" });
    await setStatus(db, low.id, "committed");

    const queued = await listTasks(db, { status: "queued" });
    expect(queued.map((t) => t.title)).toEqual(["urgent"]);

    const all = await listTasks(db);
    expect(all.map((t) => t.priority)).toEqual(["P0", "P3"]);
  });
});
