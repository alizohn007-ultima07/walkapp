# Компания для пеших прогулок — Android-приложение

Реализовано ядро по вашему плану (22 сент – 31 окт): **Profile + лента статусов (WalkStatus) с геолокацией**, аутентификация. Модели `Response`, `Message`, `WalkRating` уже заведены в БД как заготовки — их логику добавите на следующих этапах (ноябрь / январь / февраль).

```
walkapp/
├── backend/     — Django + DRF API
└── frontend/    — Capacitor-проект (то, из чего соберётся .apk)
```

## Шаг 1. Запустить backend (на компьютере)

Нужен Python 3.10+.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # для входа в /admin/, необязательно
python manage.py runserver 0.0.0.0:8000
```

Проверьте в браузере: `http://127.0.0.1:8000/admin/` — должна открыться админка Django.

API-эндпоинты (уже реализованы):
- `POST /api/auth/register/` — `{username, password, display_name}`
- `POST /api/auth/login/` — `{username, password}` → `{token}`
- `GET/PATCH /api/profile/me/` — профиль (нужен заголовок `Authorization: Token <token>`)
- `GET /api/statuses/?lat=..&lon=..` — лента, отсортированная по расстоянию
- `POST /api/statuses/` — `{text, latitude, longitude}`

## Шаг 2. Настроить адрес backend'а во фронтенде

Откройте `frontend/www/js/api.js` и поправьте `API_BASE_URL`:

- **Эмулятор Android** на том же компьютере: оставьте `http://10.0.2.2:8000/api` (это спец-адрес, которым эмулятор видит localhost компьютера).
- **Физический телефон** в той же Wi-Fi-сети: узнайте локальный IP компьютера (`ipconfig` / `ifconfig`) и впишите, например, `http://192.168.1.50:8000/api`.
- **Backend на хостинге** (когда дойдёте до развёртывания): впишите его настоящий `https://...` адрес.

## Шаг 3. Собрать Android-приложение (получить `.apk`)

Понадобится (один раз установить, бесплатно):
- [Node.js](https://nodejs.org/) (LTS)
- [Android Studio](https://developer.android.com/studio) — вместе с ним ставится Android SDK

```bash
cd frontend
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Последняя команда откроет проект в **Android Studio**. Дальше:

1. Дождитесь окончания синхронизации Gradle (внизу экрана, первый раз может занять несколько минут).
2. Подключите телефон по USB (с включённой отладкой по USB) **или** запустите виртуальное устройство (Device Manager → Create Device) — это и есть эмулятор.
3. Нажмите ▶ (Run) — приложение установится и откроется на устройстве/эмуляторе.
4. Чтобы получить сам файл `.apk`: меню **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Готовый файл появится в `frontend/android/app/build/outputs/apk/debug/app-debug.apk` — его уже можно переслать и установить на любой Android-телефон (в настройках телефона может понадобиться разрешить установку из неизвестных источников).

Для финальной сдачи проекта (подписанный релизный `.apk`) — **Build → Generate Signed Bundle / APK**, там же в Android Studio можно создать ключ подписи (keystore) мастером — все шаги там подсказываются в интерфейсе.

## Разрешение на геолокацию

Приложению нужно разрешение на геолокацию. Capacitor добавит нужную запись в `AndroidManifest.xml` автоматически при `npx cap add android`; если геолокация не запросится сама — добавьте вручную в `frontend/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Что дальше по вашему плану

- **1–23 ноября**: доработать `walks/utils.py` (сейчас там базовый haversine) — добавить скор совместимости и unit-тесты; реализовать модель `Response` (view + фронтенд: кнопка «откликнуться»).
- **16–31 января**: `Message` — views для чата, фронтенд-экран переписки.
- **1–14 февраля**: `WalkRating` — форма оценки после прогулки, пересчёт `trust_rating` в `Profile`.

Структура моделей под эти этапы уже в `backend/walks/models.py` — расширяйте по мере реализации.
