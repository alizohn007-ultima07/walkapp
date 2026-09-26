// ====== Вспомогательное: получение геопозиции (Capacitor-плагин, либо обычный Web API) ======
async function getCurrentPosition() {
  // Если приложение собрано через Capacitor и плагин Geolocation подключён — используем его.
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
    const pos = await window.Capacitor.Plugins.Geolocation.getCurrentPosition();
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  }
  // Иначе — обычный браузерный Geolocation API (работает и в WebView).
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
    enterApp();
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
    enterApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  Api.setToken(null);
  document.getElementById("bottom-nav").classList.add("hidden");
  document.getElementById("view-feed").classList.add("hidden");
  document.getElementById("view-profile").classList.add("hidden");
  document.getElementById("view-auth").classList.remove("hidden");
});

function enterApp() {
  document.getElementById("view-auth").classList.add("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
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
      <p class="meta">${formatTime(item.created_at)}</p>
    </div>
  `).join("");
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
    document.getElementById("profile-displayname").value = profile.display_name || "";
    document.getElementById("profile-bio").value = profile.bio || "";
    document.getElementById("profile-rating").textContent =
      profile.trust_rating_count > 0 ? `${profile.trust_rating.toFixed(1)} (${profile.trust_rating_count})` : "пока нет оценок";
  } catch (err) {
    document.getElementById("profile-saved-hint").textContent = "Не удалось загрузить профиль: " + err.message;
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

// ====== Точка входа ======
(function init() {
  const token = Api.loadToken();
  if (token) {
    enterApp();
  }
})();
