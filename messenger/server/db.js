const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_PATH = path.join(__dirname, "..", "data", "messenger.db");

// Ensure data directory exists
const fs = require("fs");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#7c3aed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_messages_pair
    ON messages(sender_id, receiver_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token);
`);

// --- Avatar colors ---
const COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706",
  "#dc2626", "#db2777", "#4f46e5", "#0891b2",
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// --- User operations ---
function createUser(username, displayName, password) {
  const hash = bcrypt.hashSync(password, 10);
  const color = randomColor();
  const stmt = db.prepare(
    "INSERT INTO users (username, display_name, password_hash, avatar_color) VALUES (?, ?, ?, ?)"
  );
  const result = stmt.run(username.toLowerCase(), displayName, hash, color);
  return result.lastInsertRowid;
}

function authenticateUser(username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return user;
}

function createSession(userId) {
  const token = uuidv4();
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

function getUserByToken(token) {
  const row = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.last_seen
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);
  return row || null;
}

function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function updateLastSeen(userId) {
  db.prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
}

function getAllUsers() {
  return db.prepare(
    "SELECT id, username, display_name, avatar_color, last_seen FROM users ORDER BY display_name"
  ).all();
}

function getUserById(id) {
  return db.prepare(
    "SELECT id, username, display_name, avatar_color, last_seen FROM users WHERE id = ?"
  ).get(id);
}

// --- Message operations ---
function saveMessage(senderId, receiverId, text) {
  const stmt = db.prepare(
    "INSERT INTO messages (sender_id, receiver_id, text) VALUES (?, ?, ?)"
  );
  const result = stmt.run(senderId, receiverId, text);
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
}

function getConversation(userId1, userId2, limit = 100) {
  return db.prepare(`
    SELECT m.*, u.display_name as sender_name, u.avatar_color as sender_color
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
    LIMIT ?
  `).all(userId1, userId2, userId2, userId1, limit);
}

function markRead(senderId, receiverId) {
  db.prepare(
    "UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ? AND read = 0"
  ).run(senderId, receiverId);
}

function getUnreadCounts(userId) {
  const rows = db.prepare(`
    SELECT sender_id, COUNT(*) as count
    FROM messages
    WHERE receiver_id = ? AND read = 0
    GROUP BY sender_id
  `).all(userId);
  const counts = {};
  for (const r of rows) counts[r.sender_id] = r.count;
  return counts;
}

function getRecentChats(userId) {
  return db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.last_seen,
           m.text as last_message, m.created_at as last_message_at, m.sender_id as last_sender_id
    FROM users u
    JOIN (
      SELECT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id,
        MAX(id) as max_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY other_id
    ) latest ON u.id = latest.other_id
    JOIN messages m ON m.id = latest.max_id
    ORDER BY m.created_at DESC
  `).all(userId, userId, userId);
}

module.exports = {
  createUser,
  authenticateUser,
  createSession,
  getUserByToken,
  deleteSession,
  updateLastSeen,
  getAllUsers,
  getUserById,
  saveMessage,
  getConversation,
  markRead,
  getUnreadCounts,
  getRecentChats,
};
