import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AppState,
  CreateListInput,
  CreateTaskInput,
  LoginResponse,
  TodoTask,
  UpdateListInput,
  UpdateTaskInput
} from "../../shared/types";

type SyncStatus = "signed-out" | "connecting" | "synced" | "offline" | "error";
type Ack = { ok: true; data?: unknown } | { ok: false; error: string };

const tokenKey = "todo.token";

async function request<T>(path: string, token?: string | null, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function useTodoSync() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<SyncStatus>(token ? "connecting" : "signed-out");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const persistToken = useCallback((nextToken: string | null) => {
    if (nextToken) localStorage.setItem(tokenKey, nextToken);
    else localStorage.removeItem(tokenKey);
    setToken(nextToken);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const nextState = await request<AppState>("/api/bootstrap", token);
    setState(nextState);
    setStatus("synced");
  }, [token]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setState(null);
      setStatus("signed-out");
      return;
    }

    let cancelled = false;
    setStatus("connecting");
    setError(null);

    request<AppState>("/api/bootstrap", token)
      .then((bootstrap) => {
        if (!cancelled) {
          setState(bootstrap);
          setStatus("synced");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "SYNC_ERROR");
          setStatus("error");
        }
      });

    const socket = io("/", { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setStatus("synced"));
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", (err) => {
      setError(err.message);
      setStatus("error");
    });
    socket.on("state", (nextState: AppState) => {
      setState(nextState);
      setStatus("synced");
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [token]);

  const login = useCallback(
    async (phone: string, password: string) => {
      setStatus("connecting");
      const session = await request<LoginResponse>("/api/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ phone, password })
      });
      persistToken(session.token);
    },
    [persistToken]
  );

  const logout = useCallback(() => {
    persistToken(null);
  }, [persistToken]);

  const emit = useCallback(
    async (event: string, payload: unknown, fallback: () => Promise<unknown>) => {
      const socket = socketRef.current;
      if (socket?.connected) {
        const ack = (await socket.timeout(5000).emitWithAck(event, payload)) as Ack;
        if (!ack.ok) throw new Error(ack.error);
        return ack.data;
      }
      const value = await fallback();
      await refresh();
      return value;
    },
    [refresh]
  );

  const actions = useMemo(
    () => ({
      login,
      logout,
      refresh,
      createTask: (input: CreateTaskInput) =>
        emit("task:create", input, () =>
          request<TodoTask>("/api/tasks", token, { method: "POST", body: JSON.stringify(input) })
        ),
      updateTask: (id: string, patch: UpdateTaskInput) =>
        emit("task:update", { id, patch }, () =>
          request<TodoTask>(`/api/tasks/${id}`, token, { method: "PATCH", body: JSON.stringify(patch) })
        ),
      deleteTask: (id: string) =>
        emit("task:delete", { id }, () => request<void>(`/api/tasks/${id}`, token, { method: "DELETE" })),
      createList: (input: CreateListInput) =>
        emit("list:create", input, () =>
          request("/api/lists", token, { method: "POST", body: JSON.stringify(input) })
        ),
      updateList: (id: string, patch: UpdateListInput) =>
        emit("list:update", { id, patch }, () =>
          request(`/api/lists/${id}`, token, { method: "PATCH", body: JSON.stringify(patch) })
        ),
      deleteList: (id: string) =>
        emit("list:delete", { id }, () => request<void>(`/api/lists/${id}`, token, { method: "DELETE" }))
    }),
    [emit, login, logout, refresh, token]
  );

  return { state, status, error, token, actions };
}
