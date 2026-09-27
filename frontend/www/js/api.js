// ===== Настройка адреса backend'а =====
const API_BASE_URL = "https://walkapp-backend-1lw9.onrender.com/api";
// Тот же хост, но для WebSocket (wss вместо https)
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

  getFeed(lat, lon) {
    const query = (lat != null && lon != null) ? `?lat=${lat}&lon=${lon}` : "";
    return this._request(`/statuses/${query}`);
  },

  createStatus(text, latitude, longitude) {
    return this._request("/statuses/", { method: "POST", body: { text, latitude, longitude } });
  },

  // ===== Чат =====
  getChatHistory(userId) {
    return this._request(`/chat/${userId}/history/`);
  },

  // Открывает (или переиспользует) WebSocket-соединение чата.
  // onMessage(data) вызывается при каждом входящем сообщении.
  connectChatSocket(onMessage) {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/?token=${this.token}`);
    ws.onmessage = (event) => {
      try { onMessage(JSON.parse(event.data)); }
      catch (_) { /* игнорируем некорректный пакет */ }
    };
    return ws;
  },
};