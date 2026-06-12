/* ===== Dmitry Messenger — Client ===== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let token = localStorage.getItem("token");
let currentUser = null;
let ws = null;
let activeChatId = null;
let activeChatIsGroup = false;
let onlineUserIds = new Set();
let mediaRecorder = null;
let recordedChunks = [];
let videoStream = null;
let timerInterval = null;
let timerSeconds = 0;

// ==================== INIT ====================

async function init() {
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

// ==================== API ====================

async function api(method, endpoint, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка");
  return data;
}

async function uploadFile(file, endpoint = "/upload", fieldName = "file") {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`/api${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}

// ==================== AUTH ====================

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#messenger-screen").classList.add("hidden");
}

function showMessenger() {
  $("#auth-screen").classList.add("hidden");
  $("#messenger-screen").classList.remove("hidden");
  $("#my-name").textContent = currentUser.display_name;
  renderAvatar($("#my-avatar"), currentUser);
  connectWebSocket();
  loadChats();
}

function switchAuthMode(mode) {
  const isRegister = mode === "register";
  $("#auth-title").textContent = isRegister ? "Регистрация" : "Вход";
  $("#name-field").classList.toggle("hidden", !isRegister);
  $("#auth-btn").textContent = isRegister ? "Создать аккаунт" : "Войти";
  $("#auth-switch").innerHTML = isRegister
    ? 'Уже есть аккаунт? <a onclick="switchAuthMode(\'login\')">Войти</a>'
    : 'Нет аккаунта? <a onclick="switchAuthMode(\'register\')">Регистрация</a>';
  $("#auth-error").classList.add("hidden");
  document.getElementById("auth-mode").value = mode;
}

async function handleAuth(e) {
  e.preventDefault();
  const mode = document.getElementById("auth-mode").value;
  const username = $("#auth-username").value.trim();
  const password = $("#auth-password").value;
  const displayName = $("#auth-name")?.value.trim();

  try {
    let res;
    if (mode === "register") {
      res = await api("POST", "/register", { username, displayName: displayName || username, password });
    } else {
      res = await api("POST", "/login", { username, password });
    }
    token = res.token;
    currentUser = res.user;
    localStorage.setItem("token", token);
    showMessenger();
  } catch (err) {
    $("#auth-error").textContent = err.message;
    $("#auth-error").classList.remove("hidden");
  }
}

function logout() {
  api("POST", "/logout").catch(() => {});
  localStorage.removeItem("token");
  token = null;
  currentUser = null;
  if (ws) ws.close();
  location.reload();
}

// ==================== WEBSOCKET ====================

function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleWSMessage(msg);
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function handleWSMessage(msg) {
  if (msg.type === "online") {
    onlineUserIds = new Set(msg.userIds);
    updateOnlineStatus();
  }

  if (msg.type === "message") {
    const m = msg.message;
    if (
      !activeChatIsGroup &&
      (m.sender_id === activeChatId || (m.sender_id === currentUser.id && m.receiver_id === activeChatId))
    ) {
      appendMessage(m);
      scrollToBottom();
      if (m.sender_id !== currentUser.id) {
        ws.send(JSON.stringify({ type: "read", senderId: m.sender_id }));
      }
    }
    loadChats();
  }

  if (msg.type === "group_message") {
    const m = msg.message;
    if (activeChatIsGroup && msg.groupId === activeChatId) {
      appendMessage(m);
      scrollToBottom();
    }
    loadChats();
  }

  if (msg.type === "typing") {
    if (!activeChatIsGroup && msg.userId === activeChatId) {
      showTyping(msg.name);
    }
  }

  if (msg.type === "reaction_update") {
    updateMessageReactions(msg.messageId, msg.reactions);
  }

  // Call handling
  if (msg.type === "call_offer") {
    showIncomingCall(msg);
  }
  if (msg.type === "call_end") {
    endCall();
  }
}

// ==================== CHATS ====================

async function loadChats() {
  const res = await api("GET", "/chats");
  renderChatList(res.chats, res.unread);
}

function renderChatList(chats, unread) {
  const list = $("#chat-list");
  list.innerHTML = "";

  for (const chat of chats) {
    const div = document.createElement("div");
    div.className = "chat-item" + (chat.id === activeChatId && chat.isGroup === activeChatIsGroup ? " active" : "");
    div.onclick = () => openChat(chat.id, chat.isGroup);

    const avatarEl = document.createElement("div");
    avatarEl.className = "avatar-sm";
    renderAvatar(avatarEl, chat);

    const body = document.createElement("div");
    body.className = "chat-item-body";

    const top = document.createElement("div");
    top.className = "chat-item-top";

    const nameEl = document.createElement("span");
    nameEl.className = "chat-item-name";
    nameEl.textContent = chat.display_name + (chat.isGroup ? " 👥" : "");

    const timeEl = document.createElement("span");
    timeEl.className = "chat-item-time";
    timeEl.textContent = chat.last_message_at ? formatTime(chat.last_message_at) : "";

    top.appendChild(nameEl);
    top.appendChild(timeEl);

    const bottom = document.createElement("div");
    bottom.className = "chat-item-bottom";

    const preview = document.createElement("span");
    preview.className = "chat-item-preview";
    preview.textContent = chat.last_message || "Нет сообщений";

    bottom.appendChild(preview);

    const unreadCount = unread[chat.id];
    if (unreadCount && !chat.isGroup) {
      const badge = document.createElement("span");
      badge.className = "unread-badge";
      badge.textContent = unreadCount;
      bottom.appendChild(badge);
    }

    body.appendChild(top);
    body.appendChild(bottom);
    div.appendChild(avatarEl);
    div.appendChild(body);
    list.appendChild(div);
  }
}

// ==================== OPEN CHAT ====================

async function openChat(id, isGroup = false) {
  activeChatId = id;
  activeChatIsGroup = isGroup;

  $(".messenger").classList.add("chat-open");
  $(".no-chat").classList.add("hidden");
  $(".active-chat").classList.remove("hidden");

  if (isGroup) {
    const res = await api("GET", `/groups/${id}`);
    $("#chat-name").textContent = res.group.name;
    $("#chat-status").textContent = `${res.members.length} участников`;
    $("#chat-status").className = "chat-status";
    renderAvatar($("#chat-avatar"), { display_name: res.group.name, avatar_color: res.group.avatar_color, avatar_url: res.group.avatar_url });

    const msgRes = await api("GET", `/groups/${id}/messages`);
    renderMessages(msgRes.messages);
  } else {
    const res = await api("GET", `/user/${id}`);
    const user = res.user;
    $("#chat-name").textContent = user.display_name;
    updateChatStatus(user);
    renderAvatar($("#chat-avatar"), user);

    const msgRes = await api("GET", `/messages/${id}`);
    renderMessages(msgRes.messages);
    ws.send(JSON.stringify({ type: "read", senderId: id }));
  }

  loadChats();
  scrollToBottom();
}

function updateChatStatus(user) {
  const isOnline = onlineUserIds.has(user.id || activeChatId);
  if (isOnline) {
    $("#chat-status").textContent = "в сети";
    $("#chat-status").className = "chat-status online";
  } else {
    $("#chat-status").textContent = formatLastSeen(user.last_seen);
    $("#chat-status").className = "chat-status";
  }
}

function updateOnlineStatus() {
  if (activeChatId && !activeChatIsGroup) {
    const isOnline = onlineUserIds.has(activeChatId);
    if (isOnline) {
      $("#chat-status").textContent = "в сети";
      $("#chat-status").className = "chat-status online";
    } else {
      $("#chat-status").textContent = "не в сети";
      $("#chat-status").className = "chat-status";
    }
  }
}

// ==================== MESSAGES ====================

function renderMessages(messages) {
  const container = $("#messages");
  container.innerHTML = "";
  let lastDate = "";
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toLocaleDateString("ru-RU");
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const divider = document.createElement("div");
      divider.className = "message-date-divider";
      divider.innerHTML = `<span>${msgDate}</span>`;
      container.appendChild(divider);
    }
    appendMessage(msg, container, false);
  }
  scrollToBottom();
}

function appendMessage(msg, container, animate = true) {
  container = container || $("#messages");
  const div = document.createElement("div");
  const isOut = msg.sender_id === currentUser.id;
  const msgType = msg.message_type || "text";
  div.className = "message " + (isOut ? "message-out" : "message-in");
  if (!animate) div.style.animation = "none";
  div.dataset.id = msg.id;

  // Show sender name in groups
  if (activeChatIsGroup && !isOut) {
    const senderEl = document.createElement("div");
    senderEl.className = "message-sender";
    senderEl.textContent = msg.sender_name;
    senderEl.style.color = msg.sender_color;
    senderEl.style.fontSize = "12px";
    senderEl.style.fontWeight = "600";
    senderEl.style.marginBottom = "2px";
    div.appendChild(senderEl);
  }

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
      bar.style.height = Math.random() * 20 + 5 + "px";
      waveform.appendChild(bar);
    }
    const durEl = document.createElement("span");
    durEl.className = "voice-duration";
    durEl.textContent = formatDuration(msg.duration);

    let audio = null;
    playBtn.onclick = () => {
      if (!audio) {
        audio = new Audio(msg.file_url);
        audio.onended = () => { playBtn.textContent = "▶"; };
      }
      if (audio.paused) {
        audio.play();
        playBtn.textContent = "⏸";
      } else {
        audio.pause();
        playBtn.textContent = "▶";
      }
    };

    voiceDiv.appendChild(playBtn);
    voiceDiv.appendChild(waveform);
    voiceDiv.appendChild(durEl);
    div.appendChild(voiceDiv);
  } else if (msgType === "video") {
    div.classList.add("message-video");
    const videoWrap = document.createElement("div");
    videoWrap.className = "video-bubble";
    const video = document.createElement("video");
    video.className = "video-circle-msg";
    video.src = msg.file_url;
    video.preload = "metadata";
    video.playsInline = true;
    video.loop = true;
    const overlay = document.createElement("div");
    overlay.className = "video-play-overlay";
    overlay.textContent = "▶";

    videoWrap.onclick = () => {
      if (video.paused) {
        video.play();
        overlay.classList.add("hidden");
      } else {
        video.pause();
        overlay.classList.remove("hidden");
      }
    };
    video.onended = () => overlay.classList.remove("hidden");

    videoWrap.appendChild(video);
    videoWrap.appendChild(overlay);
    div.appendChild(videoWrap);
  } else if (msgType === "sticker") {
    const stickerEl = document.createElement("div");
    stickerEl.className = "message-sticker";
    stickerEl.textContent = msg.text;
    div.appendChild(stickerEl);
  } else {
    const textEl = document.createElement("div");
    textEl.className = "message-text";
    textEl.textContent = msg.text;
    div.appendChild(textEl);
  }

  // Time
  const timeEl = document.createElement("div");
  timeEl.className = "message-time";
  timeEl.textContent = formatMsgTime(msg.created_at);
  div.appendChild(timeEl);

  // Reactions
  if (msg.reactions && msg.reactions.length > 0) {
    div.appendChild(createReactionsEl(msg.id, msg.reactions));
  }

  // Double-click to react
  div.ondblclick = () => showReactionPicker(msg.id, div);

  container.appendChild(div);
}

// ==================== REACTIONS ====================

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👎", "🎉"];

function showReactionPicker(messageId, msgEl) {
  closeReactionPicker();
  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  picker.id = "reaction-picker";
  for (const emoji of REACTION_EMOJIS) {
    const btn = document.createElement("button");
    btn.textContent = emoji;
    btn.onclick = (e) => {
      e.stopPropagation();
      ws.send(JSON.stringify({ type: "reaction", messageId, emoji, action: "add" }));
      closeReactionPicker();
    };
    picker.appendChild(btn);
  }
  msgEl.appendChild(picker);
  setTimeout(() => picker.classList.add("visible"), 10);
}

function closeReactionPicker() {
  const existing = document.getElementById("reaction-picker");
  if (existing) existing.remove();
}

function createReactionsEl(messageId, reactions) {
  const wrap = document.createElement("div");
  wrap.className = "reactions-bar";
  wrap.dataset.msgId = messageId;

  const grouped = {};
  for (const r of reactions) {
    grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
  }

  for (const [emoji, count] of Object.entries(grouped)) {
    const btn = document.createElement("button");
    btn.className = "reaction-btn";
    const isMine = reactions.some((r) => r.emoji === emoji && r.user_id === currentUser.id);
    if (isMine) btn.classList.add("my-reaction");
    btn.textContent = `${emoji} ${count}`;
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = isMine ? "remove" : "add";
      ws.send(JSON.stringify({ type: "reaction", messageId, emoji, action }));
    };
    wrap.appendChild(btn);
  }
  return wrap;
}

function updateMessageReactions(messageId, reactions) {
  const msgEl = document.querySelector(`.message[data-id="${messageId}"]`);
  if (!msgEl) return;
  const existing = msgEl.querySelector(".reactions-bar");
  if (existing) existing.remove();
  if (reactions.length > 0) {
    msgEl.appendChild(createReactionsEl(messageId, reactions));
  }
}

// ==================== SEND MESSAGE ====================

function sendMessage() {
  const input = $("#message-input");
  const text = input.value.trim();
  if (!text || !activeChatId) return;

  if (activeChatIsGroup) {
    ws.send(JSON.stringify({ type: "group_message", groupId: activeChatId, text }));
  } else {
    ws.send(JSON.stringify({ type: "message", receiverId: activeChatId, text }));
  }
  input.value = "";
  updateInputButtons();
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Typing indicator
  if (activeChatId) {
    if (activeChatIsGroup) {
      ws.send(JSON.stringify({ type: "typing", groupId: activeChatId }));
    } else {
      ws.send(JSON.stringify({ type: "typing", receiverId: activeChatId }));
    }
  }
}

function updateInputButtons() {
  const input = $("#message-input");
  const hasText = input.value.trim().length > 0;
  $("#btn-send").classList.toggle("hidden", !hasText);
  $("#btn-voice").classList.toggle("hidden", hasText);
  $("#btn-video").classList.toggle("hidden", hasText);
}

// ==================== FILE UPLOAD ====================

function triggerFileUpload() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (activeChatIsGroup) {
      ws.send(JSON.stringify({ type: "group_message", groupId: activeChatId, text: "", messageType: "image", fileUrl: res.url }));
    } else {
      ws.send(JSON.stringify({ type: "message", receiverId: activeChatId, text: "", messageType: "image", fileUrl: res.url }));
    }
  };
  input.click();
}

// ==================== VOICE RECORDING ====================

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

function cancelVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }
  recordedChunks = [];
  stopTimer();
  $("#voice-overlay").classList.add("hidden");
}

async function sendVoiceRecording() {
  if (!mediaRecorder) return;
  const duration = timerSeconds;
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  stopTimer();
  $("#voice-overlay").classList.add("hidden");

  await new Promise((r) => setTimeout(r, 200));
  const blob = new Blob(recordedChunks, { type: "audio/webm" });
  const file = new File([blob], "voice.webm", { type: "audio/webm" });
  const res = await uploadFile(file);

  if (activeChatIsGroup) {
    ws.send(JSON.stringify({ type: "group_message", groupId: activeChatId, text: "", messageType: "voice", fileUrl: res.url, duration }));
  } else {
    ws.send(JSON.stringify({ type: "message", receiverId: activeChatId, text: "", messageType: "voice", fileUrl: res.url, duration }));
  }
}

// ==================== VIDEO RECORDING ====================

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

function cancelVideoRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  recordedChunks = [];
  stopTimer();
  $("#video-overlay").classList.add("hidden");
}

async function sendVideoRecording() {
  if (!mediaRecorder) return;
  const duration = timerSeconds;
  mediaRecorder.stop();
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  stopTimer();
  $("#video-overlay").classList.add("hidden");

  await new Promise((r) => setTimeout(r, 200));
  const blob = new Blob(recordedChunks, { type: "video/webm" });
  const file = new File([blob], "video.webm", { type: "video/webm" });
  const res = await uploadFile(file);

  if (activeChatIsGroup) {
    ws.send(JSON.stringify({ type: "group_message", groupId: activeChatId, text: "", messageType: "video", fileUrl: res.url, duration }));
  } else {
    ws.send(JSON.stringify({ type: "message", receiverId: activeChatId, text: "", messageType: "video", fileUrl: res.url, duration }));
  }
}

// ==================== STICKERS ====================

const STICKERS = [
  "😀", "😂", "🥰", "😎", "🤔", "😱", "🥳", "🤯",
  "😴", "🤮", "👻", "💀", "🔥", "⭐", "🌈", "🎉",
  "❤️", "💔", "👍", "👎", "✌️", "🤙", "🙏", "💪",
  "🎮", "🎵", "📸", "💻", "🚀", "🌍", "🐱", "🐶",
];

function toggleStickerPanel() {
  const panel = $("#sticker-panel");
  panel.classList.toggle("hidden");
}

function sendSticker(sticker) {
  if (!activeChatId) return;
  if (activeChatIsGroup) {
    ws.send(JSON.stringify({ type: "group_message", groupId: activeChatId, text: sticker, messageType: "sticker" }));
  } else {
    ws.send(JSON.stringify({ type: "message", receiverId: activeChatId, text: sticker, messageType: "sticker" }));
  }
  $("#sticker-panel").classList.add("hidden");
}

// ==================== GROUPS ====================

function showCreateGroup() {
  $("#create-group-modal").classList.remove("hidden");
  loadGroupUserList();
}

async function loadGroupUserList() {
  const res = await api("GET", "/users/search?q=");
  const list = $("#group-user-list");
  list.innerHTML = "";
  for (const user of res.users) {
    const item = document.createElement("label");
    item.className = "group-user-item";
    item.innerHTML = `<input type="checkbox" value="${user.id}"> <span>${user.display_name}</span> <small>@${user.username}</small>`;
    list.appendChild(item);
  }
}

async function createGroup() {
  const name = $("#group-name-input").value.trim();
  if (!name) return alert("Введите название группы");
  const checkboxes = $$("#group-user-list input:checked");
  const memberIds = [...checkboxes].map((cb) => parseInt(cb.value));
  if (memberIds.length === 0) return alert("Выберите хотя бы одного участника");

  await api("POST", "/groups", { name, memberIds });
  $("#create-group-modal").classList.add("hidden");
  $("#group-name-input").value = "";
  loadChats();
}

// ==================== USER PROFILE ====================

async function showUserProfile(userId) {
  const res = await api("GET", `/user/${userId}`);
  const user = res.user;
  const stats = res.stats;

  $("#profile-modal").classList.remove("hidden");
  renderAvatar($("#profile-avatar"), user, true);
  $("#profile-name").textContent = user.display_name;
  $("#profile-username").textContent = "@" + user.username;
  $("#profile-bio").textContent = user.bio || "Нет информации";
  $("#profile-last-seen").textContent = onlineUserIds.has(user.id) ? "🟢 В сети" : "⚪ " + formatLastSeen(user.last_seen);
  $("#profile-joined").textContent = "📅 " + new Date(user.created_at).toLocaleDateString("ru-RU");
  $("#profile-messages").textContent = `💬 ${stats.totalSent} сообщений`;
  $("#profile-media").textContent = `📷 ${stats.mediaCount} медиа`;
}

// ==================== SETTINGS ====================

function openSettings() {
  const modal = $("#settings-modal");
  modal.classList.remove("hidden");
  renderAvatar($("#settings-avatar"), currentUser, true);
  $("#settings-name").value = currentUser.display_name;
  $("#settings-username").value = currentUser.username;
  $("#settings-bio").value = currentUser.bio || "";
}

async function saveSettings() {
  const displayName = $("#settings-name").value.trim();
  const bio = $("#settings-bio").value.trim();
  if (!displayName) return;
  try {
    const res = await api("POST", "/profile", { displayName, bio });
    currentUser = res.user;
    $("#my-name").textContent = currentUser.display_name;
    renderAvatar($("#my-avatar"), currentUser);
    $("#settings-modal").classList.add("hidden");
  } catch (e) {
    alert(e.message);
  }
}

async function uploadAvatar() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const res = await uploadFile(file, "/avatar", "avatar");
    currentUser = res.user;
    renderAvatar($("#settings-avatar"), currentUser, true);
    renderAvatar($("#my-avatar"), currentUser);
  };
  input.click();
}

// ==================== ADMIN ====================

async function openAdmin() {
  const res = await api("GET", "/admin/stats");
  $("#admin-modal").classList.remove("hidden");
  $("#admin-total-users").textContent = res.totalUsers;
  $("#admin-total-messages").textContent = res.totalMessages;
  $("#admin-total-groups").textContent = res.totalGroups;

  const list = $("#admin-user-list");
  list.innerHTML = "";
  for (const user of res.users) {
    const div = document.createElement("div");
    div.className = "admin-user-item";
    div.innerHTML = `
      <div class="admin-user-info">
        <strong>${user.display_name}</strong> <small>@${user.username}</small>
      </div>
      <div class="admin-user-stats">
        💬 ${user.messageCount} • 📅 ${new Date(user.created_at).toLocaleDateString("ru-RU")}
        • ${onlineUserIds.has(user.id) ? "🟢 онлайн" : "⚪ " + formatLastSeen(user.last_seen)}
      </div>
    `;
    list.appendChild(div);
  }
}

// ==================== CALLS ====================

let peerConnection = null;
let localStream = null;
let callTargetId = null;

async function startCall(isVideo) {
  if (!activeChatId || activeChatIsGroup) return;
  callTargetId = activeChatId;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: isVideo 
    });
    
    $("#call-overlay").classList.remove("hidden");
    $("#call-status").textContent = "Вызов...";
    $("#call-name").textContent = $("#chat-name").textContent;
    
    if (isVideo) {
      $("#call-local-video").srcObject = localStream;
      $("#call-local-video").classList.remove("hidden");
    }
    
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: "call_ice", targetId: callTargetId, candidate: e.candidate }));
      }
    };
    
    peerConnection.ontrack = (e) => {
      $("#call-remote-video").srcObject = e.streams[0];
      $("#call-remote-video").classList.remove("hidden");
      $("#call-status").textContent = "Подключено";
    };
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "call_offer", targetId: callTargetId, offer, isVideo }));
    
  } catch (e) {
    alert("Ошибка доступа к камере/микрофону");
  }
}

async function showIncomingCall(msg) {
  if (confirm(`📞 Входящий ${msg.isVideo ? "видео" : "голосовой"} звонок от ${msg.callerName}. Принять?`)) {
    callTargetId = msg.callerId;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: msg.isVideo });
    
    $("#call-overlay").classList.remove("hidden");
    $("#call-status").textContent = "Подключение...";
    $("#call-name").textContent = msg.callerName;
    
    if (msg.isVideo) {
      $("#call-local-video").srcObject = localStream;
      $("#call-local-video").classList.remove("hidden");
    }
    
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: "call_ice", targetId: callTargetId, candidate: e.candidate }));
      }
    };
    
    peerConnection.ontrack = (e) => {
      $("#call-remote-video").srcObject = e.streams[0];
      $("#call-remote-video").classList.remove("hidden");
      $("#call-status").textContent = "Подключено";
    };
    
    await peerConnection.setRemoteDescription(msg.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "call_answer", targetId: callTargetId, answer }));
  } else {
    ws.send(JSON.stringify({ type: "call_end", targetId: msg.callerId }));
  }
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (callTargetId) {
    ws.send(JSON.stringify({ type: "call_end", targetId: callTargetId }));
  }
  callTargetId = null;
  $("#call-overlay").classList.add("hidden");
  $("#call-local-video").classList.add("hidden");
  $("#call-remote-video").classList.add("hidden");
}

// ==================== SEARCH ====================

let searchTimeout = null;
function handleSearch(e) {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) return loadChats();
  searchTimeout = setTimeout(async () => {
    const res = await api("GET", `/users/search?q=${encodeURIComponent(q)}`);
    const list = $("#chat-list");
    list.innerHTML = "";
    for (const user of res.users) {
      const div = document.createElement("div");
      div.className = "chat-item";
      div.onclick = () => openChat(user.id);
      const avatarEl = document.createElement("div");
      avatarEl.className = "avatar-sm";
      renderAvatar(avatarEl, user);
      const body = document.createElement("div");
      body.className = "chat-item-body";
      body.innerHTML = `<div class="chat-item-top"><span class="chat-item-name">${user.display_name}</span></div><div class="chat-item-bottom"><span class="chat-item-preview">@${user.username}</span></div>`;
      div.appendChild(avatarEl);
      div.appendChild(body);
      list.appendChild(div);
    }
  }, 300);
}

// ==================== TYPING ====================

let typingTimeout = null;
function showTyping(name) {
  const el = $("#typing-indicator");
  el.textContent = `${name} печатает...`;
  el.classList.remove("hidden");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => el.classList.add("hidden"), 3000);
}

// ==================== HELPERS ====================

function renderAvatar(el, user, large = false) {
  const size = large ? "avatar-lg" : (el.classList.contains("avatar-sm") ? "avatar-sm" : "avatar-md");
  el.className = size;
  if (user.avatar_url) {
    el.style.backgroundImage = `url(${user.avatar_url})`;
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.style.backgroundColor = user.avatar_color || "#666";
    el.textContent = (user.display_name || "?")[0].toUpperCase();
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatMsgTime(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(iso) {
  if (!iso) return "давно";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "был(а) только что";
  if (diff < 3600) return `был(а) ${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `был(а) ${Math.floor(diff / 3600)} ч назад`;
  return `был(а) ${d.toLocaleDateString("ru-RU")}`;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scrollToBottom() {
  const c = $(".messages-container");
  if (c) setTimeout(() => (c.scrollTop = c.scrollHeight), 50);
}

function getSupportedMime(kind) {
  if (kind === "audio") {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    return "";
  }
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) return "video/webm;codecs=vp9,opus";
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  return "";
}

function startTimer(elId) {
  timerSeconds = 0;
  const el = document.getElementById(elId);
  timerInterval = setInterval(() => {
    timerSeconds++;
    el.textContent = formatDuration(timerSeconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function goBack() {
  $(".messenger").classList.remove("chat-open");
  activeChatId = null;
  activeChatIsGroup = false;
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close reaction picker on click outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".reaction-picker") && !e.target.closest(".message")) {
    closeReactionPicker();
  }
  if (!e.target.closest("#sticker-panel") && !e.target.closest("#btn-sticker")) {
    const panel = $("#sticker-panel");
    if (panel && !panel.classList.contains("hidden")) panel.classList.add("hidden");
  }
});

// ==================== START ====================
init();
