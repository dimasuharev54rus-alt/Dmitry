const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

// --- JSON file storage ---
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  }
  return {
    users: [],
    sessions: [],
    messages: [],
    groups: [],
    groupMembers: [],
    reactions: [],
    nextUserId: 1,
    nextMessageId: 1,
    nextGroupId: 1,
  };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

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

// ==================== USER OPERATIONS ====================

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
    bio: "",
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
    bio: user.bio || "",
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
  if (updates.bio !== undefined) user.bio = updates.bio;
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
      bio: u.bio || "",
      last_seen: u.last_seen,
      created_at: u.created_at,
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
    bio: user.bio || "",
    last_seen: user.last_seen,
    created_at: user.created_at,
  };
}

function getUserStats(userId) {
  const db = loadDB();
  const sent = db.messages.filter((m) => m.sender_id === userId);
  const mediaCount = sent.filter((m) => m.message_type && m.message_type !== "text").length;
  const textCount = sent.filter((m) => !m.message_type || m.message_type === "text").length;
  return { totalSent: sent.length, mediaCount, textCount };
}

// ==================== MESSAGE OPERATIONS ====================

function saveMessage(senderId, receiverId, text, messageType, fileUrl, duration, groupId) {
  const db = loadDB();
  const msg = {
    id: db.nextMessageId++,
    sender_id: senderId,
    receiver_id: receiverId || null,
    group_id: groupId || null,
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
        !m.group_id &&
        ((m.sender_id === userId1 && m.receiver_id === userId2) ||
        (m.sender_id === userId2 && m.receiver_id === userId1))
    )
    .sort((a, b) => a.id - b.id)
    .slice(-limit);

  return msgs.map((m) => {
    const sender = db.users.find((u) => u.id === m.sender_id);
    const reactions = db.reactions ? db.reactions.filter((r) => r.message_id === m.id) : [];
    return {
      ...m,
      sender_name: sender ? sender.display_name : "?",
      sender_color: sender ? sender.avatar_color : "#666",
      sender_avatar_url: sender ? (sender.avatar_url || null) : null,
      reactions,
    };
  });
}

function getGroupMessages(groupId, limit = 100) {
  const db = loadDB();
  const msgs = db.messages
    .filter((m) => m.group_id === groupId)
    .sort((a, b) => a.id - b.id)
    .slice(-limit);

  return msgs.map((m) => {
    const sender = db.users.find((u) => u.id === m.sender_id);
    const reactions = db.reactions ? db.reactions.filter((r) => r.message_id === m.id) : [];
    return {
      ...m,
      sender_name: sender ? sender.display_name : "?",
      sender_color: sender ? sender.avatar_color : "#666",
      sender_avatar_url: sender ? (sender.avatar_url || null) : null,
      reactions,
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
    if (m.group_id) continue;
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
    if (msg.message_type === "voice") lastMessage = "🎤 Голосовое";
    else if (msg.message_type === "video") lastMessage = "🎥 Кружок";
    else if (msg.message_type === "image") lastMessage = "📷 Фото";
    else if (msg.message_type === "sticker") lastMessage = "🎨 Стикер";

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
      isGroup: false,
    });
  }

  // Add group chats
  const userGroups = (db.groupMembers || []).filter((gm) => gm.user_id === userId);
  for (const gm of userGroups) {
    const group = (db.groups || []).find((g) => g.id === gm.group_id);
    if (!group) continue;
    const lastGroupMsg = db.messages
      .filter((m) => m.group_id === group.id)
      .sort((a, b) => b.id - a.id)[0];

    let lastMessage = "";
    let lastMessageAt = group.created_at;
    let lastSenderId = null;
    if (lastGroupMsg) {
      lastMessage = lastGroupMsg.text || "";
      if (lastGroupMsg.message_type === "voice") lastMessage = "🎤 Голосовое";
      else if (lastGroupMsg.message_type === "video") lastMessage = "🎥 Кружок";
      else if (lastGroupMsg.message_type === "image") lastMessage = "📷 Фото";
      lastMessageAt = lastGroupMsg.created_at;
      lastSenderId = lastGroupMsg.sender_id;
    }

    chats.push({
      id: group.id,
      display_name: group.name,
      avatar_color: group.avatar_color,
      avatar_url: group.avatar_url || null,
      last_message: lastMessage,
      last_message_at: lastMessageAt,
      last_sender_id: lastSenderId,
      isGroup: true,
      memberCount: userGroups.filter((x) => x.group_id === group.id).length,
    });
  }

  chats.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
  return chats;
}

// ==================== REACTIONS ====================

function addReaction(messageId, userId, emoji) {
  const db = loadDB();
  if (!db.reactions) db.reactions = [];
  const existing = db.reactions.find((r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji);
  if (existing) return null;
  const reaction = { message_id: messageId, user_id: userId, emoji, created_at: now() };
  db.reactions.push(reaction);
  saveDB(db);
  return reaction;
}

function removeReaction(messageId, userId, emoji) {
  const db = loadDB();
  if (!db.reactions) return;
  db.reactions = db.reactions.filter(
    (r) => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji)
  );
  saveDB(db);
}

function getReactions(messageId) {
  const db = loadDB();
  if (!db.reactions) return [];
  return db.reactions.filter((r) => r.message_id === messageId);
}

// ==================== GROUP OPERATIONS ====================

function createGroup(name, creatorId, memberIds) {
  const db = loadDB();
  if (!db.groups) db.groups = [];
  if (!db.groupMembers) db.groupMembers = [];

  const group = {
    id: db.nextGroupId++,
    name,
    created_by: creatorId,
    avatar_color: randomColor(),
    avatar_url: null,
    created_at: now(),
  };
  db.groups.push(group);

  const allMembers = [creatorId, ...memberIds.filter((id) => id !== creatorId)];
  for (const uid of allMembers) {
    db.groupMembers.push({
      group_id: group.id,
      user_id: uid,
      role: uid === creatorId ? "admin" : "member",
      joined_at: now(),
    });
  }

  saveDB(db);
  return group;
}

function getGroupById(groupId) {
  const db = loadDB();
  if (!db.groups) return null;
  return db.groups.find((g) => g.id === groupId) || null;
}

function getGroupMembers(groupId) {
  const db = loadDB();
  if (!db.groupMembers) return [];
  const memberRecords = db.groupMembers.filter((gm) => gm.group_id === groupId);
  return memberRecords.map((gm) => {
    const user = db.users.find((u) => u.id === gm.user_id);
    return {
      ...gm,
      display_name: user ? user.display_name : "?",
      avatar_color: user ? user.avatar_color : "#666",
      avatar_url: user ? (user.avatar_url || null) : null,
      username: user ? user.username : "?",
    };
  });
}

function addGroupMember(groupId, userId) {
  const db = loadDB();
  if (!db.groupMembers) db.groupMembers = [];
  const exists = db.groupMembers.find((gm) => gm.group_id === groupId && gm.user_id === userId);
  if (exists) return;
  db.groupMembers.push({ group_id: groupId, user_id: userId, role: "member", joined_at: now() });
  saveDB(db);
}

function isGroupMember(groupId, userId) {
  const db = loadDB();
  if (!db.groupMembers) return false;
  return db.groupMembers.some((gm) => gm.group_id === groupId && gm.user_id === userId);
}

// ==================== ADMIN ====================

function getAdminStats() {
  const db = loadDB();
  return {
    totalUsers: db.users.length,
    totalMessages: db.messages.length,
    totalGroups: (db.groups || []).length,
    users: db.users.map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url || null,
      created_at: u.created_at,
      last_seen: u.last_seen,
      messageCount: db.messages.filter((m) => m.sender_id === u.id).length,
    })),
  };
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
  getUserStats,
  saveMessage,
  getConversation,
  getGroupMessages,
  markRead,
  getUnreadCounts,
  getRecentChats,
  addReaction,
  removeReaction,
  getReactions,
  createGroup,
  getGroupById,
  getGroupMembers,
  addGroupMember,
  isGroupMember,
  getAdminStats,
};
