# Studio: TODO for local build

Source of truth: `Studio v8.dc.html`. Earlier versions (`Studio.dc.html`, `Studio v2` to `v7`) can be deleted.

Scope: a single-user tool on localhost. **No accounts or auth.**

The UI is finished, but every "server" call is faked in memory. Search the file for `TODO(backend)` and `TODO(models)` to find each spot. Most network calls go through the `api = { ... }` object in the logic class. Swap each stub there for a `fetch` to the local server; the rest of the UI shouldn't need to change. Generation, key handling and upload storage don't go through `api` yet. P0 covers moving them in.

---

## P0: Port and backend (required before real use) — DONE

- [x] **Pick a stack and port.** Vite + React front end (`web/`), Express + better-sqlite3 server (`server/`). The `.dc.html` template was ported into React components (`af143aa`, `e45b043`).
- [x] **Higgsfield proxy.** All Higgsfield calls go through `server/src/higgsfield.ts`; the browser only ever talks to the local Express server.
- [x] **API key storage.** `server/src/routes/key.ts`: `POST /api/key` validates against the live API then stores it AES-256-GCM-encrypted at rest (`crypto.ts`); `GET /api/key` returns `{ connected, last4, status }`; `DELETE /api/key` removes it. No `credits`/`'low'` status — see the credits item below, there's no real number to report. `keyHint`/`Component.CREDITS` are gone.
- [x] ~~**Credits.** Read the real balance from Higgsfield.~~ Not possible: Higgsfield's public API has no balance/credits endpoint (checked their OpenAPI spec and billing docs — the number only exists on their web dashboard, the `hf` CLI, and an unrelated MCP tool, none reachable with a plain API key; see the `ponytail:` comment in `server/src/higgsfield.ts`). The client-side cost math (`costOf()`, `refund()`-adjacent code) is removed rather than left showing a fake number; Settings links out to `higgsfield.ai/pricing` instead.
- [x] **Generation.** `server/src/routes/generations.ts`: `POST /api/generations` submits to Higgsfield and persists the generation; `GET /api/generations/:id` polls Higgsfield for any still-pending item and flips it to completed/failed; `DELETE /api/generations/:id` cancels the outstanding Higgsfield requests. Outputs are fetched and written under `data/media/<genId>/`, served from `/media/...`. The `picsum.photos` placeholder in `src()` was dead code (every item that reaches render is from a `status: 'completed'` generation, which always has a real `url`) — removed, along with `src()` itself.
- [x] **Errors and rate limits.** `errFromStatus()`/`isConcurrencyLimit()` in `higgsfield.ts` map 401 → invalid key, 403 → not enough credits (Higgsfield returns 403 here, not 402), 423 → model blocked, 503 → model unavailable, 5xx → server error, the concurrency-limit 400 → a real 429 + `Retry-After` header. The random 25% failure (`props.failures`) is gone.
- [x] **Persistence.** `server/src/db.ts` has `generations`, `items`, `projects`, `uploads`, `generation_refs` tables. Everything survives a refresh; favorites (`items.fav`) and project order (`projects.sort`) persist too.
- [x] **Remove demo data and props.** `seedGens`, `ARCHIVE`, `seedFailed`, `seedUploads`, `apiKeyConnected`, `network`, `failures`, `startEmpty` — none remain in `web/src/App.tsx`.

## Models and pricing: DONE (within API limits)

- [x] **`GET /api/models`** (`server/src/routes/models.ts`) replaces `PLACEHOLDER_CATALOG`. Higgsfield has no catalog or pricing API (checked their OpenAPI spec and docs — same gap as the balance endpoint below), so this is hand-synced against two sources: `open.higgsfield.ai/explore` (which models are real) and, since 2026-10-09, Higgsfield's own official Next.js template registry — `pnpm dlx shadcn@latest view higgsfield-ai/app-templates/<model>` returns that model's real TypeScript source (`generation/catalog/models/*.ts` + `defaults.ts`/`mappers.ts`), which is first-party ground truth for the request schema, not a guess. That unlocked wiring up 29 of the 33 catalog models for real (`soul`, `soul-v2`, `soul-cinema`, `seedance`, `kling`, `kling-standard`, `kling-2-6`, `kling-o1`, `kling-o3`, `minimax`, `minimax-h3`, `flux-2`, `flux-3`, `dop`, `pixverse-6`, `wan-2-6`, `wan-2-7`, `wan-3`, `wan-3-prime`, `happy-horse-1-0`, `happy-horse-1-1`, `ltx-2-5-fast`, `ltx-2-5-pro`, `grok-image`, `grok-video`, `ideogram`, `recraft`, `qwen-image`, `z-image` — see `GENERIC_VIDEO`/`GENERIC_IMAGE` in `higgsfield.ts` for the shared generic path/body mapper, ported from the template's own `mapByPaths()`). Only 4 remain unverified — `kling-3` (6 variants, custom mapper, needs new UI controls for `sound`/`multiShots`/`cfgScale`), `seedance-2-5` (3 variants, needs a "source video" UI role for edit/extend), `genjutsu`, `cinema-studio` (not in the template registry at all, may be separate workflow products) — picking one of those still surfaces the honest "Model not connected yet" error. Excluded: Ads Studio, Product Shots, Graphic Ads, Marketplace Design, Marketing Studio Image, AI Influencer — brand/product-asset workflows, not plain prompt-to-image/video models.
  - Fixed a real bug this surfaced: switching models didn't reset `resolution`/`aspect ratio` to a value valid for the new model (only `duration` was reset) — caught live when Z-Image Turbo inherited Soul's `'2K'` and Higgsfield's API rejected it (`resolution: '2K' is not one of ['1k', '2k']`). Model switching now resets all three.
  - Fixed a second bug: Seedance's resolution enum was `'4K'` (uppercase K); the real API wants lowercase `'4k'`.
  - All `costOf()`/credit-math UI (rerun cost, pending-item cost) is removed rather than left showing fake numbers. Settings links out to `higgsfield.ai/pricing` instead.
  - `Component.RATIOS`/`OPTS`/duration choices stay hardcoded — Higgsfield's docs don't expose per-model capability metadata either, so there's nothing real to fetch them from.
  - The UI still handles a slow/failed catalog load the same way ("Loading models" / "Models unavailable").

## History and paging — DONE

- [x] `GET /api/assets?view&type&model&project&fav&ratio&sort&q&cursor&limit` (`server/src/routes/assets.ts`) returns `{ ids, nextCursor, total }`. Filters, sort and cursor paging all run server-side; search runs through SQLite FTS5 on `generations.prompt`.
- [x] `GET /api/assets/ids?<filters>` (`assetsRouter.get("/ids")`) returns every matching id for "Select all N".
- [x] Sidebar counts (Assets, Favorites, project counts, upload bytes) come from `GET /api/counts` (`countsRouter`), not client-side computation.
- [x] ~~The Create feed pages through items already loaded in the browser (`feedShown`). Move it to a cursor endpoint as well.~~ `GET /api/generations` already returns every generation unconditionally (`loadGenerations()`), so the whole history is already in memory — a cursor endpoint here would add a network layer in front of data that's already local. Revisit only if that full-history load itself becomes the bottleneck.
- [x] Lightbox prev/next stops at the last loaded item. `lbStep()` now fetches the next page (`fetchPage()`) when it runs past the end of `gridIds` on Assets/Favorites, instead of silently stopping.

## Uploads — DONE

New **Uploads** view in the sidebar. Every file attached as a reference, or uploaded to Assets, is saved here.

The UI already has:
- Search, type filter, Used/Unused filter, sort
- Clean up menu: select unused, older than 30 days, or larger than 25 MB, plus one-click "Delete N unused"
- Multi-select with shift-range, Cmd/Ctrl+A, and the Delete key
- Bulk "Use as reference", bulk zip download, bulk delete with undo
- Preview with prev/next and "Used in" links

Backend work:
- [x] `POST /api/uploads` (multipart, `uploads.ts`) stores the file and records `{ id, kind, name, size, w, h, dur, createdAt, hash }`. No server-side thumbnail generation: images render directly from the stored file and dims/duration are read client-side before upload (`imgDims()`/`mediaMeta()`) — no image/video processing library needed just to re-derive them.
- [x] `GET /api/uploads?type&usage&sort&q&cursor` — usage count comes from a `generation_refs` join (`uploadsRouter.get("/")`).
- [x] `DELETE /api/uploads` with body `{ ids }`. Resolved both open decisions: a deleted upload's file is independent of `generation_refs.url` (which always stores its own persistent local copy), so past generations keep working after the source upload is gone; and the real delete waits out the ~10s undo toast (`deleteUploads()` in `App.tsx`) rather than firing immediately — undo just cancels the pending `setTimeout` and restores local state.
- [x] Composer references send `uploadId`s, not blob URLs. `addFiles()` shows a local blob preview per chip immediately, uploads in the background via `realUpload()`, and `swapUpload()` replaces the preview with the real `uploadId` (or drops it on failure) everywhere it's referenced.
- [x] Limits: max file size (50MB, `multer`'s `limits.fileSize` in `uploads.ts`). No total quota — single-user localhost tool, decided not worth the friction. Storage-used header now reads `GET /api/counts`'s `uploadBytes` (sum over every upload) instead of summing whatever page of `s.uploads` happened to be loaded client-side, which undercounted past the first page.

## Higgsfield integration audit (found 2026-10-08)

- [ ] **Switch to the official SDK.** `@higgsfield/client` is the real npm package (maintained by Higgsfield, matches docs.higgsfield.ai/docs/how-to/sdk). `server/src/higgsfield.ts` hand-rolls raw `fetch()` instead. Re-check each call (`createOne`, `getStatus`, `cancelRequest`, `uploadFile`) against what the SDK actually supports before porting — only keep raw REST for whatever the SDK can't do.
- [ ] **Guard against duplicate submissions — UI and server.** `generate()` → `runGen()` (`web/src/App.tsx`) has no in-flight lock; a double-click before the first POST resolves fires two generations. Add a `submitting` flag or disable the button until `submitGen` settles. `POST /api/generations` (`generations.ts`) also has no server-side de-dup — the integration brief asks for both, not just the client-side guard.
- [ ] **Add setup docs.** Root README and `.env.example` existed before the Vite/Express rewrite (`e45b043`) and got dropped. Need: how to run (`npm run dev`), `PORT`, and a note that the Higgsfield key is entered via Settings (encrypted in SQLite), not an env var.
- [x] **Kling 2.5 Standard** (`kling-standard`) wired up (`higgsfield.ts`) — `/kling-video/v2.5-turbo/standard/image-to-video`, confirmed via the OpenAPI spec (same body shape as the pro tier, but image-to-video only — no text-to-video counterpart exists for this tier). Submitting without an attached image returns a clear `ERR.needsImage` error instead of guessing a text-to-video call.
- [x] ~~The other 18 unverified models are blocked on missing docs.~~ Superseded 2026-10-09: found Higgsfield's official Next.js template registry (`pnpm dlx shadcn@latest view higgsfield-ai/app-templates/<model>`), which has the real first-party source for nearly all of them. 24 models were wired up this way (see the "Models and pricing" section above) — more than the original 18 unverified ones because the registry also surfaced brand-new models `open.higgsfield.ai/explore` didn't show (Flux 2, Flux 3, Kling 2.6, Kling O1/O3, DoP, PixVerse 6, MiniMax H3, Soul Cinema). Verified live against the real API (not just typechecked): Wan 3.0 and Z-Image Turbo both reached a real "Generating…" state against Higgsfield's live endpoint, and were cancelled before completion to avoid spending credits on a test.
- [x] **Image-only generic models could submit without a reference and burn real credits before failing.** `mapByPaths()` in `higgsfield.ts` started as a faithful port of the template's own mapper, which has this gap: for a model whose only path is `image`/`firstLast` (e.g. `dop`, `kling-o1`, `kling-o3`), with no media attached it fell through to a bare `{ path: paths.image, body }` with no `image_url` — sending an incomplete request instead of catching it client-side. Confirmed live: submitting DoP with no image attached was accepted by Higgsfield and started "Generating…" rather than failing immediately (cancelled before it finished — true cost unverified). Fixed: `mapByPaths()` now returns `null` (→ `ERR.needsImage`) instead of falling through to those bare paths, deliberately diverging from the upstream template.
- [ ] **Kling 3.0, Seedance 2.5, Genjutsu, Cinema Studio remain unwired — now fully spec'd, just need new UI, not research.** The template registry has Kling 3.0's exact schema (6 variants: Turbo/Std/Pro/4K/Motion-Std/Motion-Pro) and Seedance 2.5's (3 variants: base/Edit/Extend) — see `generation/catalog/models/kling-3.ts` and `seedance-2.5.ts` in the registry. Both need real UI work first, not just a `createOne()` branch: Kling 3 has a `sound: "on"|"off"` string toggle (not our boolean audio pill), a `multiShots` boolean with no existing control, and `cfg_scale`; Seedance 2.5 Edit/Extend need a "source video" media role our composer doesn't have (distinct from reference/start-frame). Genjutsu and Cinema Studio aren't in the template registry at all — still no schema, may be separate workflow products like Ads Studio.

## Clean-up items — DONE

- [x] ~~`onKeyInput` is defined twice in `buildVals()`. Remove the first one.~~ Only one definition exists now (`App.tsx:1543`).
- [x] ~~Zip download fetches files in the browser.~~ Media is served from our own server now (`/media/...`), so this is same-origin — no CORS problem to solve, no server-side zip needed.
- [x] Theme and default mode (Settings) persist to `localStorage` (`studio.theme`, `studio.defaultMode`).
- [x] Uploads shortcuts are in the Shortcuts sheet (`/` search, ←/→ in preview, Delete, Cmd/Ctrl+A) — `App.tsx:2689-2694`.

## Nice to have

- [x] "Choose from Uploads" picker inside the composer's attach menu. Jumps to the Uploads page pre-armed in select mode — reuses the existing "Use as reference" bulk action (`useUploads()`) rather than building a second picker UI.
- [x] Drag an upload onto the composer. The Uploads grid and the composer are never on screen at the same time (single-view layout), so the literal ask isn't possible — instead, drag an Uploads tile onto the sidebar's "Create" nav item to attach it as a reference and jump to Create.
- [x] Find duplicate uploads by content hash and offer to merge them. `uploads.hash` (sha256, computed on upload) + a "Select duplicates (keep newest)" entry in the Uploads cleanup menu, which selects every extra copy for the existing bulk-delete flow.
- [x] Export or back up the SQLite file and media folder. `GET /api/export` (Settings → Data → "Export backup") zips a safe `db.backup()` snapshot of `studio.db` plus everything under `data/media/`. No new dependency — reuses the same store-only zip writer the client already uses for asset/upload downloads, ported to Buffer.
