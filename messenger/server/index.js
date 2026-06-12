const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Auth helpers ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Не авторизован" });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: "Сессия истекла" });
  req.user = user;
  next();
}

// --- REST API ---

// Register
app.post("/api/register", (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: "Заполни все поля" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Логин минимум 3 символа" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Пароль минимум 4 символа" });
  }
  try {
    const userId = db.createUser(username, displayName, password);
    const token = db.createSession(userId);
    const user = db.getUserById(userId);
    res.json({ token, user });
  } catch (e) {
    if (e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Логин уже занят" });
    }
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Заполни все поля" });
  }
  const user = db.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  const token = db.createSession(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_color: user.avatar_color,
    },
  });
});

// Logout
app.post("/api/logout", authMiddleware, (req, res) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  db.deleteSession(token);
  res.json({ ok: true });
});

// Current user
app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// All users
app.get("/api/users", authMiddleware, (req, res) => {
  const users = db.getAllUsers().filter((u) => u.id !== req.user.id);
  res.json({ users });
});

// Conversation with a user
app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const otherId = parseInt(req.params.userId);
  const messages = db.getConversation(req.user.id, otherId);
  db.markRead(otherId, req.user.id);
  res.json({ messages });
});

// Recent chats
app.get("/api/chats", authMiddleware, (req, res) => {
  const chats = db.getRecentChats(req.user.id);
  const unread = db.getUnreadCounts(req.user.id);
  res.json({ chats, unread });
});

// Search users
app.get("/api/search", authMiddleware, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const users = db.getAllUsers().filter(
    (u) => u.id !== req.user.id && (
      u.username.includes(q) || u.display_name.toLowerCase().includes(q)
    )
  );
  res.json({ users });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// --- WebSocket ---
const wss = new WebSocketServer({ server });
const onlineUsers = new Map(); // userId -> Set<ws>

wss.on("connection", (ws) => {
  let currentUser = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Auth
    if (msg.type === "auth") {
      const user = db.getUserByToken(msg.token);
      if (!user) {
        ws.send(JSON.stringify({ type: "error", text: "Не авторизован" }));
        return;
      }
      currentUser = user;
      db.updateLastSeen(user.id);

      if (!onlineUsers.has(user.id)) onlineUsers.set(user.id, new Set());
      onlineUsers.get(user.id).add(ws);

      // Broadcast online status
      broadcastOnline();
      ws.send(JSON.stringify({ type: "auth_ok", user }));
      return;
    }

    if (!currentUser) {
      ws.send(JSON.stringify({ type: "error", text: "Сначала авторизуйся" }));
      return;
    }

    // Send message
    if (msg.type === "message") {
      const { receiverId, text } = msg;
      if (!receiverId || !text?.trim()) return;

      const saved = db.saveMessage(currentUser.id, receiverId, text.trim());
      const payload = JSON.stringify({
        type: "message",
        message: {
          ...saved,
          sender_name: currentUser.display_name,
          sender_color: currentUser.avatar_color,
        },
      });

      // Send to receiver
      const receiverSockets = onlineUsers.get(receiverId);
      if (receiverSockets) {
        for (const s of receiverSockets) s.send(payload);
      }
      // Echo to sender
      ws.send(payload);
    }

    // Typing indicator
    if (msg.type === "typing") {
      const receiverSockets = onlineUsers.get(msg.receiverId);
      if (receiverSockets) {
        const payload = JSON.stringify({
          type: "typing",
          userId: currentUser.id,
          displayName: currentUser.display_name,
        });
        for (const s of receiverSockets) s.send(payload);
      }
    }

    // Mark read
    if (msg.type === "read") {
      db.markRead(msg.senderId, currentUser.id);
    }
  });

  ws.on("close", () => {
    if (currentUser) {
      db.updateLastSeen(currentUser.id);
      const sockets = onlineUsers.get(currentUser.id);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) onlineUsers.delete(currentUser.id);
      }
      broadcastOnline();
    }
  });
});

function broadcastOnline() {
  const online = Array.from(onlineUsers.keys());
  const payload = JSON.stringify({ type: "online", userIds: online });
  for (const [, sockets] of onlineUsers) {
    for (const s of sockets) s.send(payload);
  }
}

// --- Start ---
server.listen(PORT, () => {
  console.log(`🚀 Dmitry Messenger запущен: http://localhost:${PORT}`);
});
