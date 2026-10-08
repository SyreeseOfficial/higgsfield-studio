# Higgsfield Studio

A single-user, localhost-only UI for generating images and video with the
[Higgsfield](https://higgsfield.ai) API. No accounts, no auth — it's a local
tool for one person's own API key.

- `web/` — Vite + React frontend
- `server/` — Express + SQLite backend (proxies every Higgsfield call; the
  browser never sees your API key)

## Run it

```bash
npm run install:all
npm run dev
```

This starts the server on `http://localhost:8787` and the web app on
`http://localhost:5173`. Open the web app.

## Connecting your Higgsfield API key

The key is **not** an environment variable. Open the app, go to Settings,
and use **Connect API key** to paste the key copied from
[open.higgsfield.ai/api-keys](https://open.higgsfield.ai/api-keys). It's
validated against the live API, then stored AES-256-GCM-encrypted in the
local SQLite database (`server/data/`) — never in source, never in a log.

## Config

The only environment variable the server reads is `PORT` (default `8787`).
See `.env.example`.
