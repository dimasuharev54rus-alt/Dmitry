const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

// --- JSON file storage (no native modules needed) ---
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  }
  return { users: [], sessions: [], messages: [], nextUserId: 1, nextMessageId: 1 };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Init
if (!fs.existsSync(DB_FILE)) saveDB(loadDB());

// --- Avatar colors ---
const COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706",
  "#dc2626", "#db2777", "#4f46e5", "#0891b2",
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function now() {
  return new Date().toISOString();
}

// --- User operations ---
function createUser(username, displayName, password) {
  const db = loadDB();
  const existing = db.users.find((u) => u.username === username.toLowerCase());
  if (existing) throw new Error("UNIQUE constraint failed");

  const hash = bcrypt.hashSync(password, 10);
  const user = {
    id: db.nextUserId++,
    username: username.toLowerCase(),
    display_name: displayName,
    password_hash: hash,
    avatar_color: randomColor(),
    avatar_url: null,
    created_at: now(),
    last_seen: now(),
  };
  db.users.push(user);
  saveDB(db);
  return user.id;
}

function authenticateUser(username, password) {
  const db = loadDB();
  const user = db.users.find((u) => u.username === username.toLowerCase());
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return user;
}

function createSession(userId) {
  const db = loadDB();
  const token = uuidv4();
  db.sessions.push({ token, user_id: userId, created_at: now() });
  saveDB(db);
  return token;
}

function getUserByToken(token) {
  const db = loadDB();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.user_id);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_color: user.avatar_color,
    avatar_url: user.avatar_url || null,
    last_seen: user.last_seen,
  };
}

function deleteSession(token) {
  const db = loadDB();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  saveDB(db);
}

function updateLastSeen(userId) {
  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.last_seen = now();
    saveDB(db);
  }
}

function updateProfile(userId, updates) {
  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;
  if (updates.display_name) user.display_name = updates.display_name;
  if (updates.avatar_url !== undefined) user.avatar_url = updates.avatar_url;
  saveDB(db);
}

function getAllUsers() {
  const db = loadDB();
  return db.users
    .map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url || null,
      last_seen: u.last_seen,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function getUserById(id) {
  const db = loadDB();
  const user = db.users.find((u) => u.id === id);
  if (!user) return undefined;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_color: user.avatar_color,
    avatar_url: user.avatar_url || null,
    last_seen: user.last_seen,
  };
}

// --- Message operations ---
function saveMessage(senderId, receiverId, text, messageType, fileUrl, duration) {
  const db = loadDB();
  const msg = {
    id: db.nextMessageId++,
    sender_id: senderId,
    receiver_id: receiverId,
    text: text || "",
    message_type: messageType || "text",
    file_url: fileUrl || null,
    duration: duration || 0,
    created_at: now(),
    read: 0,
  };
  db.messages.push(msg);
  saveDB(db);
  return msg;
}

function getConversation(userId1, userId2, limit = 100) {
  const db = loadDB();
  const msgs = db.messages
    .filter(
      (m) =>
        (m.sender_id === userId1 && m.receiver_id === userId2) ||
        (m.sender_id === userId2 && m.receiver_id === userId1)
    )
    .sort((a, b) => a.id - b.id)
    .slice(-limit);

  return msgs.map((m) => {
    const sender = db.users.find((u) => u.id === m.sender_id);
    return {
      ...m,
      sender_name: sender ? sender.display_name : "?",
      sender_color: sender ? sender.avatar_color : "#666",
      sender_avatar_url: sender ? (sender.avatar_url || null) : null,
    };
  });
}

function markRead(senderId, receiverId) {
  const db = loadDB();
  let changed = false;
  for (const m of db.messages) {
    if (m.sender_id === senderId && m.receiver_id === receiverId && !m.read) {
      m.read = 1;
      changed = true;
    }
  }
  if (changed) saveDB(db);
}

function getUnreadCounts(userId) {
  const db = loadDB();
  const counts = {};
  for (const m of db.messages) {
    if (m.receiver_id === userId && !m.read) {
      counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
    }
  }
  return counts;
}

function getRecentChats(userId) {
  const db = loadDB();

  const latest = {};
  for (const m of db.messages) {
    if (m.sender_id !== userId && m.receiver_id !== userId) continue;
    const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    if (!latest[otherId] || m.id > latest[otherId].id) {
      latest[otherId] = m;
    }
  }

  const chats = [];
  for (const [otherIdStr, msg] of Object.entries(latest)) {
    const otherId = parseInt(otherIdStr);
    const user = db.users.find((u) => u.id === otherId);
    if (!user) continue;

    let lastMessage = msg.text;
    if (msg.message_type === "voice") lastMessage = "🎤 Голосовое сообщение";
    else if (msg.message_type === "video") lastMessage = "🎥 Видео-кружок";
    else if (msg.message_type === "image") lastMessage = "📷 Фото";

    chats.push({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_color: user.avatar_color,
      avatar_url: user.avatar_url || null,
      last_seen: user.last_seen,
      last_message: lastMessage,
      last_message_at: msg.created_at,
      last_sender_id: msg.sender_id,
    });
  }

  chats.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
  return chats;
}

module.exports = {
  createUser,
  authenticateUser,
  createSession,
  getUserByToken,
  deleteSession,
  updateLastSeen,
  updateProfile,
  getAllUsers,
  getUserById,
  saveMessage,
  getConversation,
  markRead,
  getUnreadCounts,
  getRecentChats,
};
