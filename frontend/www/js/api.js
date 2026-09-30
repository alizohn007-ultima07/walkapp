// ===== Адрес backend'а =====
const API_BASE_URL = "https://walkapp-backend-1lw9.onrender.com/api";
const WS_BASE_URL = API_BASE_URL.replace(/^https/, "wss").replace(/\/api$/, "");

const Api = {
  token: null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  },

  loadToken() {
    this.token = localStorage.getItem("auth_token");
    return this.token;
  },

  async _request(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Token ${this.token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (_) { /* пустой ответ */ }

    if (!res.ok) {
      const message = data && (data.detail || JSON.stringify(data));
      throw new Error(message || `Ошибка запроса (${res.status})`);
    }
    return data;
  },

  // ===== Авторизация и профиль =====
  register(username, password, displayName) {
    return this._request("/auth/register/", {
      method: "POST",
      body: { username, password, display_name: displayName },
    });
  },

  login(username, password) {
    return this._request("/auth/login/", { method: "POST", body: { username, password } });
  },

  getMyProfile() {
    return this._request("/profile/me/");
  },

  updateMyProfile(patch) {
    return this._request("/profile/me/", { method: "PATCH", body: patch });
  },

  // ===== Лента =====
  getFeed(lat, lon) {
    const query = (lat != null && lon != null) ? `?lat=${lat}&lon=${lon}` : "";
    return this._request(`/statuses/${query}`);
  },

  createStatus(text, latitude, longitude) {
    return this._request("/statuses/", { method: "POST", body: { text, latitude, longitude } });
  },

  // ===== Оценки и комментарии =====
  createRating(walkStatusId, ratedUserId, score, comment) {
    return this._request("/ratings/", {
      method: "POST",
      body: { walk_status: walkStatusId, rated_user: ratedUserId, score, comment },
    });
  },

  getComments(statusId) {
    return this._request(`/statuses/${statusId}/comments/`);
  },

  createComment(statusId, text) {
    return this._request(`/statuses/${statusId}/comments/`, {
      method: "POST",
      body: { text },
    });
  },

  // ===== Чат =====
  getChatHistory(userId) {
    return this._request(`/chat/${userId}/history/`);
  },

  getConversations() {
    return this._request("/chat/conversations/");
  },

  connectChatSocket(onMessage) {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/?token=${this.token}`);
    ws.onmessage = (event) => {
      try { onMessage(JSON.parse(event.data)); }
      catch (_) { /* игнорируем некорректный пакет */ }
    };
    return ws;
  },
};

// ===== Уведомления =====
async function requestNotificationPermission() {
  try {
    if (window.Capacitor?.Plugins?.LocalNotifications) {
      await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
    } else if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch (_) { /* не критично */ }
}

async function showLocalNotification(title, body) {
  try {
    if (window.Capacitor?.Plugins?.LocalNotifications) {
      await window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{ id: Date.now() % 100000, title, body }],
      });
    } else if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch (_) { /* не критично */ }
}