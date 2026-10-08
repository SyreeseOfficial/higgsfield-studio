# Studio: TODO

Single-user tool on localhost, no accounts/auth. `Studio v8.dc.html` + `support.js` are the original
UI source of truth, kept for reference only — the real app is `web/` + `server/`.

---

## Open

Nothing open right now. Genjutsu and Cinema Studio are the only unwired models left, and that's not
a build task — see the Model catalog note below.

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
- Generation submission goes through the official `@higgsfield/client` SDK (`v2`'s `subscribe()`, `withPolling: false` — we poll ourselves for incremental per-item status). The SDK only covers submission, nothing else (no standalone status check, cancel, or presigned-upload helper), so `getStatus`/`cancelRequest`/`uploadFile` stay on raw REST — that's what the SDK itself falls back to.
- Root `README.md` + `.env.example` added (how to run, `PORT`, and that the Higgsfield key goes through Settings, not an env var).
- Duplicate submissions guarded in both places: `App.tsx`'s `runGen()` refuses re-entry while a submission is in flight (every Generate button reflects this as a normal disabled state); `POST /api/generations` separately rejects an exact repeat within a 4s window server-side.

### Model catalog
- `GET /api/models` lists the real catalog, synced against `open.higgsfield.ai/explore` and Higgsfield's official template registry (`pnpm dlx shadcn@latest view higgsfield-ai/app-templates/<model>` — real first-party source, not a guess).
- 38 of 40 models wired to real endpoints: `soul`, `soul-v2`, `soul-cinema`, `seedance`, `seedance-2-5`, `seedance-2-5-edit`, `seedance-2-5-extend`, `kling`, `kling-standard`, `kling-2-6`, `kling-3-turbo`, `kling-3-std`, `kling-3-pro`, `kling-3-4k`, `kling-3-motion-std`, `kling-3-motion-pro`, `kling-o1`, `kling-o3`, `minimax`, `minimax-h3`, `flux-2`, `flux-3`, `dop`, `pixverse-6`, `wan-2-6`, `wan-2-7`, `wan-3`, `wan-3-prime`, `happy-horse-1-0`, `happy-horse-1-1`, `ltx-2-5-fast`, `ltx-2-5-pro`, `grok-image`, `grok-video`, `ideogram`, `recraft`, `qwen-image`, `z-image`. Generic ones share one path/body mapper (`GENERIC_VIDEO`/`GENERIC_IMAGE` + `mapByPaths()` in `higgsfield.ts`), ported from the template's own mapper; Kling 3.0's 6 variants and the Seedance 2.5 family have bespoke branches (also ported from the template's own mapper functions, not guessed).
  - Seedance 2.5 Edit/Extend need a "source" video role the template keeps separate from its generic "video" reference role; this composer has no dedicated source-video control, so it reuses the existing "Videos" attach option instead — the first attached video is the source, any further ones become the optional extra references. No new UI, just that reuse plus a clear "Attach a video" error when none is given.
- Only 2 models remain unwired, and it's not a build task: Genjutsu and Cinema Studio aren't in Higgsfield's template registry, the OpenAPI spec, or anywhere else checked this session — there's no real schema to wire up, not a missing feature on our end. Revisit only if Higgsfield publishes one.
- Excluded: Ads Studio, Product Shots, Graphic Ads, Marketplace Design, Marketing Studio Image, AI Influencer — brand/product-asset workflows, not prompt-to-image/video models.
- Bugs found live and fixed: switching models didn't reset resolution/ratio to a value valid for the new model (only duration was); Seedance's resolution enum was `'4K'`, the real API wants `'4k'`; image-only models (DoP, Kling O1/O3) could submit with no reference and have Higgsfield silently accept + start charging — now fails instantly with a clear error instead.
- Kling 3.0/Seedance 2.5 settings with no UI control (`multiShots`, `cfgScale`, `characterOrientation`, `keepOriginalSound`) are left at their documented defaults rather than adding new pills — `sound` is the one exception, it reuses the existing Audio toggle (`job.audio`) rather than adding a second one.

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
