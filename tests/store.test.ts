import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createTodoStore } from "../src/server/store";

const dbs: Database.Database[] = [];

function makeStore() {
  const db = new Database(":memory:");
  dbs.push(db);
  return createTodoStore(db, {
    jwtSecret: "test-secret",
    seedPhone: "13671308802",
    seedPassword: "123456"
  });
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

describe("todo store", () => {
  it("seeds the manual account and starter lists", () => {
    const store = makeStore();

    const session = store.login("13671308802", "123456");
    const state = store.getState(session.user.id);

    expect(session.token).toMatch(/^ey/);
    expect(state.user.phone).toBe("13671308802");
    expect(state.lists.map((list) => list.name)).toEqual([
      "收集箱",
      "工作",
      "生活",
      "稍后"
    ]);
  });

  it("creates, updates, completes, and scopes tasks to the signed-in user", () => {
    const store = makeStore();
    const session = store.login("13671308802", "123456");
    const inbox = store.getState(session.user.id).lists[0];

    const task = store.createTask(session.user.id, {
      listId: inbox.id,
      title: "写同步逻辑",
      priority: 2,
      tags: ["开发"],
      dueDate: "2026-06-10",
      dueTime: "21:00"
    });

    const updated = store.updateTask(session.user.id, task.id, {
      status: "completed",
      notes: "跨端状态需要广播"
    });

    const state = store.getState(session.user.id);

    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toBeTruthy();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({
      title: "写同步逻辑",
      notes: "跨端状态需要广播",
      tags: ["开发"]
    });
  });

  it("creates the next occurrence when a repeating task is completed", () => {
    const store = makeStore();
    const session = store.login("13671308802", "123456");
    const inbox = store.getState(session.user.id).lists[0];

    const task = store.createTask(session.user.id, {
      listId: inbox.id,
      title: "每日站会",
      dueDate: "2026-06-10",
      dueTime: "09:30",
      repeatRule: "daily"
    });

    store.updateTask(session.user.id, task.id, { status: "completed" });

    const state = store.getState(session.user.id);
    const completed = state.tasks.find((item) => item.id === task.id);
    const next = state.tasks.find((item) => item.id !== task.id);

    expect(completed?.status).toBe("completed");
    expect(next).toMatchObject({
      title: "每日站会",
      status: "active",
      dueDate: "2026-06-11",
      dueTime: "09:30",
      repeatRule: "daily"
    });
  });
});
