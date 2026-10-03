# Chess server
1. Залей server.js, engine.js, package.json в репозиторий GitHub.
2. Render.com -> New -> Web Service -> репозиторий. Build: `npm install`, Start: `npm start`, план Free.
3. Environment -> добавь GROQ_API_KEY (твой ключ с console.groq.com). Необязательно: GROQ_MODEL (по умолчанию llama-3.1-8b-instant).
   Без ключа игра работает, правила разбирает встроенный разборщик.
4. Адрес https://xxx.onrender.com -> замени https на wss и вставь в index.html вместо wss://CHANGE-ME.onrender.com
5. В консоли Яндекс Игр добавь хост xxx.onrender.com в правила CSP (нужны и https, и wss).

## Чтобы сервер не засыпал (Render Free)
Render усыпляет бесплатный сервис через 15 минут без входящего трафика (HTTP-запросы и сообщения по WebSocket считаются).
Игра сама «будит» сервер при открытии. Чтобы он не спал и между играми: UptimeRobot или cron-job.org, GET на https://xxx.onrender.com/ каждые 5-10 минут.
Не пингуй /robots.txt: на спящем сервисе Render отвечает на него сам и не будит сервис.
Лимит Render: 750 бесплатных часов в месяц на аккаунт. Один сервис 24/7 = ~744 ч, на второй уже не хватит.
Кэш разборов и комнаты живут в памяти и пропадают при перезапуске.
