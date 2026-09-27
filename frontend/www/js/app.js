// ====== Вспомогательное: получение геопозиции (Capacitor-плагин, либо обычный Web API) ======
async function getCurrentPosition() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
    const pos = await window.Capacitor.Plugins.Geolocation.getCurrentPosition();
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Геолокация не поддерживается устройством."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ====== Переключение экранов ======
function showView(name) {
  document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`view-${name}`).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  if (name === "feed") loadFeed();
  if (name === "profile") loadProfile();
}

// ====== Авторизация ======
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("form-register").classList.toggle("hidden", tab !== "register");
  });
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";
  try {
    const data = await Api.login(username, password);
    Api.setToken(data.token);
    await enterApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const displayName = document.getElementById("reg-displayname").value.trim();
  const password = document.getElementById("reg-password").value;
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";
  try {
    const data = await Api.register(username, password, displayName);
    Api.setToken(data.token);
    await enterApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  Api.setToken(null);
  if (globalSocket) { globalSocket.close(); globalSocket = null; }
  currentUserId = null;
  document.getElementById("bottom-nav").classList.add("hidden");
  document.getElementById("view-feed").classList.add("hidden");
  document.getElementById("view-profile").classList.add("hidden");
  document.getElementById("view-auth").classList.remove("hidden");
});

async function enterApp() {
  document.getElementById("view-auth").classList.add("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  try {
    const me = await Api.getMyProfile();
    currentUserId = me.user_id;
  } catch (_) { /* профиль подтянется позже на экране профиля */ }
  await requestNotificationPermission();
  connectGlobalSocket();
  showView("feed");
}

// ====== Нижняя навигация ======
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// ====== Лента ======
let lastKnownPosition = null;

async function loadFeed() {
  const listEl = document.getElementById("feed-list");
  const bannerEl = document.getElementById("feed-status-banner");
  listEl.innerHTML = `<p class="empty-state">Загрузка…</p>`;
  bannerEl.classList.add("hidden");

  try {
    lastKnownPosition = await getCurrentPosition();
  } catch (_) {
    bannerEl.textContent = "Не удалось определить геолокацию — лента без сортировки по расстоянию. Проверьте разрешение приложения.";
    bannerEl.classList.remove("hidden");
  }

  try {
    const items = await Api.getFeed(lastKnownPosition?.lat, lastKnownPosition?.lon);
    renderFeed(items);
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">Не удалось загрузить ленту: ${escapeHtml(err.message)}</p>`;
  }
}

function renderFeed(items) {
  const listEl = document.getElementById("feed-list");
  if (!items.length) {
    listEl.innerHTML = `<p class="empty-state">Пока никто не гуляет рядом. Будьте первым!</p>`;
    return;
  }
  listEl.innerHTML = items.map((item) => `
    <div class="status-card">
      <div class="row-top">
        <span class="author">${escapeHtml(item.author_display_name || item.author_username)}</span>
        ${item.distance_km != null ? `<span class="distance">${item.distance_km} км</span>` : ""}
      </div>
      <p class="text">${escapeHtml(item.text)}</p>
      <div class="row-bottom">
        <p class="meta">${formatTime(item.created_at)}</p>
        ${item.author_id != null && item.author_id !== currentUserId ? `
          <button class="btn-message" data-user-id="${item.author_id}"
                  data-user-name="${escapeHtml(item.author_display_name || item.author_username)}">
            Написать
          </button>` : ""}
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".btn-message").forEach((btn) => {
    btn.addEventListener("click", () => {
      openChat(Number(btn.dataset.userId), btn.dataset.userName);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ====== Создание статуса ======
const modal = document.getElementById("modal-new-status");

document.getElementById("btn-new-status").addEventListener("click", async () => {
  modal.classList.remove("hidden");
  document.getElementById("new-status-text").value = "";
  const geoStatusEl = document.getElementById("geo-status");
  geoStatusEl.textContent = "Определяем ваше местоположение…";
  try {
    lastKnownPosition = await getCurrentPosition();
    geoStatusEl.textContent = "Местоположение определено ✓";
  } catch (err) {
    geoStatusEl.textContent = "Не удалось определить местоположение: " + err.message;
  }
});

document.getElementById("btn-cancel-status").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("btn-publish-status").addEventListener("click", async () => {
  const text = document.getElementById("new-status-text").value.trim();
  if (!text) return;
  if (!lastKnownPosition) {
    document.getElementById("geo-status").textContent = "Нужна геолокация, чтобы опубликовать статус.";
    return;
  }
  try {
    await Api.createStatus(text, lastKnownPosition.lat, lastKnownPosition.lon);
    modal.classList.add("hidden");
    loadFeed();
  } catch (err) {
    document.getElementById("geo-status").textContent = "Ошибка публикации: " + err.message;
  }
});

// ====== Профиль ======
async function loadProfile() {
  try {
    const profile = await Api.getMyProfile();
    currentUserId = profile.user_id;
    document.getElementById("profile-displayname").value = profile.display_name || "";
    document.getElementById("profile-bio").value = profile.bio || "";
    document.getElementById("profile-rating").textContent =
      profile.trust_rating_count > 0 ? `${profile.trust_rating.toFixed(1)} (${profile.trust_rating_count})` : "пока нет оценок";
  } catch (err) {document.getElementById("profile-saved-hint").textContent = "Не удалось загрузить профиль: " + err.message;
  }
}

document.getElementById("btn-save-profile").addEventListener("click", async () => {
  const hintEl = document.getElementById("profile-saved-hint");
  try {
    await Api.updateMyProfile({
      display_name: document.getElementById("profile-displayname").value.trim(),
      bio: document.getElementById("profile-bio").value.trim(),
    });
    hintEl.textContent = "Сохранено ✓";
  } catch (err) {
    hintEl.textContent = "Ошибка сохранения: " + err.message;
  }
});

// ====== Чат ======
// ВАЖНО: пока сообщения передаются и хранятся ОТКРЫТЫМ текстом (просто в поле ciphertext).
// Настоящее E2E-шифрование (с использованием Profile.public_key) — следующий шаг, пока не подключен.
let currentUserId = null;
let globalSocket = null;
let chatPartnerId = null;

// Один сокет на всю сессию — подключается сразу после входа и слушает ВСЕ входящие сообщения,
// не только те, что относятся к открытому сейчас чату. Это нужно для уведомлений.
function connectGlobalSocket() {
  if (globalSocket) return;
  globalSocket = Api.connectChatSocket((data) => {
    if (data.error) return;

    const chatViewOpen = !document.getElementById("view-chat").classList.contains("hidden");
    const isForOpenChat = chatViewOpen && data.sender_id === chatPartnerId;

    if (isForOpenChat) {
      appendChatMessage(data);
    } else if (data.sender_id !== currentUserId) {
      showLocalNotification("Новое сообщение", data.ciphertext);
    }
  });

  globalSocket.onclose = () => {
    globalSocket = null;
    if (Api.token) setTimeout(connectGlobalSocket, 3000); // переподключение
  };
}

async function openChat(userId, displayName) {
  chatPartnerId = userId;
  document.getElementById("chat-partner-name").textContent = displayName;
  document.getElementById("chat-messages").innerHTML = `<p class="empty-state">Загрузка…</p>`;
  showView("chat");

  try {
    const history = await Api.getChatHistory(userId);
    renderChatMessages(history);
  } catch (err) {
    document.getElementById("chat-messages").innerHTML =
      `<p class="empty-state">Не удалось загрузить историю: ${escapeHtml(err.message)}</p>`;
  }

  connectGlobalSocket(); // на случай, если сокет ещё не был открыт
}

function renderChatMessages(messages) {
  const listEl = document.getElementById("chat-messages");
  if (!messages.length) {
    listEl.innerHTML = `<p class="empty-state">Пока нет сообщений. Начните переписку!</p>`;
    return;
  }
  listEl.innerHTML = "";
  messages.forEach((m) => appendChatMessage(m));
}

function appendChatMessage(m) {
  const listEl = document.getElementById("chat-messages");
  if (listEl.querySelector(".empty-state")) listEl.innerHTML = "";
  const mine = m.sender === currentUserId || m.sender_id === currentUserId;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble" + (mine ? " mine" : "");
  bubble.textContent = m.ciphertext; // пока это открытый текст, без шифрования
  listEl.appendChild(bubble);
  listEl.scrollTop = listEl.scrollHeight;
}

document.getElementById("btn-chat-back").addEventListener("click", () => {
  chatPartnerId = null;
  showView("feed");
});

document.getElementById("form-chat-send").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !globalSocket || globalSocket.readyState !== WebSocket.OPEN) return;
  globalSocket.send(JSON.stringify({ recipient_id: chatPartnerId, ciphertext: text }));
  input.value = "";
});

// ====== Точка входа ======
(function init() {
  const token = Api.loadToken();
  if (token) {
    enterApp();
  }
})();