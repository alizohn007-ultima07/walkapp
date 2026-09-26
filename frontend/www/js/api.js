// ===== Настройка адреса backend'а =====
// При запуске backend'а локально на компьютере и тестировании в эмуляторе Android
// используйте 10.0.2.2 — это специальный адрес, по которому эмулятор видит localhost компьютера.
// Для физического телефона в той же Wi-Fi-сети укажите локальный IP компьютера, например http://192.168.1.50:8000
// Когда backend будет выложен на хостинг — впишите сюда его настоящий адрес (https://...).
const API_BASE_URL = "http://localhost:8000/api";

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
};
