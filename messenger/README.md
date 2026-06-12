# 💬 Dmitry Messenger

Мессенджер по типу Telegram — веб-приложение + десктопное приложение (Electron).

## Возможности

- 📝 Регистрация и вход
- 💬 Сообщения в реальном времени (WebSocket)
- 🔍 Поиск пользователей
- 🟢 Статус онлайн/оффлайн
- ⌨️ Индикатор «печатает...»
- 🌙 Тёмная тема (как в Telegram)
- 📱 Адаптивный дизайн (работает на телефоне)
- 💾 Все сообщения сохраняются (SQLite)

## Быстрый старт (в браузере)

```bash
cd messenger
npm install
npm start
```

Открой в браузере: **http://localhost:3000**

## Запуск как десктопное приложение (Electron)

```bash
cd messenger
npm install
npm run desktop
```

Откроется окно приложения.

## Сборка .exe (Windows)

```bash
cd messenger
npm install
npm run build-win
```

Готовый файл появится в папке `dist/`.

## Технологии

| Компонент | Технология |
|-----------|------------|
| Frontend | Vanilla JS + CSS (без фреймворков) |
| Backend | Node.js + Express |
| Реальное время | WebSocket (ws) |
| База данных | SQLite (better-sqlite3) |
| Авторизация | bcrypt + UUID сессии |
| Десктоп | Electron |

## Структура проекта

```
messenger/
├── server/
│   ├── index.js    # Express сервер + WebSocket
│   └── db.js       # SQLite база данных
├── public/
│   ├── index.html  # HTML страница
│   ├── style.css   # Стили (тёмная тема)
│   └── app.js      # Клиентский JavaScript
├── electron.js     # Electron обёртка
└── package.json
```
