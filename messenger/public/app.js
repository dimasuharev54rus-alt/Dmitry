/* ===== Dmitry Messenger — Frontend ===== */

const API = "/api";
let token = localStorage.getItem("token");
let currentUser = null;
let activeChatUserId = null;
let ws = null;
let onlineUserIds = new Set();
let typingTimeout = null;

// Media recording
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let videoStream = null;

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
  setupMediaUI();
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

async function uploadFile(file, endpoint = "/api/upload", fieldName = "file") {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
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

  // Show/hide send button based on input
  messageInput.oninput = () => {
    const hasText = messageInput.value.trim().length > 0;
    $("#send-btn").classList.toggle("hidden", !hasText);
    $("#voice-btn").classList.toggle("hidden", hasText);
    $("#video-btn").classList.toggle("hidden", hasText);
  };

  // Back button (mobile)
  $("#back-btn").onclick = () => {
    $(".messenger").classList.remove("chat-open");
    activeChatUserId = null;
  };

  // Settings
  $("#open-settings").onclick = openSettings;
  $("#close-settings").onclick = () => $("#settings-modal").classList.add("hidden");
  $("#save-settings").onclick = saveSettings;
  $("#avatar-input").onchange = uploadAvatar;

  // Attach photo
  $("#attach-btn").onclick = () => $("#file-input").click();
  $("#file-input").onchange = handleFileAttach;

  // Image preview close
  $("#close-image-preview").onclick = () => $("#image-preview-modal").classList.add("hidden");
  $("#image-preview-modal").onclick = (e) => {
    if (e.target === $("#image-preview-modal")) $("#image-preview-modal").classList.add("hidden");
  };
}

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

// --- Settings ---
function openSettings() {
  const modal = $("#settings-modal");
  modal.classList.remove("hidden");
  renderAvatar($("#settings-avatar"), currentUser, true);
  $("#settings-name").value = currentUser.display_name;
  $("#settings-username").value = currentUser.username;
}

async function saveSettings() {
  const displayName = $("#settings-name").value.trim();
  if (!displayName) return;
  try {
    const res = await api("POST", "/profile", { displayName });
    currentUser = res.user;
    $("#my-name").textContent = currentUser.display_name;
    renderAvatar($("#my-avatar"), currentUser);
    $("#settings-modal").classList.add("hidden");
  } catch (e) {
    alert(e.message);
  }
}

async function uploadAvatar() {
  const file = $("#avatar-input").files[0];
  if (!file) return;
  try {
    const res = await uploadFile(file, "/api/avatar", "avatar");
    currentUser = res.user;
    renderAvatar($("#my-avatar"), currentUser);
    renderAvatar($("#settings-avatar"), currentUser, true);
  } catch (e) {
    alert("Ошибка загрузки: " + e.message);
  }
}

// --- File Attach ---
async function handleFileAttach() {
  const file = $("#file-input").files[0];
  if (!file || !activeChatUserId) return;
  try {
    const res = await uploadFile(file);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "message",
        receiverId: activeChatUserId,
        text: "",
        messageType: "image",
        fileUrl: res.url,
      }));
    }
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
  $("#file-input").value = "";
}

// --- Media Recording (Voice + Video) ---
function setupMediaUI() {
  // Voice
  $("#voice-btn").onclick = startVoiceRecording;
  $("#voice-cancel").onclick = cancelRecording;
  $("#voice-send").onclick = () => stopAndSend("voice");

  // Video
  $("#video-btn").onclick = startVideoRecording;
  $("#video-cancel").onclick = cancelRecording;
  $("#video-send").onclick = () => stopAndSend("video");
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMime("audio") });
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.start();
    startTimer("voice-timer");
    $("#voice-overlay").classList.remove("hidden");
  } catch (e) {
    alert("Нет доступа к микрофону");
  }
}

async function startVideoRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    videoStream = stream;
    const preview = $("#video-preview");
    preview.srcObject = stream;

    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMime("video") });
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.start();
    startTimer("video-timer");
    $("#video-overlay").classList.remove("hidden");
  } catch (e) {
    alert("Нет доступа к камере");
  }
}

function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  stopAllTracks();
  clearTimer();
  $("#voice-overlay").classList.add("hidden");
  $("#video-overlay").classList.add("hidden");
}

function stopAndSend(msgType) {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return;
  const duration = recordingSeconds;

  mediaRecorder.onstop = async () => {
    const ext = msgType === "voice" ? ".webm" : ".webm";
    const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || "audio/webm" });
    const file = new File([blob], `${msgType}_${Date.now()}${ext}`, { type: blob.type });

    try {
      const res = await uploadFile(file);
      if (ws && ws.readyState === WebSocket.OPEN && activeChatUserId) {
        ws.send(JSON.stringify({
          type: "message",
          receiverId: activeChatUserId,
          text: "",
          messageType: msgType,
          fileUrl: res.url,
          duration: duration,
        }));
      }
    } catch (e) {
      alert("Ошибка отправки: " + e.message);
    }

    stopAllTracks();
    clearTimer();
    $("#voice-overlay").classList.add("hidden");
    $("#video-overlay").classList.add("hidden");
  };

  mediaRecorder.stop();
}

function stopAllTracks() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }
  if (mediaRecorder && mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }
  mediaRecorder = null;
  recordedChunks = [];
}

function startTimer(elId) {
  recordingSeconds = 0;
  updateTimerDisplay(elId);
  recordingTimer = setInterval(() => {
    recordingSeconds++;
    updateTimerDisplay(elId);
  }, 1000);
}

function clearTimer() {
  clearInterval(recordingTimer);
  recordingSeconds = 0;
}

function updateTimerDisplay(elId) {
  const m = Math.floor(recordingSeconds / 60);
  const s = recordingSeconds % 60;
  $(`#${elId}`).textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

function getSupportedMime(kind) {
  if (kind === "video") {
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) return "video/webm;codecs=vp9,opus";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) return "video/webm;codecs=vp8,opus";
    if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
    return "video/mp4";
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/mp4";
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

  renderAvatar($("#chat-avatar"), user);
  $("#chat-name").textContent = user.display_name;
  updateChatStatus(user.id);

  messagesEl.innerHTML = "";
  try {
    const res = await api("GET", `/messages/${user.id}`);
    renderMessages(res.messages);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "read", senderId: user.id }));
    }
  } catch {}

  messageInput.focus();
  loadChats();
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
    messagesEl.appendChild(createMessageEl(msg));
  }
  scrollToBottom();
}

function createMessageEl(msg) {
  const div = document.createElement("div");
  const isOut = msg.sender_id === currentUser.id;
  const msgType = msg.message_type || "text";
  div.className = "message " + (isOut ? "message-out" : "message-in");
  if (msgType === "video") div.classList.add("message-video");

  // Content based on type
  if (msgType === "image") {
    const img = document.createElement("img");
    img.className = "message-image";
    img.src = msg.file_url;
    img.alt = "Фото";
    img.onclick = () => {
      $("#image-preview-img").src = msg.file_url;
      $("#image-preview-modal").classList.remove("hidden");
    };
    div.appendChild(img);
  } else if (msgType === "voice") {
    const voiceDiv = document.createElement("div");
    voiceDiv.className = "message-voice";
    const playBtn = document.createElement("button");
    playBtn.className = "voice-play-btn";
    playBtn.textContent = "▶";
    const waveform = document.createElement("div");
    waveform.className = "voice-waveform";
    for (let i = 0; i < 20; i++) {
      const bar = document.createElement("div");
      bar.className = "wave-bar";
      bar.style.height = `${Math.random() * 20 + 5}px`;
      waveform.appendChild(bar);
    }
    const dur = document.createElement("span");
    dur.className = "voice-duration";
    dur.textContent = formatDuration(msg.duration);
    voiceDiv.append(playBtn, waveform, dur);
    div.appendChild(voiceDiv);

    // Audio playback
    let audio = null;
    let playing = false;
    playBtn.onclick = () => {
      if (playing) {
        audio.pause();
        audio.currentTime = 0;
        playBtn.textContent = "▶";
        playing = false;
      } else {
        audio = new Audio(msg.file_url);
        audio.play();
        playBtn.textContent = "⏸";
        playing = true;
        audio.onended = () => { playBtn.textContent = "▶"; playing = false; };
      }
    };
  } else if (msgType === "video") {
    const videoWrap = document.createElement("div");
    videoWrap.className = "video-bubble";
    const video = document.createElement("video");
    video.className = "video-circle-msg";
    video.src = msg.file_url;
    video.preload = "metadata";
    video.playsInline = true;
    const playOverlay = document.createElement("div");
    playOverlay.className = "video-play-overlay";
    playOverlay.textContent = "▶";
    videoWrap.append(video, playOverlay);
    div.appendChild(videoWrap);

    let playing = false;
    videoWrap.onclick = () => {
      if (playing) {
        video.pause();
        playOverlay.classList.remove("hidden");
        playing = false;
      } else {
        video.play();
        playOverlay.classList.add("hidden");
        playing = true;
        video.onended = () => { playOverlay.classList.remove("hidden"); playing = false; };
      }
    };
  } else {
    const textEl = document.createElement("div");
    textEl.textContent = msg.text;
    div.appendChild(textEl);
  }

  const timeEl = document.createElement("div");
  timeEl.className = "message-time";
  timeEl.textContent = formatTimeOnly(msg.created_at);
  div.appendChild(timeEl);

  return div;
}

function handleIncomingMessage(msg) {
  const isForActiveChat =
    (msg.sender_id === activeChatUserId && msg.receiver_id === currentUser.id) ||
    (msg.sender_id === currentUser.id && msg.receiver_id === activeChatUserId);

  if (isForActiveChat) {
    messagesEl.appendChild(createMessageEl(msg));
    scrollToBottom();

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
      messageType: "text",
    }));
  }

  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input"));
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
function renderAvatar(el, user, large) {
  if (user.avatar_url) {
    el.style.background = `url(${user.avatar_url}) center/cover`;
    el.textContent = "";
  } else {
    el.style.background = user.avatar_color;
    el.textContent = (user.display_name || "?")[0];
  }
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

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Start ---
init();
