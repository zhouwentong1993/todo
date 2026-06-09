import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isRepeatRule, nextRepeatDate, type RepeatRule } from "../shared/dateRules.js";
import type {
  AppState,
  CreateListInput,
  CreateTaskInput,
  LoginResponse,
  Priority,
  Subtask,
  TaskStatus,
  TodoList,
  TodoTask,
  UpdateListInput,
  UpdateTaskInput,
  UserProfile
} from "../shared/types.js";

interface StoreConfig {
  jwtSecret: string;
  seedPhone: string;
  seedPassword: string;
}

interface UserRow {
  id: string;
  phone: string;
  password_hash: string;
  name: string;
}

interface ListRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "inbox" | "normal";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  list_id: string;
  title: string;
  notes: string;
  due_date: string | null;
  due_time: string | null;
  reminder_at: string | null;
  repeat_rule: RepeatRule | null;
  priority: Priority;
  status: TaskStatus;
  tags: string;
  subtasks: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TodoStore {
  login(phone: string, password: string): LoginResponse;
  verifyToken(token: string): UserProfile;
  getState(userId: string): AppState;
  createTask(userId: string, input: CreateTaskInput): TodoTask;
  updateTask(userId: string, taskId: string, input: UpdateTaskInput): TodoTask;
  deleteTask(userId: string, taskId: string): void;
  createList(userId: string, input: CreateListInput): TodoList;
  updateList(userId: string, listId: string, input: UpdateListInput): TodoList;
  deleteList(userId: string, listId: string): void;
}

const starterLists = [
  { name: "收集箱", color: "#4772f4", icon: "inbox", type: "inbox" as const },
  { name: "工作", color: "#0ea5a3", icon: "briefcase", type: "normal" as const },
  { name: "生活", color: "#f59e0b", icon: "home", type: "normal" as const },
  { name: "稍后", color: "#8b5cf6", icon: "clock", type: "normal" as const }
];

function now() {
  return new Date().toISOString();
}

function toUser(row: UserRow): UserProfile {
  return { id: row.id, phone: row.phone, name: row.name };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toList(row: ListRow): TodoList {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    type: row.type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toTask(row: TaskRow): TodoTask {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: row.due_time,
    reminderAt: row.reminder_at,
    repeatRule: row.repeat_rule,
    priority: row.priority,
    status: row.status,
    tags: parseJson<string[]>(row.tags, []),
    subtasks: parseJson<Subtask[]>(row.subtasks, []),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function cleanPriority(value: unknown): Priority {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

function cleanRepeatRule(value: unknown): RepeatRule | null {
  return isRepeatRule(value) ? value : null;
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

function cleanSubtasks(subtasks: unknown): Subtask[] {
  if (!Array.isArray(subtasks)) return [];
  return subtasks
    .map((subtask) => ({
      id: String(subtask.id || randomUUID()),
      title: String(subtask.title || "").trim(),
      done: Boolean(subtask.done)
    }))
    .filter((subtask) => subtask.title)
    .slice(0, 40);
}

export function createTodoStore(db: Database.Database, config: StoreConfig): TodoStore {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('inbox', 'normal')),
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      due_time TEXT,
      reminder_at TEXT,
      repeat_rule TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('active', 'completed')) DEFAULT 'active',
      tags TEXT NOT NULL DEFAULT '[]',
      subtasks TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id, sort_order);
  `);

  const existing = db.prepare("SELECT * FROM users WHERE phone = ?").get(config.seedPhone) as
    | UserRow
    | undefined;
  if (!existing) {
    const createdAt = now();
    const userId = randomUUID();
    db.prepare(
      "INSERT INTO users (id, phone, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId, config.seedPhone, bcrypt.hashSync(config.seedPassword, 10), "Wen Todo", createdAt, createdAt);

    const insertList = db.prepare(
      "INSERT INTO lists (id, user_id, name, color, icon, type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    starterLists.forEach((list, index) => {
      insertList.run(randomUUID(), userId, list.name, list.color, list.icon, list.type, index, createdAt, createdAt);
    });
  }

  const getUser = (userId: string) => {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
    if (!row) throw new Error("USER_NOT_FOUND");
    return row;
  };

  const getDefaultList = (userId: string) => {
    const row = db
      .prepare("SELECT * FROM lists WHERE user_id = ? ORDER BY type = 'inbox' DESC, sort_order ASC LIMIT 1")
      .get(userId) as ListRow | undefined;
    if (!row) throw new Error("LIST_NOT_FOUND");
    return row;
  };

  const ensureList = (userId: string, listId?: string) => {
    if (!listId) return getDefaultList(userId);
    const row = db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, listId) as
      | ListRow
      | undefined;
    if (!row) throw new Error("LIST_NOT_FOUND");
    return row;
  };

  const insertTask = (userId: string, input: CreateTaskInput) => {
    const title = input.title.trim();
    if (!title) throw new Error("TITLE_REQUIRED");
    const list = ensureList(userId, input.listId);
    const createdAt = now();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO tasks (
        id, user_id, list_id, title, notes, due_date, due_time, reminder_at, repeat_rule,
        priority, status, tags, subtasks, sort_order, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NULL)`
    ).run(
      id,
      userId,
      list.id,
      title,
      input.notes?.trim() ?? "",
      input.dueDate ?? null,
      input.dueTime ?? null,
      input.reminderAt ?? null,
      cleanRepeatRule(input.repeatRule),
      cleanPriority(input.priority),
      JSON.stringify(cleanTags(input.tags)),
      JSON.stringify(cleanSubtasks(input.subtasks)),
      Date.now(),
      createdAt,
      createdAt
    );
    return toTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow);
  };

  return {
    login(phone, password) {
      const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as UserRow | undefined;
      if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        throw new Error("INVALID_CREDENTIALS");
      }
      const user = toUser(row);
      return {
        token: jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "30d" }),
        user
      };
    },

    verifyToken(token) {
      const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
      if (!payload.sub || typeof payload.sub !== "string") throw new Error("INVALID_TOKEN");
      return toUser(getUser(payload.sub));
    },

    getState(userId) {
      const user = toUser(getUser(userId));
      const lists = (
        db.prepare("SELECT * FROM lists WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC").all(userId) as ListRow[]
      ).map(toList);
      const tasks = (
        db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY status ASC, sort_order DESC, created_at DESC").all(userId) as TaskRow[]
      ).map(toTask);
      return { user, lists, tasks, serverTime: now() };
    },

    createTask(userId, input) {
      return insertTask(userId, input);
    },

    updateTask(userId, taskId, input) {
      const current = db.prepare("SELECT * FROM tasks WHERE user_id = ? AND id = ?").get(userId, taskId) as
        | TaskRow
        | undefined;
      if (!current) throw new Error("TASK_NOT_FOUND");
      const list = input.listId ? ensureList(userId, input.listId) : undefined;
      const status = input.status ?? current.status;
      const title = input.title === undefined ? current.title : input.title.trim();
      if (!title) throw new Error("TITLE_REQUIRED");
      const updatedAt = now();
      const completedAt =
        status === "completed" ? current.completed_at ?? updatedAt : status === "active" ? null : current.completed_at;
      const repeatRule = input.repeatRule === undefined ? current.repeat_rule : cleanRepeatRule(input.repeatRule);

      db.prepare(
        `UPDATE tasks SET
          list_id = ?, title = ?, notes = ?, due_date = ?, due_time = ?, reminder_at = ?, repeat_rule = ?,
          priority = ?, status = ?, tags = ?, subtasks = ?, sort_order = ?, updated_at = ?, completed_at = ?
        WHERE user_id = ? AND id = ?`
      ).run(
        list?.id ?? current.list_id,
        title,
        input.notes === undefined ? current.notes : input.notes.trim(),
        input.dueDate === undefined ? current.due_date : input.dueDate,
        input.dueTime === undefined ? current.due_time : input.dueTime,
        input.reminderAt === undefined ? current.reminder_at : input.reminderAt,
        repeatRule,
        input.priority === undefined ? current.priority : cleanPriority(input.priority),
        status,
        input.tags === undefined ? current.tags : JSON.stringify(cleanTags(input.tags)),
        input.subtasks === undefined ? current.subtasks : JSON.stringify(cleanSubtasks(input.subtasks)),
        input.sortOrder === undefined ? current.sort_order : input.sortOrder,
        updatedAt,
        completedAt,
        userId,
        taskId
      );
      const updated = toTask(db.prepare("SELECT * FROM tasks WHERE user_id = ? AND id = ?").get(userId, taskId) as TaskRow);
      if (current.status !== "completed" && updated.status === "completed" && updated.repeatRule && updated.dueDate) {
        const nextDate = nextRepeatDate(updated.dueDate, updated.repeatRule);
        const duplicate = db
          .prepare(
            "SELECT id FROM tasks WHERE user_id = ? AND title = ? AND list_id = ? AND due_date = ? AND repeat_rule = ? AND status = 'active'"
          )
          .get(userId, updated.title, updated.listId, nextDate, updated.repeatRule);
        if (!duplicate) {
          insertTask(userId, {
            listId: updated.listId,
            title: updated.title,
            notes: updated.notes,
            dueDate: nextDate,
            dueTime: updated.dueTime,
            reminderAt: null,
            repeatRule: updated.repeatRule,
            priority: updated.priority,
            tags: updated.tags,
            subtasks: updated.subtasks.map((subtask) => ({ ...subtask, done: false }))
          });
        }
      }
      return updated;
    },

    deleteTask(userId, taskId) {
      db.prepare("DELETE FROM tasks WHERE user_id = ? AND id = ?").run(userId, taskId);
    },

    createList(userId, input) {
      const name = input.name.trim();
      if (!name) throw new Error("LIST_NAME_REQUIRED");
      const createdAt = now();
      const maxOrder = db
        .prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM lists WHERE user_id = ?")
        .get(userId) as { value: number };
      const id = randomUUID();
      db.prepare(
        "INSERT INTO lists (id, user_id, name, color, icon, type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?)"
      ).run(id, userId, name, input.color ?? "#64748b", input.icon ?? "list", maxOrder.value + 1, createdAt, createdAt);
      return toList(db.prepare("SELECT * FROM lists WHERE id = ?").get(id) as ListRow);
    },

    updateList(userId, listId, input) {
      const current = db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, listId) as
        | ListRow
        | undefined;
      if (!current) throw new Error("LIST_NOT_FOUND");
      if (current.type === "inbox" && input.name !== undefined && !input.name.trim()) throw new Error("LIST_NAME_REQUIRED");
      const updatedAt = now();
      db.prepare(
        "UPDATE lists SET name = ?, color = ?, icon = ?, sort_order = ?, updated_at = ? WHERE user_id = ? AND id = ?"
      ).run(
        input.name === undefined ? current.name : input.name.trim(),
        input.color ?? current.color,
        input.icon ?? current.icon,
        input.sortOrder ?? current.sort_order,
        updatedAt,
        userId,
        listId
      );
      return toList(db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, listId) as ListRow);
    },

    deleteList(userId, listId) {
      const row = db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, listId) as
        | ListRow
        | undefined;
      if (!row) return;
      if (row.type === "inbox") throw new Error("CANNOT_DELETE_INBOX");
      const fallback = getDefaultList(userId);
      db.prepare("UPDATE tasks SET list_id = ?, updated_at = ? WHERE user_id = ? AND list_id = ?").run(
        fallback.id,
        now(),
        userId,
        listId
      );
      db.prepare("DELETE FROM lists WHERE user_id = ? AND id = ?").run(userId, listId);
    }
  };
}
