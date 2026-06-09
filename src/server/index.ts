import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import Database from "better-sqlite3";
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createTodoStore } from "./store.js";
import type { CreateListInput, CreateTaskInput, UpdateListInput, UpdateTaskInput, UserProfile } from "../shared/types.js";

const port = Number(process.env.PORT ?? 3018);
const host = process.env.HOST ?? "0.0.0.0";
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "todo.sqlite"));
const store = createTodoStore(db, {
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  seedPhone: process.env.SEED_PHONE ?? "13671308802",
  seedPassword: process.env.SEED_PASSWORD ?? "123456"
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true
  }
});

declare module "express-serve-static-core" {
  interface Request {
    user?: UserProfile;
  }
}

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status =
    message.includes("NOT_FOUND") ? 404 : message.includes("INVALID") || message.includes("REQUIRED") ? 400 : 500;
  res.status(status).json({ error: message });
}

function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new Error("INVALID_TOKEN");
    req.user = store.verifyToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "INVALID_TOKEN" });
  }
}

function broadcastState(userId: string) {
  io.to(userId).emit("state", store.getState(userId));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

app.post("/api/auth/login", (req, res) => {
  try {
    res.json(store.login(String(req.body.phone ?? ""), String(req.body.password ?? "")));
  } catch (error) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
});

app.get("/api/bootstrap", auth, (req, res) => {
  res.json(store.getState(req.user!.id));
});

app.post("/api/tasks", auth, (req, res) => {
  try {
    const task = store.createTask(req.user!.id, req.body);
    broadcastState(req.user!.id);
    res.status(201).json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/tasks/:id", auth, (req, res) => {
  try {
    const task = store.updateTask(req.user!.id, String(req.params.id), req.body);
    broadcastState(req.user!.id);
    res.json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  try {
    store.deleteTask(req.user!.id, String(req.params.id));
    broadcastState(req.user!.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/lists", auth, (req, res) => {
  try {
    const list = store.createList(req.user!.id, req.body);
    broadcastState(req.user!.id);
    res.status(201).json(list);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/lists/:id", auth, (req, res) => {
  try {
    const list = store.updateList(req.user!.id, String(req.params.id), req.body);
    broadcastState(req.user!.id);
    res.json(list);
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/lists/:id", auth, (req, res) => {
  try {
    store.deleteList(req.user!.id, String(req.params.id));
    broadcastState(req.user!.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth.token ?? "");
    const user = store.verifyToken(token);
    socket.data.user = user;
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("INVALID_TOKEN"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user as UserProfile;
  socket.join(user.id);
  socket.emit("state", store.getState(user.id));

  const withAck =
    <T>(handler: (payload: T) => unknown) =>
    (payload: T, ack?: (response: unknown) => void) => {
      try {
        const result = handler(payload);
        broadcastState(user.id);
        ack?.({ ok: true, data: result });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
      }
    };

  socket.on("task:create", withAck((payload: CreateTaskInput) => store.createTask(user.id, payload)));
  socket.on("task:update", withAck((payload: { id: string; patch: UpdateTaskInput }) => store.updateTask(user.id, payload.id, payload.patch)));
  socket.on("task:delete", withAck((payload: { id: string }) => store.deleteTask(user.id, payload.id)));
  socket.on("list:create", withAck((payload: CreateListInput) => store.createList(user.id, payload)));
  socket.on("list:update", withAck((payload: { id: string; patch: UpdateListInput }) => store.updateList(user.id, payload.id, payload.patch)));
  socket.on("list:delete", withAck((payload: { id: string }) => store.deleteList(user.id, payload.id)));
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client");
app.use(express.static(clientDist));
app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

httpServer.listen(port, host, () => {
  console.log(`todo listening on ${host}:${port}`);
});
