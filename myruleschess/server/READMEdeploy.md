# 🖥 My Rules Chess — Server & Deployment

The backend of the game: an HTTP API for rule parsing (`/parse`), a version check (`/version`), and WebSocket rooms for online matches. This guide explains how to run the server locally and how to put it online.

> Save this file as `myruleschess/server/README.md` — the main README links to it.

## Contents

- [Requirements](#-requirements)
- [Environment variables](#-environment-variables)
- [Run locally](#-run-locally)
- [Deploy on Render](#️-deploy-on-render)
- [Connect the client](#-connect-the-client)
- [Yandex Games](#-yandex-games)
- [Updating after changes](#-updating-after-changes)
- [Troubleshooting](#-troubleshooting)
- [Other hosts](#-other-hosts)
- [Pre-launch checklist](#-pre-launch-checklist)

## 📋 Requirements

- Node.js **18 or newer** (for local runs)
- A [Render](https://render.com) account (or another host that supports Node.js and WebSockets)
- A GitHub repository (private is fine)
- *(optional)* a Groq API key for AI-assisted rule parsing — [console.groq.com](https://console.groq.com)

Without a Groq key the game still works: the built-in parser in the client handles rules, it just understands fewer phrasings.

## 🔑 Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Server port. Defaults to `8080`. Render sets it automatically. |
| `GROQ_API_KEY` | no | Groq key for AI rule parsing. Without it the built-in parser is used. |
| `GROQ_MODEL` | no | Preferred model. If it is unavailable, the server tries fallback models. |

**Never put the key in the code or commit it to the repository** — keep it only in the host's environment variables.

## 💻 Run locally

```bash
cd myruleschess/server
npm install
npm start
```

Check it: open <http://localhost:8080/version> — you should see the server version string.

With the AI parser:

**macOS / Linux**
```bash
export GROQ_API_KEY="your-groq-api-key"
npm start
```

**Windows PowerShell**
```powershell
$env:GROQ_API_KEY = "your-groq-api-key"
npm start
```

For local client development, set `const SERVER = 'ws://localhost:8080';` in `client/index.html` and serve the client folder with any static server:

```bash
cd myruleschess/client
python -m http.server 5500
```

Then open <http://localhost:5500>.

## ☁️ Deploy on Render

### 1. Preparation

1. Make sure the server code is pushed to GitHub.
2. Sign up on Render and let it access your GitHub account. For a private repository, grant access specifically to `My-Rules-Chess`.

### 2. Create the service

1. On Render click **New → Web Service**.
2. Select the **My-Rules-Chess** repository.
3. Fill in the settings:

| Field | Value |
|---|---|
| **Name** | anything, e.g. `my-rules-chess` (becomes part of the URL) |
| **Root Directory** | `myruleschess/server` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (enough to start) |

4. Under **Environment**, add `GROQ_API_KEY` if you want AI parsing. You don't need to add `PORT`.
5. Click **Create Web Service** and wait for the status to become **Live**.

### 3. Verify

Open `https://YOUR-NAME.onrender.com/version` in a browser. If you see the server version, it works.

> You'll need the service URL, e.g. `https://my-rules-chess.onrender.com`, for the client. For WebSocket the same address is written with `wss://`.

### Render free-tier caveats

- The service **sleeps after ~15 minutes without requests**. The first request after idling takes **30–60 seconds**. The client sends a wake-up request when the page opens, but a player may still have to wait.
- On every restart or wake-up, **rooms and the rule-parsing cache are wiped** — they live in memory only. Matches in progress are interrupted.
- To keep the service awake you can set up an external pinger (e.g. UptimeRobot) hitting `/version` every 5–10 minutes. Note Render's free monthly hour limit: staying awake all the time can use it up faster.

## 🔌 Connect the client

In `myruleschess/client/index.html` find:

```js
const SERVER = 'wss://CHANGE-ME.onrender.com';
```

Replace it with your address:

```js
const SERVER = 'wss://my-rules-chess.onrender.com';
```

Notes:

- A page served over **HTTPS** must use **`wss://`**, not `ws://`, or the browser will block the connection.
- Use the address **without** a trailing slash or path.
- The client is a single static file — host it on GitHub Pages, Netlify, Yandex Games, etc.

## 🎮 Yandex Games

When publishing to Yandex Games, add the server address to the game's **Content Security Policy** (allowed connection sources). Otherwise online play and AI parsing will be blocked:

```text
https://my-rules-chess.onrender.com
wss://my-rules-chess.onrender.com
```

(use your own address). You need **both**: `https://` for `/parse` requests and `wss://` for online rooms.

Before uploading to Yandex Games, make sure `index.html` no longer contains `CHANGE-ME`.

## 🔄 Updating after changes

1. Make your changes and push them to GitHub.
2. Render rebuilds and restarts the service automatically (if auto-deploy is on). Progress is shown under **Events**.
3. Open `/version` and confirm the server version has updated.
4. If you changed the **engine** (`engine.js`), update the client too: the same code is embedded in `client/index.html`. The two copies must match, otherwise the client and server will compute moves differently.

## 🩺 Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Online won't connect; browser console shows a mixed-content error | The client is on HTTPS but `SERVER` uses `ws://`. Use `wss://`. |
| `SERVER` still says `CHANGE-ME` | Put your service address there. |
| The first connection is very slow | The free-tier service is waking up from idle. Wait up to a minute. |
| Works locally but not in Yandex Games | The `https://` and `wss://` addresses aren't in the CSP. |
| "Room not found" after a pause | The server restarted; rooms are kept in memory. Create a new room. |
| AI doesn't understand rules and the simple parser kicks in | `GROQ_API_KEY` isn't set, the Groq quota ran out, or the server's request rate limit was hit. The game keeps working — it just uses the built-in parser. |
| `/version` doesn't open | Check **Logs** on Render. Common causes: wrong **Root Directory**, `npm install` didn't run, or a code error. |
| Old behaviour after a deploy | Check `/version` and clear the browser cache or hard-reload the page. |

If you don't need AI parsing at all, simply leave `GROQ_API_KEY` unset.

## 🌍 Other hosts

Any host that can run Node.js **with WebSocket support** will do (Railway, Fly.io, a VPS, etc.). The requirements are the same: Node.js 18+, the `npm install` and `npm start` commands, and the environment variables above. Static-only hosting or serverless functions without persistent connections won't work for online play.

## ✅ Pre-launch checklist

- [ ] The server opens at `/version`
- [ ] `client/index.html` has the real address (`wss://…`), not `CHANGE-ME`
- [ ] `GROQ_API_KEY` lives only in the host's environment variables, not in code
- [ ] `https://…` and `wss://…` addresses are added to the CSP (for Yandex Games)
- [ ] The engine in `server/engine.js` and in `client/index.html` match
- [ ] An online match has been tested from two devices: create a room, make a move, offer a draw, rematch
