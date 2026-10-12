<!--
  My Rules Chess
  A browser chess sandbox where you make the rules.
-->

<div align="center">

# ♟ My Rules Chess

### Chess, but you make the rules.

A browser-based chess sandbox for inventing unusual chess variants in plain language.

<p>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-vanilla-f7df1e?logo=javascript&logoColor=222" />
  <img alt="Node.js 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white" />
  <img alt="Languages" src="https://img.shields.io/badge/UI-English%20%7C%20Русский-5865F2" />
  <img alt="Project status" src="https://img.shields.io/badge/status-experimental-orange" />
</p>

</div>

---

## ✨ What is it?

**My Rules Chess** starts with familiar chess, then lets you reshape how the pieces behave. Describe a rule in Russian or English, apply it to the game, and see what happens.

Play locally against a lightweight bot, or create an online room and invite someone with a short room code.

## 🎮 Features

- **Rules in plain language** — describe a rule instead of editing configuration by hand.
- **Custom piece movement** — change movement directions and range, jump over pieces, or teleport to empty squares.
- **Fantasy abilities** — add shooting, swapping with an ally, explosions on capture, immunity, or protection from nearby pieces.
- **Change the basics** — adjust pawn captures, promotion, castling, check and checkmate, and which piece decides the win.
- **Play your way** — practice against the built-in bot or play online through private rooms.
- **Quick rematch and draws** — offer a draw, resign, or request a rematch in online games.
- **Russian and English UI** — the interface follows the browser language when possible.
- **Light and dark themes** — switch the board's appearance.

### A few rule ideas

Try things like:

- `Bishop moves like a knight`
- `The queen can jump over pieces`
- `Pawns capture only straight ahead`
- `The queen is invulnerable`
- `The bishop explodes when it captures`
- `The knight can teleport once per game`
- `No check or checkmate`

The built-in parser recognizes a subset of common rules. When the server is configured with a Groq API key, the game can use an AI-assisted parser for more flexible descriptions. Unsupported ideas are not guaranteed to work; see [Limitations](#-limitations).

## 🧩 Project structure

```text
My-Rules-Chess/
├── myruleschess/
│   ├── client/
│   │   └── index.html       # Browser UI, chess engine and local play
│   └── server/
│       ├── server.js        # HTTP API and WebSocket rooms
│       ├── engine.js        # Rules, moves and game endings
│       ├── package.json
│       └── README.md        # Server deployment notes
└── README.md
```

The client is built with **HTML, CSS and vanilla JavaScript**. The optional backend uses **Node.js** and the `ws` WebSocket library. Groq is used only for AI-assisted rule interpretation.

## 🚀 Run locally

### 1. Requirements

- Node.js **18 or newer**
- A browser
- A Groq API key only if you want AI-assisted rule interpretation

### 2. Start the server

From the repository root:

```bash
cd myruleschess/server
npm install
npm start
```

The server listens on port `8080` by default (or the port provided by the `PORT` environment variable).

### 3. Configure the client

Open `myruleschess/client/index.html` and find:

```js
const SERVER = 'wss://CHANGE-ME.onrender.com';
```

For local development, change it to:

```js
const SERVER = 'ws://localhost:8080';
```

Serve the client directory over HTTP — for example, in a second terminal:

```bash
cd myruleschess/client
python -m http.server 5500
```

Then open [http://localhost:5500](http://localhost:5500).

> Keep the server running in the first terminal. The local board and built-in rule parser can work without a configured Groq key; online rooms and the server-assisted parser need the backend.

### 4. Enable AI-assisted rule interpretation (optional)

Set `GROQ_API_KEY` in the server environment before starting the server.

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

You can optionally set `GROQ_MODEL` to choose a preferred model. The server has fallback models configured. **Never commit your API key to the repository.**

## ☁️ Deploy the backend

The server can be deployed as a Node.js web service. For example, on Render:

1. Create a new **Web Service** connected to this repository.
2. Set **Root Directory** to `myruleschess/server`.
3. Use `npm install` as the build command and `npm start` as the start command.
4. Add `GROQ_API_KEY` as an environment variable if you want AI-assisted rules.
5. Copy the deployed service URL and update `SERVER` in `myruleschess/client/index.html` to use its WebSocket URL, such as `wss://your-service.onrender.com`.

For an HTTPS-hosted client, use **WSS** rather than **WS**. If publishing through Yandex Games, add the backend's HTTPS and WSS origins to the game's Content Security Policy. More server notes are available in [`myruleschess/server/README.md`](myruleschess/server/README.md).

## ⚙️ How it works

- **Local play:** the chess engine runs in the browser. The built-in bot uses a lightweight move-scoring heuristic; it is not a full-strength chess engine.
- **Online play:** the backend synchronizes game state over WebSockets. A four-character room code is used to create or join a room.
- **Rule parsing:** a built-in parser handles familiar patterns. If `GROQ_API_KEY` is set, the backend can ask a Groq-hosted model to interpret more varied rule descriptions.
- **Rule changes:** rules can be set before the first move. During a game, a player can change them on their turn after every two of their own moves; changing rules does not consume a move.

## ⚠️ Limitations

- Not every imaginable chess variant can be expressed. New piece types, extra turns, freezing, resurrection, board reshaping, and time-based effects are not implemented.
- The built-in bot is intentionally simple and may make weak moves, especially with unusual rules.
- Online room state and the rule-parsing cache are stored in memory. Active rooms and cached results are lost when the server restarts.
- The online mode and AI-assisted parsing require the backend URL to be configured for your deployment.

## 📄 Credits

Chess piece artwork is based on the **Cburnett** set by Colin M. L. Burnett and is included under the BSD license; the license notice is retained in the client source.

---

<div align="center">

Made for experimenting with chess — one rule at a time.

</div>
