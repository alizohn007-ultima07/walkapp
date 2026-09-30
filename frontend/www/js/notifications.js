import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Уведомления появляются в шторке Android как обычные push.
 * На iOS — в Notification Center.
 *
 * ВАЖНО для Android 13+: разрешение POST_NOTIFICATIONS запрашивается
 * в рантайме, плагин делает это автоматически через requestPermissions().
 */

let _inited = false;

async function ensureChannels() {
  if (_inited || Capacitor.getPlatform() !== 'android') return;
  _inited = true;

  // Android-каналы (для разных типов уведомлений)
  await LocalNotifications.createChannel({
    id: 'walks',
    name: 'Прогулки',
    description: 'Напоминания о прогулках и новые статусы рядом',
    importance: 5,          // HIGH → heads-up баннер + звук
    visibility: 1,          // PUBLIC — показывать на локскрине
    vibration: true,
    lights: true,
    lightColor: '#6a8dff',
  });

  await LocalNotifications.createChannel({
    id: 'messages',
    name: 'Сообщения',
    description: 'Сообщения от других пользователей',
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}

/** Проверить/запросить разрешение. На iOS и Android 13+ — обязательно. */
export async function ensureNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false;

  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;

  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

/**
 * Показать локальное уведомление.
 * @param {object} opts
 * @param {number} [opts.id]     — стабильный id (нужен для отмены)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {Date}   [opts.at]     — когда показать (по умолчанию — сразу)
 * @param {string} [opts.channel] — 'walks' | 'messages' (Android)
 * @param {object} [opts.extra]  — произвольные данные, вернутся при тапе
 */
export async function showLocalNotification({
  id,
  title,
  body,
  at,
  channel = 'walks',
  extra = {},
}) {
  await ensureChannels();

  const ok = await ensureNotificationPermission();
  if (!ok) {
    console.warn('[notifications] разрешение не выдано');
    return false;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: id ?? Math.floor(Date.now() % 2147483647),
        title,
        body,
        schedule: at ? { at } : undefined,
        channelId: channel,                       // Android
        smallIcon: 'ic_stat_icon',                // Android — иконка в шторке
        iconColor: '#6a8dff',                     // Android — цвет иконки
        sound: null,                              // системный звук по умолчанию
        ongoing: false,                           // не «залипающее»
        autoCancel: true,                         // исчезает при тапе
        extra,                                    // вернётся в actionPerformed
      },
    ],
  });

  return true;
}

/** Отменить конкретное уведомление. */
export async function cancelNotification(id) {
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

/** Отменить все запланированные. */
export async function cancelAllNotifications() {
  const list = await LocalNotifications.getPending();
  if (list.notifications.length) {
    await LocalNotifications.cancel({ notifications: list.notifications });
  }
}

/** Подписка на тап по уведомлению. Возвращает функцию-отписку. */
export function onNotificationTap(handler) {
  const p = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => handler(event.notification, event.actionId),
  );
  return () => p.then((sub) => sub.remove());
}

/** Подписка на приход уведомления, когда приложение открыто. */
export function onNotificationReceived(handler) {
  const p = LocalNotifications.addListener(
    'localNotificationReceived',
    handler,
  );
  return () => p.then((sub) => sub.remove());
}