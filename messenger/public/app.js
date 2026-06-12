/* ===== Dmitry Messenger — Frontend ===== */

const API = "/api";
let token = localStorage.getItem("token");
let currentUser = null;
let activeChatUserId = null;
let ws = null;
let onlineUserIds = new Set();
let typingTimeout = null;

// --- DOM ---
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const authScreen = $("#auth-screen");
const messengerScreen = $("#messenger-screen");
const loginForm = $("#login-form");
const registerForm = $("#register-form");
const authError = $("#auth-error");
const chatList = $("#chat-list");
const searchResults = $("#search-results");
const searchInput = $("#search-input");
const messagesEl = $("#messages");
const messagesContainer = $("#messages-container");
const messageInput = $("#message-input");
const noChat = $("#no-chat");
const activeChat = $("#active-chat");
const typingIndicator = $("#typing-indicator");

// --- Init ---
async function init() {
  setupAuthUI();
  if (token) {
    try {
      const res = await api("GET", "/me");
      currentUser = res.user;
      showMessenger();
    } catch {
      localStorage.removeItem("token");
      token = null;
      showAuth();
    }
  } else {
    showAuth();
  }
}

// --- API helper ---
async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка");
  return data;
}

// --- Auth ---
function showAuth() {
  authScreen.classList.remove("hidden");
  messengerScreen.classList.add("hidden");
}

function showMessenger() {
  authScreen.classList.add("hidden");
  messengerScreen.classList.remove("hidden");
  $("#my-name").textContent = currentUser.display_name;
  renderAvatar($("#my-avatar"), currentUser);
  connectWebSocket();
  loadChats();
}

function setupAuthUI() {
  $("#show-register").onclick = (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    authError.classList.add("hidden");
  };
  $("#show-login").onclick = (e) => {
    e.preventDefault();
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    authError.classList.add("hidden");
  };

  $("#login-btn").onclick = async () => {
    const username = $("#login-username").value.trim();
    const password = $("#login-password").value;
    if (!username || !password) return showError("Заполни все поля");
    try {
      const res = await api("POST", "/login", { username, password });
      token = res.token;
      localStorage.setItem("token", token);
      currentUser = res.user;
      showMessenger();
    } catch (e) {
      showError(e.message);
    }
  };

  $("#register-btn").onclick = async () => {
    const displayName = $("#reg-display").value.trim();
    const username = $("#reg-username").value.trim();
    const password = $("#reg-password").value;
    if (!displayName || !username || !password) return showError("Заполни все поля");
    try {
      const res = await api("POST", "/register", { username, displayName, password });
      token = res.token;
      localStorage.setItem("token", token);
      currentUser = res.user;
      showMessenger();
    } catch (e) {
      showError(e.message);
    }
  };

  // Enter key
  for (const input of $$("#login-form input")) {
    input.onkeydown = (e) => { if (e.key === "Enter") $("#login-btn").click(); };
  }
  for (const input of $$("#register-form input")) {
    input.onkeydown = (e) => { if (e.key === "Enter") $("#register-btn").click(); };
  }

  // Logout
  $("#logout-btn").onclick = async () => {
    try { await api("POST", "/logout"); } catch {}
    localStorage.removeItem("token");
    token = null;
    currentUser = null;
    if (ws) ws.close();
    showAuth();
  };

  // Search
  let searchTimer = null;
  searchInput.oninput = () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (!q) {
      searchResults.classList.add("hidden");
      chatList.classList.remove("hidden");
      return;
    }
    searchTimer = setTimeout(() => searchUsers(q), 300);
  };

  // Send message
  $("#send-btn").onclick = sendMessage;
  messageInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else {
      sendTyping();
    }
  };

  // Back button (mobile)
  $("#back-btn").onclick = () => {
    $(".messenger").classList.remove("chat-open");
    activeChatUserId = null;
  };
}

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

// --- WebSocket ---
function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === "message") {
      handleIncomingMessage(msg.message);
    }

    if (msg.type === "online") {
      onlineUserIds = new Set(msg.userIds);
      updateOnlineStatus();
    }

    if (msg.type === "typing") {
      if (msg.userId === activeChatUserId) {
        showTyping(msg.displayName);
      }
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

// --- Chats ---
async function loadChats() {
  try {
    const res = await api("GET", "/chats");
    renderChatList(res.chats, res.unread);
  } catch {}
}

function renderChatList(chats, unread) {
  chatList.innerHTML = "";
  if (chats.length === 0) {
    chatList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Нет чатов. Найди пользователя через поиск ↑</div>';
    return;
  }
  for (const chat of chats) {
    const item = createChatItem(chat, unread[chat.id] || 0);
    chatList.appendChild(item);
  }
}

function createChatItem(user, unreadCount) {
  const div = document.createElement("div");
  div.className = "chat-item" + (user.id === activeChatUserId ? " active" : "");
  div.onclick = () => openChat(user);

  const avatar = document.createElement("div");
  avatar.className = "avatar-sm";
  renderAvatar(avatar, user);

  const body = document.createElement("div");
  body.className = "chat-item-body";

  const top = document.createElement("div");
  top.className = "chat-item-top";
  const name = document.createElement("span");
  name.className = "chat-item-name";
  name.textContent = user.display_name;
  const time = document.createElement("span");
  time.className = "chat-item-time";
  time.textContent = user.last_message_at ? formatTime(user.last_message_at) : "";
  top.append(name, time);

  const bottom = document.createElement("div");
  bottom.className = "chat-item-bottom";
  const preview = document.createElement("span");
  preview.className = "chat-item-preview";
  if (user.last_message) {
    const prefix = user.last_sender_id === currentUser.id ? "Ты: " : "";
    preview.textContent = prefix + user.last_message;
  }
  bottom.appendChild(preview);

  if (unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = unreadCount;
    bottom.appendChild(badge);
  }

  body.append(top, bottom);
  div.append(avatar, body);
  return div;
}

// --- Search ---
async function searchUsers(q) {
  try {
    const res = await api("GET", `/search?q=${encodeURIComponent(q)}`);
    chatList.classList.add("hidden");
    searchResults.classList.remove("hidden");
    searchResults.innerHTML = "";
    if (res.users.length === 0) {
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Никого не найдено</div>';
      return;
    }
    for (const user of res.users) {
      const item = createChatItem({ ...user, last_message: null, last_message_at: null, last_sender_id: null }, 0);
      item.onclick = () => {
        searchInput.value = "";
        searchResults.classList.add("hidden");
        chatList.classList.remove("hidden");
        openChat(user);
      };
      searchResults.appendChild(item);
    }
  } catch {}
}

// --- Open Chat ---
async function openChat(user) {
  activeChatUserId = user.id;
  $(".messenger").classList.add("chat-open");
  noChat.classList.add("hidden");
  activeChat.classList.remove("hidden");
  typingIndicator.classList.add("hidden");

  // Header
  renderAvatar($("#chat-avatar"), user);
  $("#chat-name").textContent = user.display_name;
  updateChatStatus(user.id);

  // Load messages
  messagesEl.innerHTML = "";
  try {
    const res = await api("GET", `/messages/${user.id}`);
    renderMessages(res.messages);
    // Mark as read
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "read", senderId: user.id }));
    }
  } catch {}

  messageInput.focus();
  loadChats(); // refresh unread counts

  // Highlight active chat
  for (const item of $$(".chat-item")) item.classList.remove("active");
}

// --- Messages ---
function renderMessages(messages) {
  messagesEl.innerHTML = "";
  let lastDate = null;

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at + "Z").toLocaleDateString("ru-RU");
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const divider = document.createElement("div");
      divider.className = "message-date-divider";
      divider.innerHTML = `<span>${formatDate(msg.created_at)}</span>`;
      messagesEl.appendChild(divider);
    }

    const div = document.createElement("div");
    const isOut = msg.sender_id === currentUser.id;
    div.className = "message " + (isOut ? "message-out" : "message-in");

    const textEl = document.createElement("div");
    textEl.textContent = msg.text;

    const timeEl = document.createElement("div");
    timeEl.className = "message-time";
    timeEl.textContent = formatTimeOnly(msg.created_at);

    div.append(textEl, timeEl);
    messagesEl.appendChild(div);
  }

  scrollToBottom();
}

function handleIncomingMessage(msg) {
  const isForActiveChat =
    (msg.sender_id === activeChatUserId && msg.receiver_id === currentUser.id) ||
    (msg.sender_id === currentUser.id && msg.receiver_id === activeChatUserId);

  if (isForActiveChat) {
    const div = document.createElement("div");
    const isOut = msg.sender_id === currentUser.id;
    div.className = "message " + (isOut ? "message-out" : "message-in");

    const textEl = document.createElement("div");
    textEl.textContent = msg.text;

    const timeEl = document.createElement("div");
    timeEl.className = "message-time";
    timeEl.textContent = formatTimeOnly(msg.created_at);

    div.append(textEl, timeEl);
    messagesEl.appendChild(div);
    scrollToBottom();

    // Mark as read
    if (msg.sender_id === activeChatUserId && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "read", senderId: activeChatUserId }));
    }

    typingIndicator.classList.add("hidden");
  }

  loadChats();
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeChatUserId) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "message",
      receiverId: activeChatUserId,
      text,
    }));
  }

  messageInput.value = "";
  messageInput.focus();
}

function sendTyping() {
  if (!activeChatUserId || !ws || ws.readyState !== WebSocket.OPEN) return;
  clearTimeout(typingTimeout);
  ws.send(JSON.stringify({ type: "typing", receiverId: activeChatUserId }));
}

function showTyping(name) {
  typingIndicator.classList.remove("hidden");
  $("#typing-name").textContent = name;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingIndicator.classList.add("hidden");
  }, 3000);
}

// --- Online Status ---
function updateOnlineStatus() {
  if (activeChatUserId) updateChatStatus(activeChatUserId);
  // Update chat list items too
  loadChats();
}

function updateChatStatus(userId) {
  const statusEl = $("#chat-status");
  if (onlineUserIds.has(userId)) {
    statusEl.textContent = "в сети";
    statusEl.className = "chat-status online";
  } else {
    statusEl.textContent = "не в сети";
    statusEl.className = "chat-status";
  }
}

// --- Helpers ---
function renderAvatar(el, user) {
  el.style.background = user.avatar_color;
  el.textContent = (user.display_name || "?")[0];
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function formatTime(dateStr) {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return d.toLocaleDateString("ru-RU", { weekday: "short" });
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatTimeOnly(dateStr) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// --- Start ---
init();
