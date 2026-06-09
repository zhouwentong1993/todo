import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "./components/Icon";
import { useTodoSync } from "./hooks/useTodoSync";
import { parseQuickTask } from "../shared/quickAdd";
import type { AppState, Priority, Subtask, TodoList, TodoTask } from "../shared/types";

type ViewId = "all" | "today" | "upcoming" | "completed" | "inbox" | `list:${string}`;

const priorityText: Record<Priority, string> = {
  0: "无",
  1: "低",
  2: "中",
  3: "高"
};

const repeatText = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月"
} as const;

function chinaDate(offset = 0) {
  const now = new Date();
  const utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(utc));
}

function isNextSevenDays(date: string | null) {
  if (!date) return false;
  const today = chinaDate();
  const week = chinaDate(7);
  return date >= today && date <= week;
}

function dueLabel(task: TodoTask) {
  if (!task.dueDate) return "";
  const today = chinaDate();
  const tomorrow = chinaDate(1);
  const day = task.dueDate === today ? "今天" : task.dueDate === tomorrow ? "明天" : task.dueDate.slice(5);
  return task.dueTime ? `${day} ${task.dueTime}` : day;
}

function listForTask(lists: TodoList[], task: TodoTask) {
  return lists.find((list) => list.id === task.listId) ?? lists[0];
}

function taskMatchesView(task: TodoTask, view: ViewId, lists: TodoList[]) {
  if (view === "all") return task.status === "active";
  if (view === "today") return task.status === "active" && task.dueDate === chinaDate();
  if (view === "upcoming") return task.status === "active" && isNextSevenDays(task.dueDate);
  if (view === "completed") return task.status === "completed";
  if (view === "inbox") return task.status === "active" && listForTask(lists, task).type === "inbox";
  if (view.startsWith("list:")) return task.listId === view.slice(5) && task.status === "active";
  return false;
}

function sortTasks(a: TodoTask, b: TodoTask) {
  if (a.status !== b.status) return a.status === "active" ? -1 : 1;
  if (a.dueDate !== b.dueDate) return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.sortOrder - a.sortOrder;
}

function LoginView({ onLogin, status, error }: { onLogin: (phone: string, password: string) => Promise<void>; status: string; error: string | null }) {
  const [phone, setPhone] = useState("13671308802");
  const [password, setPassword] = useState("123456");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onLogin(phone, password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">
          <Icon name="check" />
        </div>
        <h1>Todo</h1>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>手机号</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="username" />
          </label>
          <label>
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          <button className="primary-button" disabled={busy || status === "connecting"}>
            {busy || status === "connecting" ? "登录中" : "登录"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function Sidebar({
  state,
  view,
  onView,
  onCreateList,
  open,
  onClose
}: {
  state: AppState;
  view: ViewId;
  onView: (view: ViewId) => void;
  onCreateList: (name: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [listName, setListName] = useState("");
  const counts = useMemo(() => {
    const active = state.tasks.filter((task) => task.status === "active");
    return {
      all: active.length,
      today: active.filter((task) => task.dueDate === chinaDate()).length,
      upcoming: active.filter((task) => isNextSevenDays(task.dueDate)).length,
      inbox: active.filter((task) => listForTask(state.lists, task).type === "inbox").length,
      completed: state.tasks.filter((task) => task.status === "completed").length
    };
  }, [state]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = listName.trim();
    if (!name) return;
    onCreateList(name);
    setListName("");
  }

  const smartViews: Array<{ id: ViewId; label: string; icon: "inbox" | "calendar" | "clock" | "check" | "list"; count: number }> = [
    { id: "all", label: "所有", icon: "list", count: counts.all },
    { id: "inbox", label: "收集箱", icon: "inbox", count: counts.inbox },
    { id: "today", label: "今天", icon: "calendar", count: counts.today },
    { id: "upcoming", label: "未来七天", icon: "clock", count: counts.upcoming },
    { id: "completed", label: "已完成", icon: "check", count: counts.completed }
  ];

  return (
    <>
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <div className="app-wordmark">
            <span className="mark"><Icon name="check" /></span>
            <strong>Todo</strong>
          </div>
          <button className="icon-button mobile-only" onClick={onClose} aria-label="关闭" title="关闭">
            <Icon name="x" />
          </button>
        </div>

        <nav className="nav-group">
          {smartViews.map((item) => (
            <button key={item.id} className={`nav-row ${view === item.id ? "active" : ""}`} onClick={() => onView(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </nav>

        <div className="list-section">
          <div className="section-title">清单</div>
          {state.lists.map((list) => {
            const count = state.tasks.filter((task) => task.status === "active" && task.listId === list.id).length;
            const id = `list:${list.id}` as ViewId;
            return (
              <button key={list.id} className={`nav-row ${view === id ? "active" : ""}`} onClick={() => onView(id)}>
                <span className="color-dot" style={{ background: list.color }} />
                <span>{list.name}</span>
                <small>{count}</small>
              </button>
            );
          })}
          <form className="new-list" onSubmit={submit}>
            <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="新清单" />
            <button className="icon-button" aria-label="添加清单" title="添加清单">
              <Icon name="plus" />
            </button>
          </form>
        </div>
      </aside>
      <button className={`scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-label="关闭侧栏" />
    </>
  );
}

function TaskRow({
  task,
  list,
  selected,
  onSelect,
  onToggle
}: {
  task: TodoTask;
  list: TodoList;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const done = task.status === "completed";
  const completedSubtasks = task.subtasks.filter((item) => item.done).length;

  return (
    <article className={`task-row ${selected ? "selected" : ""} ${done ? "done" : ""}`} onClick={onSelect}>
      <button className={`check-button ${done ? "checked" : ""}`} onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label="完成切换" title="完成切换">
        {done ? <Icon name="check" /> : null}
      </button>
      <div className="task-copy">
        <div className="task-title-line">
          <strong>{task.title}</strong>
          {task.priority > 0 ? (
            <span className={`priority p${task.priority}`}>
              <Icon name="flag" />
            </span>
          ) : null}
        </div>
        <div className="task-meta">
          <span className="list-chip" style={{ color: list.color }}>
            {list.name}
          </span>
          {task.dueDate ? (
            <span className={task.dueDate < chinaDate() && !done ? "danger" : ""}>
              <Icon name="calendar" />
              {dueLabel(task)}
            </span>
          ) : null}
          {task.subtasks.length ? (
            <span>
              <Icon name="check" />
              {completedSubtasks}/{task.subtasks.length}
            </span>
          ) : null}
          {task.repeatRule ? (
            <span>
              <Icon name="refresh" />
              {repeatText[task.repeatRule]}
            </span>
          ) : null}
          {task.tags.map((tag) => (
            <span key={tag}>
              <Icon name="tag" />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function TaskList({
  state,
  view,
  search,
  selectedTaskId,
  onSelect,
  onToggle
}: {
  state: AppState;
  view: ViewId;
  search: string;
  selectedTaskId: string | null;
  onSelect: (task: TodoTask) => void;
  onToggle: (task: TodoTask) => void;
}) {
  const tasks = state.tasks
    .filter((task) => taskMatchesView(task, view, state.lists))
    .filter((task) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return `${task.title} ${task.notes} ${task.tags.join(" ")}`.toLowerCase().includes(needle);
    })
    .sort(sortTasks);

  const overdue = tasks.filter((task) => task.status === "active" && task.dueDate && task.dueDate < chinaDate());
  const current = tasks.filter((task) => !overdue.includes(task));

  return (
    <div className="task-list">
      {overdue.length ? <div className="section-title danger">已过期</div> : null}
      {overdue.map((task) => (
        <TaskRow key={task.id} task={task} list={listForTask(state.lists, task)} selected={selectedTaskId === task.id} onSelect={() => onSelect(task)} onToggle={() => onToggle(task)} />
      ))}
      {overdue.length && current.length ? <div className="section-title">任务</div> : null}
      {current.map((task) => (
        <TaskRow key={task.id} task={task} list={listForTask(state.lists, task)} selected={selectedTaskId === task.id} onSelect={() => onSelect(task)} onToggle={() => onToggle(task)} />
      ))}
      {!tasks.length ? (
        <div className="empty-state">
          <Icon name="check" />
          <span>清空了</span>
        </div>
      ) : null}
    </div>
  );
}

function DetailPane({
  task,
  lists,
  open,
  onClose,
  onUpdate,
  onDelete
}: {
  task: TodoTask | null;
  lists: TodoList[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<TodoTask>) => void;
  onDelete: (id: string) => void;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");

  if (!task) {
    return (
      <aside className="detail-pane placeholder">
        <Icon name="list" />
        <span>选择任务</span>
      </aside>
    );
  }

  const currentTask = task;
  const updateSubtasks = (subtasks: Subtask[]) => onUpdate(currentTask.id, { subtasks });

  function addSubtask(event: FormEvent) {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title) return;
    updateSubtasks([...currentTask.subtasks, { id: crypto.randomUUID(), title, done: false }]);
    setSubtaskTitle("");
  }

  return (
    <aside className={`detail-pane ${open ? "is-open" : ""}`}>
      <div className="detail-actions">
        <button className="icon-button mobile-only" onClick={onClose} aria-label="关闭" title="关闭">
          <Icon name="x" />
        </button>
        <button className="icon-button danger" onClick={() => onDelete(task.id)} aria-label="删除" title="删除">
          <Icon name="trash" />
        </button>
      </div>

      <input className="detail-title" value={task.title} onChange={(event) => onUpdate(task.id, { title: event.target.value })} />
      <textarea className="detail-notes" value={task.notes} onChange={(event) => onUpdate(task.id, { notes: event.target.value })} placeholder="备注" />

      <div className="field-grid">
        <label>
          <span>清单</span>
          <select value={task.listId} onChange={(event) => onUpdate(task.id, { listId: event.target.value })}>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select value={task.priority} onChange={(event) => onUpdate(task.id, { priority: Number(event.target.value) as Priority })}>
            {([0, 1, 2, 3] as Priority[]).map((priority) => (
              <option key={priority} value={priority}>
                {priorityText[priority]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>重复</span>
          <select
            value={task.repeatRule ?? ""}
            onChange={(event) =>
              onUpdate(task.id, { repeatRule: (event.target.value || null) as TodoTask["repeatRule"] })
            }
          >
            <option value="">无</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </label>
        <label>
          <span>日期</span>
          <input type="date" value={task.dueDate ?? ""} onChange={(event) => onUpdate(task.id, { dueDate: event.target.value || null })} />
        </label>
        <label>
          <span>时间</span>
          <input type="time" value={task.dueTime ?? ""} onChange={(event) => onUpdate(task.id, { dueTime: event.target.value || null })} />
        </label>
      </div>

      <label className="tags-field">
        <span>标签</span>
        <input value={task.tags.join(", ")} onChange={(event) => onUpdate(task.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
      </label>

      <div className="subtasks">
        <div className="section-title">检查项</div>
        {task.subtasks.map((subtask) => (
          <label key={subtask.id} className="subtask-row">
            <input
              type="checkbox"
              checked={subtask.done}
              onChange={(event) =>
                updateSubtasks(task.subtasks.map((item) => (item.id === subtask.id ? { ...item, done: event.target.checked } : item)))
              }
            />
            <span>{subtask.title}</span>
          </label>
        ))}
        <form className="subtask-add" onSubmit={addSubtask}>
          <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="检查项" />
          <button className="icon-button" aria-label="添加检查项" title="添加检查项">
            <Icon name="plus" />
          </button>
        </form>
      </div>
    </aside>
  );
}

function BottomNav({ view, onView }: { view: ViewId; onView: (view: ViewId) => void }) {
  const items: Array<{ id: ViewId; icon: "inbox" | "calendar" | "clock" | "check"; label: string }> = [
    { id: "inbox", icon: "inbox", label: "收集箱" },
    { id: "today", icon: "calendar", label: "今天" },
    { id: "upcoming", icon: "clock", label: "未来" },
    { id: "completed", icon: "check", label: "完成" }
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onView(item.id)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function App() {
  const { state, status, error, actions } = useTodoSync();
  const [view, setView] = useState<ViewId>("inbox");
  const [search, setSearch] = useState("");
  const [quickText, setQuickText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedTask = state?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const inbox = state?.lists.find((list) => list.type === "inbox") ?? state?.lists[0];
  const currentListId = view.startsWith("list:") ? view.slice(5) : view === "inbox" ? inbox?.id : undefined;

  useEffect(() => {
    if (selectedTaskId && state && !state.tasks.some((task) => task.id === selectedTaskId)) setSelectedTaskId(null);
  }, [selectedTaskId, state]);

  if (!state) {
    return <LoginView onLogin={actions.login} status={status} error={error} />;
  }

  async function submitQuick(event: FormEvent) {
    event.preventDefault();
    const draft = parseQuickTask(quickText);
    if (!draft.title.trim()) return;
    const created = (await actions.createTask({
      ...draft,
      listId: currentListId ?? inbox?.id
    })) as TodoTask | undefined;
    setQuickText("");
    if (created?.id) setSelectedTaskId(created.id);
  }

  async function toggleTask(task: TodoTask) {
    await actions.updateTask(task.id, { status: task.status === "completed" ? "active" : "completed" });
  }

  async function updateTask(id: string, patch: Partial<TodoTask>) {
    await actions.updateTask(id, patch);
  }

  async function deleteTask(id: string) {
    await actions.deleteTask(id);
    setSelectedTaskId(null);
    setDetailOpen(false);
  }

  const title =
    view === "all"
      ? "所有"
      : view === "today"
        ? "今天"
        : view === "upcoming"
          ? "未来七天"
          : view === "completed"
            ? "已完成"
            : view === "inbox"
              ? "收集箱"
              : state.lists.find((list) => list.id === view.slice(5))?.name ?? "清单";

  return (
    <div className="app-shell">
      <Sidebar
        state={state}
        view={view}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onView={(nextView) => {
          setView(nextView);
          setSidebarOpen(false);
        }}
        onCreateList={(name) => actions.createList({ name })}
      />

      <main className="main-pane">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="菜单" title="菜单">
            <Icon name="menu" />
          </button>
          <div>
            <h1>{title}</h1>
            <span className={`sync-pill ${status}`}>
              <Icon name={status === "synced" ? "check" : status === "connecting" ? "refresh" : "bell"} />
              {status === "synced" ? "已同步" : status === "connecting" ? "同步中" : "离线"}
            </span>
          </div>
          <label className="search-box">
            <Icon name="search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索" />
          </label>
          <button className="icon-button" onClick={() => actions.refresh()} aria-label="刷新" title="刷新">
            <Icon name="refresh" />
          </button>
          <button className="avatar-button" onClick={actions.logout} aria-label="退出" title="退出">
            <Icon name="logout" />
          </button>
        </header>

        <form className="quick-add" onSubmit={submitQuick}>
          <Icon name="plus" />
          <input value={quickText} onChange={(event) => setQuickText(event.target.value)} placeholder="添加任务" />
          <button className="primary-button">添加</button>
        </form>

        <TaskList
          state={state}
          view={view}
          search={search}
          selectedTaskId={selectedTaskId}
          onSelect={(task) => {
            setSelectedTaskId(task.id);
            setDetailOpen(true);
          }}
          onToggle={toggleTask}
        />
      </main>

      <DetailPane
        task={selectedTask}
        lists={state.lists}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />

      <BottomNav view={view} onView={setView} />
    </div>
  );
}
