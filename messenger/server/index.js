const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { WebSocketServer } = require("ws");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// --- Uploads directory ---
const UPLOADS_DIR = path.join(__dirname, "..", "data", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

// --- Auth helpers ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Не авторизован" });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: "Сессия истекла" });
  req.user = user;
  next();
}

// ==================== AUTH ROUTES ====================

app.post("/api/register", (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: "Все поля обязательны" });
  }
  if (username.length < 2) return res.status(400).json({ error: "Логин слишком короткий" });
  if (password.length < 3) return res.status(400).json({ error: "Пароль слишком короткий" });

  try {
    const userId = db.createUser(username, displayName, password);
    const token = db.createSession(userId);
    const user = db.getUserByToken(token);
    res.json({ token, user });
  } catch (e) {
    if (e.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Логин уже занят" });
    }
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  const user = db.authenticateUser(username, password);
  if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });

  const token = db.createSession(user.id);
  const userData = db.getUserByToken(token);
  res.json({ token, user: userData });
});

app.post("/api/logout", authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  db.deleteSession(token);
  res.json({ ok: true });
});

// ==================== USER ROUTES ====================

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/profile", authMiddleware, (req, res) => {
  const { displayName, bio } = req.body;
  const updates = {};
  if (displayName) updates.display_name = displayName;
  if (bio !== undefined) updates.bio = bio;
  db.updateProfile(req.user.id, updates);
  const user = db.getUserById(req.user.id);
  res.json({ user });
});

app.post("/api/avatar", authMiddleware, upload.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Нет файла" });
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.updateProfile(req.user.id, { avatar_url: avatarUrl });
  const user = db.getUserById(req.user.id);
  res.json({ user });
});

app.get("/api/user/:id", authMiddleware, (req, res) => {
  const user = db.getUserById(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const stats = db.getUserStats(user.id);
  res.json({ user, stats });
});

app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Нет файла" });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
});

// ==================== CHAT ROUTES ====================

app.get("/api/chats", authMiddleware, (req, res) => {
  const chats = db.getRecentChats(req.user.id);
  const unread = db.getUnreadCounts(req.user.id);
  res.json({ chats, unread });
});

app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const messages = db.getConversation(req.user.id, parseInt(req.params.userId));
  db.markRead(parseInt(req.params.userId), req.user.id);
  res.json({ messages });
});

app.get("/api/users/search", authMiddleware, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const allUsers = db.getAllUsers();
  const users = allUsers.filter(
    (u) => u.id !== req.user.id && (
      u.username.includes(q) || u.display_name.toLowerCase().includes(q)
    )
  );
  res.json({ users });
});

// ==================== GROUP ROUTES ====================

app.post("/api/groups", authMiddleware, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds || !memberIds.length) {
    return res.status(400).json({ error: "Имя группы и участники обязательны" });
  }
  const group = db.createGroup(name, req.user.id, memberIds);
  res.json({ group });
});

app.get("/api/groups/:id", authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.id);
  if (!db.isGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: "Вы не в этой группе" });
  }
  const group = db.getGroupById(groupId);
  const members = db.getGroupMembers(groupId);
  res.json({ group, members });
});

app.get("/api/groups/:id/messages", authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.id);
  if (!db.isGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: "Вы не в этой группе" });
  }
  const messages = db.getGroupMessages(groupId);
  res.json({ messages });
});

app.post("/api/groups/:id/members", authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.id);
  const { userId } = req.body;
  db.addGroupMember(groupId, userId);
  res.json({ ok: true });
});

// ==================== REACTIONS ====================

app.post("/api/messages/:id/reactions", authMiddleware, (req, res) => {
  const messageId = parseInt(req.params.id);
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: "Emoji обязателен" });
  const reaction = db.addReaction(messageId, req.user.id, emoji);
  res.json({ reaction });
});

app.delete("/api/messages/:id/reactions", authMiddleware, (req, res) => {
  const messageId = parseInt(req.params.id);
  const { emoji } = req.body;
  db.removeReaction(messageId, req.user.id, emoji);
  res.json({ ok: true });
});

// ==================== ADMIN ====================

app.get("/api/admin/stats", authMiddleware, (req, res) => {
  const stats = db.getAdminStats();
  res.json(stats);
});

// ==================== HEALTH ====================

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ==================== WebSocket ====================
const wss = new WebSocketServer({ server });
const onlineUsers = new Map(); // userId -> Set<ws>

function broadcastOnline() {
  const onlineIds = [...onlineUsers.keys()];
  const payload = JSON.stringify({ type: "online", userIds: onlineIds });
  for (const [, sockets] of onlineUsers) {
    for (const s of sockets) s.send(payload);
  }
}

wss.on("connection", (ws) => {
  let currentUser = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Auth
    if (msg.type === "auth") {
      const user = db.getUserByToken(msg.token);
      if (!user) return ws.send(JSON.stringify({ type: "error", error: "auth_failed" }));
      currentUser = user;
      if (!onlineUsers.has(user.id)) onlineUsers.set(user.id, new Set());
      onlineUsers.get(user.id).add(ws);
      broadcastOnline();
      return;
    }

    if (!currentUser) return;

    // Direct message
    if (msg.type === "message") {
      const saved = db.saveMessage(
        currentUser.id,
        msg.receiverId,
        msg.text || "",
        msg.messageType || "text",
        msg.fileUrl || null,
        msg.duration || 0,
        null
      );

      const payload = JSON.stringify({
        type: "message",
        message: {
          ...saved,
          sender_name: currentUser.display_name,
          sender_color: currentUser.avatar_color,
          sender_avatar_url: currentUser.avatar_url,
          reactions: [],
        },
      });

      // Send to sender
      const senderSockets = onlineUsers.get(currentUser.id);
      if (senderSockets) for (const s of senderSockets) s.send(payload);

      // Send to receiver
      const receiverSockets = onlineUsers.get(msg.receiverId);
      if (receiverSockets) for (const s of receiverSockets) s.send(payload);
    }

    // Group message
    if (msg.type === "group_message") {
      const groupId = msg.groupId;
      if (!db.isGroupMember(groupId, currentUser.id)) return;

      const saved = db.saveMessage(
        currentUser.id,
        null,
        msg.text || "",
        msg.messageType || "text",
        msg.fileUrl || null,
        msg.duration || 0,
        groupId
      );

      const members = db.getGroupMembers(groupId);
      const payload = JSON.stringify({
        type: "group_message",
        groupId,
        message: {
          ...saved,
          sender_name: currentUser.display_name,
          sender_color: currentUser.avatar_color,
          sender_avatar_url: currentUser.avatar_url,
          reactions: [],
        },
      });

      for (const member of members) {
        const sockets = onlineUsers.get(member.user_id);
        if (sockets) for (const s of sockets) s.send(payload);
      }
    }

    // Typing indicator
    if (msg.type === "typing") {
      const payload = JSON.stringify({
        type: "typing",
        userId: currentUser.id,
        name: currentUser.display_name,
      });

      if (msg.groupId) {
        const members = db.getGroupMembers(msg.groupId);
        for (const member of members) {
          if (member.user_id === currentUser.id) continue;
          const sockets = onlineUsers.get(member.user_id);
          if (sockets) for (const s of sockets) s.send(payload);
        }
      } else if (msg.receiverId) {
        const receiverSockets = onlineUsers.get(msg.receiverId);
        if (receiverSockets) for (const s of receiverSockets) s.send(payload);
      }
    }

    // Mark read
    if (msg.type === "read") {
      db.markRead(msg.senderId, currentUser.id);
    }

    // Reaction via WS (broadcast to relevant users)
    if (msg.type === "reaction") {
      const { messageId, emoji, action } = msg;
      if (action === "add") {
        db.addReaction(messageId, currentUser.id, emoji);
      } else {
        db.removeReaction(messageId, currentUser.id, emoji);
      }
      const reactions = db.getReactions(messageId);
      const payload = JSON.stringify({
        type: "reaction_update",
        messageId,
        reactions,
      });
      // Broadcast to all online users (simplified)
      for (const [, sockets] of onlineUsers) {
        for (const s of sockets) s.send(payload);
      }
    }

    // Call signaling
    if (msg.type === "call_offer" || msg.type === "call_answer" || msg.type === "call_ice" || msg.type === "call_end") {
      const targetSockets = onlineUsers.get(msg.targetId);
      if (targetSockets) {
        const payload = JSON.stringify({
          ...msg,
          callerId: currentUser.id,
          callerName: currentUser.display_name,
        });
        for (const s of targetSockets) s.send(payload);
      }
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

// --- Start ---
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Dmitry Messenger запущен: http://localhost:${PORT}`);
  const nets = require("os").networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`📱 Для телефона в одной сети: http://${net.address}:${PORT}`);
      }
    }
  }
});
