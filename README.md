# Todo

TickTick-inspired web todo app for `todo.libary.cn`.

## Features

- Phone/password login with a seeded manual account.
- Desktop three-pane workflow and mobile drawer/bottom-nav layout.
- Smart views: all, inbox, today, upcoming, completed.
- Custom lists, quick add parsing, tags, priority, due date/time, notes, subtasks.
- Realtime multi-client sync through Socket.IO.
- SQLite file storage for a small ECS-friendly deployment.

## Local

```bash
npm install
npm run build
PORT=3018 HOST=127.0.0.1 JWT_SECRET=local-dev-secret npm start
```

Open `http://127.0.0.1:3018`.

Default account:

- Phone: `13671308802`
- Password: `123456`

## Deploy

```bash
cp .env.example .env
docker compose up -d --build
sudo cp deploy/nginx.todo.conf /etc/nginx/conf.d/todo.libary.cn.conf
sudo nginx -t
sudo systemctl reload nginx
```

Data is stored in `./data/todo.sqlite`.
