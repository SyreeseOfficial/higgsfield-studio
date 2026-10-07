# Studio: TODO for local build

Source of truth: `Studio v8.dc.html`. Earlier versions (`Studio.dc.html`, `Studio v2` to `v7`) can be deleted.

Scope: a single-user tool on localhost. **No accounts or auth.**

The UI is finished, but every "server" call is faked in memory. Search the file for `TODO(backend)` and `TODO(models)` to find each spot. Most network calls go through the `api = { ... }` object in the logic class. Swap each stub there for a `fetch` to the local server; the rest of the UI shouldn't need to change. Generation, key handling and upload storage don't go through `api` yet. P0 covers moving them in.

---

## P0: Port and backend (required before real use)

- [ ] **Pick a stack and port.** Suggested: Vite + React for the front end, plus a small Node (Fastify/Express) or Python (FastAPI) server. Port the `.dc.html` template and logic class into React components. Inline styles and CSS variables carry over as they are.
- [ ] **Higgsfield proxy.** All Higgsfield calls go server-side. The browser never sees the key. This also avoids CORS.
- [ ] **API key storage.** Replace `submitKey()` (it currently accepts any key after 900ms) with:
  - `POST /api/key` validates against Higgsfield, then stores the key encrypted at rest (local file or SQLite with an OS-keychain or env secret).
  - `GET /api/key` returns `{ connected, last4, status: 'valid'|'low'|'invalid', credits }`.
  - `DELETE /api/key` removes the key.
  - Remove the hardcoded `keyHint: '7f3a'` and `Component.CREDITS`.
- [ ] **Credits.** Read the real balance from Higgsfield. Remove the client-side math in `refund()` and `runGen()` and re-fetch the balance after each job.
- [ ] **Generation.** Replace the `setTimeout` in `runGen()`:
  - `POST /api/generations` with `{ type, model, prompt, negative, ratio, res, fmt, duration, audio, batch, project, refUploadIds }` returns `{ id }`.
  - Progress via SSE or polling (`GET /api/generations/:id`). Video takes minutes, so the server needs to keep polling Higgsfield or receive webhooks.
  - Cancel: `DELETE /api/generations/:id` (`cancelGen()`).
  - Save the outputs to disk and serve them from `/media/...`. Replace the `picsum.photos` URLs in `src()`.
- [ ] **Errors and rate limits.** Map real responses onto the existing UI states:
  - 401 → `keyState: 'invalid'`
  - 402 → not enough credits
  - 429 + `Retry-After` → `startRate(sec)`
  - timeout, 5xx and content-filter errors → `Component.ERRORS`
  - Remove the random 25% failure (`props.failures`).
- [ ] **Persistence (SQLite is fine).** Tables: `generations`, `items`, `projects`, `uploads`, `generation_refs` (generation ↔ upload). Today everything except the prompt draft is lost on refresh. Project order and favorites need to persist too.
- [ ] **Remove demo data and props:** `seedGens`, `ARCHIVE`, `seedFailed`, `seedUploads`, and the props `apiKeyConnected`, `keyStatus`, `network`, `failures`, `startEmpty`.

## Models and pricing: FIX LATER

- [ ] **Fix later when exporting.** The model list and credit costs are placeholders.
  - `api.listModels()` currently returns `Component.PLACEHOLDER_CATALOG` (hardcoded names and `cost.perOutput`: 4 per image, 20 per video).
  - Replace it with `GET /api/models`, which fetches the catalog and pricing from Higgsfield and caches it server-side. Then delete `PLACEHOLDER_CATALOG`.
  - All cost math already goes through `costOf()`, so only the catalog source changes. If Higgsfield prices video per second or per resolution, extend `costOf()` (e.g. `cost.perSecond * duration`).
  - Per-model options are also hardcoded: `Component.RATIOS`, `Component.OPTS` (resolution/format), and the duration choices 5s/10s. These should come from each model's capabilities in the catalog.
  - The UI already handles a slow or failed catalog load: Generate shows "Loading models" or "Models unavailable".

## History and paging (done in UI, needs endpoints)

- [ ] `GET /api/assets?view&type&model&project&fav&ratio&sort&q&cursor&limit` returns `{ ids | items, nextCursor, total }`. Replace the stub in `api.listAssets`.
  - The grid already pages 24 at a time with cursors, shows skeletons, and refreshes when new items arrive.
  - Search is debounced (250ms) and runs server-side. Use SQLite FTS5 on prompts.
- [ ] `GET /api/assets/ids?<filters>` returns all matching ids, for "Select all N" (`api.listAssetIds`).
- [ ] Return items rather than ids once the client no longer keeps every generation in memory. Today `fetchPage` resolves ids against local state.
- [ ] Sidebar counts (Assets, Favorites, project counts) are computed locally. Replace with `GET /api/counts`.
- [ ] The Create feed pages through items already loaded in the browser (`feedShown`). Move it to a cursor endpoint as well.
- [ ] Lightbox prev/next stops at the last loaded item. Fetch the next page when the user reaches it.

## Uploads (done in UI, needs storage)

New **Uploads** view in the sidebar. Every file attached as a reference, or uploaded to Assets, is saved here.

The UI already has:
- Search, type filter, Used/Unused filter, sort
- Clean up menu: select unused, older than 30 days, or larger than 25 MB, plus one-click "Delete N unused"
- Multi-select with shift-range, Cmd/Ctrl+A, and the Delete key
- Bulk "Use as reference", bulk zip download, bulk delete with undo
- Preview with prev/next and "Used in" links

Backend work:
- [ ] `POST /api/uploads` (multipart): store the file, generate a thumbnail (images; first frame for video; waveform optional for audio), and record `{ id, kind, name, size, w, h, dur, createdAt }`.
- [ ] `GET /api/uploads?type&usage&sort&q&cursor`. Usage ("Used in N") comes from `generation_refs`.
- [ ] `DELETE /api/uploads` with body `{ ids }`.
  - Decide whether generations that used a deleted file keep a thumbnail. Recommended: keep a small thumbnail, delete the original.
  - Undo is a client toast today. Either soft-delete with a ~10s purge, or delay the real delete until the toast expires.
- [ ] Composer references should send `uploadId`s, not blob URLs. Replace `blobUrl()` / `uploadRec()` with an upload-then-reference flow, and show progress per chip while uploading.
- [ ] Limits: max file size and an optional total storage quota. Show storage used (the header already shows the total).
- [ ] "Use as reference" for an upload that's an Assets image: confirm Higgsfield accepts it as a reference input.

## Clean-up items

- [ ] `onKeyInput` is defined twice in `buildVals()`. Remove the first one.
- [ ] Zip download fetches files in the browser. Once media is served from your own server, CORS is fine. Otherwise build the zip server-side (`POST /api/zip`).
- [ ] Theme and default mode (Settings) aren't saved. Persist them in localStorage or `GET/PUT /api/settings`.
- [ ] Add Uploads shortcuts to the Shortcuts sheet (`/` search, ←/→ in preview, Delete, Cmd/Ctrl+A).

## Nice to have

- [ ] "Choose from Uploads" picker inside the composer's attach menu (today you start from the Uploads page).
- [ ] Drag an upload from the Uploads grid straight onto the composer.
- [ ] Find duplicate uploads by content hash and offer to merge them.
- [ ] Export or back up the SQLite file and media folder.
