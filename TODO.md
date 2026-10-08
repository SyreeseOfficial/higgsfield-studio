# Studio: TODO

Single-user tool on localhost, no accounts/auth. `Studio v8.dc.html` + `support.js` are the original
UI source of truth, kept for reference only — the real app is `web/` + `server/`.

---

## Open

- [ ] **Switch to the official SDK** (`@higgsfield/client`, matches docs.higgsfield.ai/docs/how-to/sdk). `server/src/higgsfield.ts` hand-rolls raw `fetch()` instead. Check each call (`createOne`, `getStatus`, `cancelRequest`, `uploadFile`) against what the SDK supports — keep raw REST only for what it can't do.
- [ ] **Guard duplicate submissions — UI and server.** `generate()`/`runGen()` (`App.tsx`) has no in-flight lock; a double-click fires two generations. `POST /api/generations` (`generations.ts`) has no server-side de-dup either.
- [ ] **Add setup docs.** No root README or `.env.example` since the Vite/Express rewrite. Need: how to run (`npm run dev`), `PORT`, and that the Higgsfield key is entered via Settings (encrypted in SQLite), not an env var.
- [ ] **Wire up Kling 3.0, Seedance 2.5, Genjutsu, Cinema Studio.** Kling 3.0 (6 variants) and Seedance 2.5 (3 variants) have exact schemas in Higgsfield's template registry (`generation/catalog/models/kling-3.ts`, `seedance-2.5.ts`) but need new UI first: a `sound` on/off toggle + `multiShots` boolean for Kling 3, a "source video" media role for Seedance 2.5 Edit/Extend. Genjutsu and Cinema Studio aren't in the registry at all — still no schema.

---

## Done

### Backend port
- Ported the `.dc.html` UI into React (`web/`); built an Express + better-sqlite3 server (`server/`).
- All Higgsfield calls proxied server-side (`higgsfield.ts`) — browser never sees the API key.
- API key: `POST/GET/DELETE /api/key`, AES-256-GCM encrypted at rest (`crypto.ts`).
- Generation: `POST/GET/DELETE /api/generations`, polls Higgsfield, saves outputs to `/media/...`.
- Errors mapped to real statuses (401/403/423/503/5xx/concurrency-400 → our own 429).
- Persistence: `generations`, `items`, `projects`, `uploads`, `generation_refs` tables; favorites and project order survive a refresh.
- Removed all demo/seed data and fake props.
- No balance/credits endpoint exists on Higgsfield's API — not faked; Settings links to their pricing page instead.

### Model catalog
- `GET /api/models` lists the real catalog, synced against `open.higgsfield.ai/explore` and Higgsfield's official template registry (`pnpm dlx shadcn@latest view higgsfield-ai/app-templates/<model>` — real first-party source, not a guess).
- 29 of 33 models wired to real endpoints: `soul`, `soul-v2`, `soul-cinema`, `seedance`, `kling`, `kling-standard`, `kling-2-6`, `kling-o1`, `kling-o3`, `minimax`, `minimax-h3`, `flux-2`, `flux-3`, `dop`, `pixverse-6`, `wan-2-6`, `wan-2-7`, `wan-3`, `wan-3-prime`, `happy-horse-1-0`, `happy-horse-1-1`, `ltx-2-5-fast`, `ltx-2-5-pro`, `grok-image`, `grok-video`, `ideogram`, `recraft`, `qwen-image`, `z-image`. Generic ones share one path/body mapper (`GENERIC_VIDEO`/`GENERIC_IMAGE` + `mapByPaths()` in `higgsfield.ts`), ported from the template's own mapper.
- Excluded: Ads Studio, Product Shots, Graphic Ads, Marketplace Design, Marketing Studio Image, AI Influencer — brand/product-asset workflows, not prompt-to-image/video models.
- Bugs found live and fixed: switching models didn't reset resolution/ratio to a value valid for the new model (only duration was); Seedance's resolution enum was `'4K'`, the real API wants `'4k'`; image-only models (DoP, Kling O1/O3) could submit with no reference and have Higgsfield silently accept + start charging — now fails instantly with a clear error instead.

### Assets, history, uploads
- `GET /api/assets` (filters, cursor paging, FTS5 prompt search), `GET /api/assets/ids`, `GET /api/counts` — all server-side.
- Uploads: `POST/GET/DELETE /api/uploads`; composer sends real `uploadId`s, not blob URLs, with background upload + per-chip progress; delete waits out the undo toast before hitting the server.
- Max upload size 50MB; no total quota (single-user tool).

### Clean-up
- Removed a duplicate `onKeyInput` definition, the dead `picsum.photos` placeholder, and the dead `src()`/`RATIOS`/`OPTS` helpers.
- Zip download no longer needs a server-side route — media is same-origin now.
- Theme and default mode persist to `localStorage`.
- Uploads shortcuts added to the Shortcuts sheet.

### Nice to have
- "Choose from Uploads" picker in the composer's attach menu.
- Drag an Uploads tile onto the sidebar's Create nav to attach + jump to Create.
- Duplicate-upload detection by content hash, with a one-click "select duplicates" cleanup.
- `GET /api/export` backs up the SQLite file + media folder as a zip.
