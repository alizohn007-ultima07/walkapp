import { api } from './api.js';
import {
  showLocalNotification,
  ensureNotificationPermission,
} from './notifications.js';

// ---------- Всплывашка снизу ----------
const toastEl = document.getElementById('toast');
let toastTimer;

function showToast(text, type = '') {
  toastEl.textContent = text;
  toastEl.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = '';
  }, 2500);
}

// ---------- Где я ----------
function getMyPlace() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Нет доступа к геолокации'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => reject(new Error('Разреши геолокацию')),
      { timeout: 10000 },
    );
  });
}

// ---------- Лента: показать людей ----------
async function showFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">Загружаем…</div>';

  try {
    let place = {};
    try {
      place = await getMyPlace();
    } catch {}

    const list = (await api.listStatuses(place)) || [];

    if (list.length === 0) {
      feed.innerHTML = `
        <div class="empty">
          <div class="empty-emoji">🚶</div>
          <div class="empty-title">Пока никого нет</div>
          <div class="empty-text">
            Будь первым!<br>Опубликуй статус выше.
          </div>
        </div>`;
      return;
    }

    feed.innerHTML = list.map((s, i) => {
      const name = s.display_name || s.username || 'Гуляющий';
      const letter = name[0].toUpperCase();
      const colorClass = 'c' + ((i % 4) + 1);
      const dist = s.distance_km != null
        ? '📍 ' + s.distance_km.toFixed(2) + ' км от тебя'
        : '📍 Рядом';

      return `
        <div class="person">
          <div class="person-top">
            <div class="person-ava ${colorClass}">${letter}</div>
            <div class="person-info">
              <div class="person-name">${name}</div>
              <div class="person-where">${dist}</div>
            </div>
          </div>
          <div class="person-text">${s.text}</div>
          <div class="person-time">${timeAgo(s.created_at)}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    feed.innerHTML = `
      <div class="empty">
        <div class="empty-emoji">😕</div>
        <div class="empty-title">Не получилось</div>
        <div class="empty-text">${e.message}</div>
      </div>`;
  }
}

function timeAgo(iso) {
  const sec = (Date.now() - new Date(iso)) / 1000;
  if (sec < 60) return 'только что';
  if (sec < 3600) return Math.floor(sec / 60) + ' мин назад';
  if (sec < 86400) return Math.floor(sec / 3600) + ' ч назад';
  return new Date(iso).toLocaleDateString('ru-RU');
}

// ---------- Кнопка "Опубликовать" ----------
document.getElementById('btn-post').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const text = document.getElementById('text').value.trim();

  if (!text) {
    showToast('Напиши что-нибудь', 'err');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="emoji">⏳</span><span>Отправляем…</span>';

  try {
    const place = await getMyPlace();
    await api.createStatus({
      text: text,
      latitude: place.lat,
      longitude: place.lon,
    });

    document.getElementById('text').value = '';
    showToast('Опубликовано! 🎉', 'ok');
    showFeed();
  } catch (err) {
    showToast(err.message || 'Ошибка', 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="emoji">📤</span><span>ОПУБЛИКОВАТЬ</span>';
  }
});

// ---------- Кнопка "Уведомление" ----------
document.getElementById('btn-notify').addEventListener('click', async () => {
  const ok = await ensureNotificationPermission();
  if (!ok) {
    showToast('Разреши уведомления в настройках', 'err');
    return;
  }

  await showLocalNotification({
    title: 'Пора гулять! 🚶',
    body: 'Открой WalkApp и найди компанию.',
  });

  showToast('Уведомление отправлено!', 'ok');
});

// ---------- Нижнее меню ----------
document.querySelectorAll('.bottom button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bottom button')
      .forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    showToast('Открыто: ' + btn.querySelector('span:last-child').textContent);
  });
});

// ---------- Запуск ----------
showFeed();
ensureNotificationPermission().catch(() => {});