export type Priority = 0 | 1 | 2 | 3;
export type TaskStatus = "active" | "completed";

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
}

export interface TodoList {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "inbox" | "normal";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TodoTask {
  id: string;
  listId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  reminderAt: string | null;
  repeatRule: string | null;
  priority: Priority;
  status: TaskStatus;
  tags: string[];
  subtasks: Subtask[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AppState {
  user: UserProfile;
  lists: TodoList[];
  tasks: TodoTask[];
  serverTime: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface CreateTaskInput {
  listId?: string;
  title: string;
  notes?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderAt?: string | null;
  repeatRule?: string | null;
  priority?: Priority;
  tags?: string[];
  subtasks?: Subtask[];
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "listId">> & {
  listId?: string;
  status?: TaskStatus;
  sortOrder?: number;
};

export interface CreateListInput {
  name: string;
  color?: string;
  icon?: string;
}

export type UpdateListInput = Partial<CreateListInput> & {
  sortOrder?: number;
};

export interface QuickTaskDraft {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  tags: string[];
}
