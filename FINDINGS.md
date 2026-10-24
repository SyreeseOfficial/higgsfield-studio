# Higgsfield Studio — Findings

Rounds 1 and 2 (both 2026-10-23) added to the existing Planned / Skipped / New-ideas lists and merged everything into one list sorted by value; audited against commit `59fbef0` (server actions, platform client, poller, run controller, storage, upload path, catalog, tests). Open items from the earlier lists are included below (effort `?` where no estimate existed), the 72 done items are kept at the bottom, and the earlier "Issues Needing Review" decisions are kept verbatim after them. `AGENTS.md` is the contract: nothing here breaks the server boundary, dark-only theme or the full model catalog. "(older item)" marks an entry that extends one already in this list.

Effort: **XS** under 5 min · **S** about 15 min · **M** about an hour · **L** half a day · **?** not estimated. Sorted by value, then effort, then area.

**494 items.** 28 high, 290 medium, 176 low.

## Do these first

1. The platform client has no fetch timeout _[Platform, S]_
2. Idempotency is only as good as the client key _[Platform, S]_
3. Starred runs can silently vanish _[Reliability, S]_
4. Result URLs may expire _[Reliability, S]_
5. Server errors reach users verbatim when config is wrong: `readCredentials` throws `Missing… _[Reliability, S]_
6. Bulk download can exhaust memory and silently double-download _[Reliability, S]_
7. The API key sits in the cookie as plain JSON (`encodeCredentials` → `{"apiKey":"…"}`) _[Security, S]_
8. Strengthen the CSP: `script-src 'self' 'unsafe-inline'` negates most XSS protection, and `connect-src… _[Security, S]_

## High value

1. [ ] **[S]** _Platform_ — The platform client has no fetch timeout. `send()` in `generation/platform.ts` calls `fetchImpl(url, …)` with no `AbortSignal`, and `actions.ts` documents that Next dispatches server actions one at a time per client, so a single hung platform call stalls submit, cancel and every status poll behind it. Add `signal: AbortSignal.timeout(15_000)` (30 s for submit) and map the abort to a retryable `unknown` failure.
2. [ ] **[S]** _Platform_ — Idempotency is only as good as the client key. The server action accepts an optional `idempotencyKey` from the browser; a missing key (older client, direct action call) submits a non-idempotent paid job. Generate a key server-side when absent and return it, so every submit has one and the browser can reuse it on retry.
3. [ ] **[S]** _Reliability_ — Starred runs can silently vanish. `saveHistory` truncates to `HISTORY_MAX_RECORDS = 400` with `records.slice(0, 400)`, newest first, so a starred image from last month is dropped once 400 newer runs exist. Exempt starred runs (and runs in a project) from the cap, or archive overflow into a second key instead of deleting.
4. [ ] **[S]** _Reliability_ — Result URLs may expire. History stores the platform's CDN URLs, not the media; if those links are time-limited or the account's retention ends, the gallery shows broken tiles after days. On completion, copy each result into IndexedDB/OPFS as a Blob (with a size budget and eviction of unstarred items) and fall back to the CDN URL; this needs the CDN to send CORS headers, so verify that first (see the thumbnail-cache note under Issues Needing Review).
5. [ ] **[S]** _Reliability_ — Server errors reach users verbatim when config is wrong: `readCredentials` throws `Missing HF_API_BASE_URL`, which `friendlyError` passes through as the tile error. Validate env at boot (`instrumentation.ts` or a Zod-checked `env.ts`) and show a single "Studio isn't configured" screen with the fix, instead of failing every generation.
6. [ ] **[S]** _Reliability_ — Bulk download can exhaust memory and silently double-download. `downloadMany` fetches every URL in parallel (`Promise.all`), keeps all blobs in memory, builds the zip from `arrayBuffer()` copies, and on any single failure falls back to `downloadMedia` for every URL (so already-fetched files are fetched again and browsers block the burst of automatic downloads). Fetch with a small concurrency (3), stream into the zip, skip failed files with a report, and fall back only for those.
7. [ ] **[S]** _Security_ — The API key sits in the cookie as plain JSON (`encodeCredentials` → `{"apiKey":"…"}`). The cookie is httpOnly, but anything that reads the browser profile or a proxy log of `Set-Cookie` gets a reusable key. Encrypt/sign the cookie value with a server secret (AES-GCM with `SESSION_SECRET`) so a copied cookie is useless on another deployment, and rotate on key change.
8. [ ] **[S]** _Security_ — Strengthen the CSP: `script-src 'self' 'unsafe-inline'` negates most XSS protection, and `connect-src 'self' https:`/`img-src https:` allow any host. Move to a nonce-based CSP via middleware (`proxy.ts`), and allow-list the platform CDN/storage hosts learned from `HF_API_BASE_URL` and upload tickets.
9. [ ] **[?]** _Accessibility and i18n_ — Announce generation state changes to screen readers with an `aria-live="polite"` region ("Image ready", "Failed: content filter").
10. [ ] **[?]** _Accessibility and i18n_ — Keyboard path to every tile action (menu button reachable by Tab, not hover-only).
11. [ ] **[?]** _Assets and references_ — "Save as reference" on any finished tile adds it to the asset library without a re-upload (result URL is already public).
12. [ ] **[?]** _Assets and references_ — Reference role picker with plain-language names ("First frame", "Last frame", "Style", "Character") instead of raw role keys.
13. [ ] **[?]** _Code quality testing and dev experience_ — Unit-test `errors.ts` mapping with a table of real platform responses (content filter, credits, rate limit, unknown).
14. [ ] **[?]** _Cost and usage awareness_ — Credits/balance indicator in the sidebar if the platform exposes it *(check)*; warn before a run that exceeds it.
15. [ ] **[?]** _Detail modal and viewers_ — Keep the detail modal open and update it live when its run finishes (running -> ready) instead of requiring a close and reopen.
16. [ ] **[?]** _Editing and post-processing_ — Upscale action on image tiles (platform has upscale endpoints in the Higgsfield toolset; wire as a catalog model or action).
17. [ ] **[?]** _Gallery and organization_ — Search history by prompt text, model, and date.
18. [ ] **[?]** _Gallery and organization_ — Text search over prompts in the feed header (client-side over the 400 records), debounced, with match highlight. Narrower than the "search history" item above and cheap to ship first.
19. [ ] **[?]** _Generation workflow_ — Seed control and "lock seed" toggle for models that expose one, so the user can A/B a single setting.
20. [ ] **[?]** _Generation workflow_ — "Retry with edits": on a failed tile, open the dock prefilled with the run's prompt and settings, with the error reason shown above the box.
21. [ ] **[?]** _Generation workflow_ — Duplicate-submit guard: if the prompt, model, settings and references are identical to a run submitted in the last 10 s, ask before sending a second paid job.
22. [ ] **[?]** _Models and settings_ — "Why this model" compare drawer: side-by-side table of all models for the current surface (inputs, max duration, speed, aspect ratios).
23. [ ] **[?]** _Onboarding and first run_ — First-run checklist card: add key -> first image -> first video, ticks off as done, dismissible.
24. [ ] **[?]** _Product gaps_ — No way to retry, remix or vary a generation. Grep finds no Retry/Regenerate/Reuse action anywhere; a failed tile just says "Generation unavailable" (`components/studio/generation-card.tsx`), and the tile menu offers Download, Copy prompt, Share, Delete (`gallery-tile.tsx:171-175`). Add **Retry** (resubmit the same plane with a new key) on failed tiles and **Reuse settings** (load prompt, model, settings and references into the dock) on every tile; `RunRecord` already stores `prompt`, `modelId` and `settings`.
25. [ ] **[?]** _Product gaps_ — Chain image to video in one click. The core workflow is generate a still, then animate it, but a finished image can only reach the video dock through the asset library. Add "Animate" on image tiles (switch to a video surface/model that takes a start frame and attach the image as `start`) and "Extend" on video tiles for models that support it (Seedance 2.5 Edit/Extend is already wired). `mergeMedia`/`inputRoles` do the role handling.
26. [ ] **[?]** _Prompt box and input_ — Persist the unsent prompt and attached references per surface (draft survives reload). Overlaps the dead `stores/prompt.ts` item; this is the user-facing outcome.
27. [ ] **[?]** _Resilience safety and privacy_ — Show a clear "runs recovered after reload" notice when in-flight runs resume polling, so the user knows nothing was lost.
28. [ ] **[?]** _Video viewer and tools_ — Custom player: scrub, speed (0.25-2x), frame step, loop, mute default, keyboard (`space`, `j/l`, `,` `.`).

## Medium value

29. [ ] **[XS]** _Bug_ — `kv.ts` opens a new IndexedDB connection on every `get`/`set` and never closes it. With a 250 ms debounced history save, one session leaks hundreds of open connections, and `wipeEverything`'s `deleteDatabase` gets `onblocked` (the code resolves on blocked and relies on the reload). Cache one connection promise, handle `onversionchange` by closing, and await the delete.
30. [ ] **[XS]** _Bug_ — `friendlyError` matches substrings loosely: `/credit|insufficient|balance|payment|quota/` classifies any message containing "credit" (a prompt about a "credit card", a model named "credit") as "Not enough credits", and `/safety/` flags generic text as content-filter. Match on status codes and known platform error codes first, and fall back to text patterns only when no code exists.
31. [ ] **[XS]** _Bug_ — `aspectFromSettings` reads only `aspect_ratio`/`aspectRatio`/`ratio` and defaults to 1; models whose settings use `size` or `resolution` strings with ratios (`1280x720`) get square placeholder tiles that then jump when media loads. Resolve aspect from the result's natural size on first load and persist it on the record.
32. [ ] **[XS]** _Bug_ — `usageStats.perDay` buckets by local midnight using `setHours(0,0,0,0)` with fixed 86,400,000 ms steps; across a DST change the buckets shift by an hour and a day gets double or missing counts. Step by calendar days (`setDate`).
33. [ ] **[XS]** _Bug_ — `usageStats` median seconds uses `completedAt - createdAt`, but `createdAt` is set when the run is added after submit returns (not when the user pressed Generate or when the job started), so queue wait inflates "median time". Record `submittedAt`, `startedAt` (first running status) and `completedAt` separately.
34. [ ] **[XS]** _Bug_ — `zip.ts` writes no modification time (DOS time/date fields stay 0), so extracted files show 1980-00-00 in most tools, and uses 32-bit sizes with no ZIP64, so a bundle over 4 GB (a few long videos) corrupts silently. Set DOS time from the run's `completedAt`, and refuse or split archives approaching 4 GB.
35. [ ] **[XS]** _Bug_ — Zip entry names come from `${i+1}-${filenameFromUrl(...)}` where the file name is the CDN path's last segment (`decodeURIComponent` of whatever the storage uses); names with path separators or control characters from `decodeURIComponent` can create odd entries. Sanitize names and prefix with model and prompt slug.
36. [ ] **[S]** _Accessibility_ — Give every gallery tile a descriptive accessible name (prompt excerpt + model + status) and keyboard roving focus (arrow keys) in the virtualized gallery without unmounting loaded media (AGENTS rule).
37. [ ] **[S]** _Accessibility_ — Respect `prefers-reduced-motion` for autoplaying hover videos and shimmer skeletons; the preferences dialog has "hover play", but the OS setting should override it by default.
38. [ ] **[S]** _Accessibility_ — Provide alt text for generated images derived from the prompt (and let users edit), used in downloads' metadata and the detail modal.
39. [ ] **[S]** _Accessibility_ — Dialog focus management audit: key dialog, settings, usage, privacy, move dialog (Base UI handles most); verify focus returns to the invoker and that Escape closes nested popovers first.
40. [ ] **[S]** _Accessibility_ — Add skip links and landmark roles (`nav` for sidebar, `main` for feed, `form` for the dock) and a visible focus ring token in `app/globals.css` meeting 3:1 contrast on the dark surface.
41. [ ] **[S]** _Accessibility_ — High-contrast preference within the dark-only theme (larger text, stronger borders) since a theme toggle is disallowed by AGENTS.
42. [ ] **[S]** _Accessibility_ — Right-to-left and localization readiness: wrap strings in a `t()` helper and use logical CSS properties; no i18n layer exists today.
43. [ ] **[S]** _Accessibility_ — Provide visible text alternatives for model icons (SVG in `public/model-icons`) and ensure icon-only buttons have `aria-label`s; run `axe` on the dock, the picker and the detail modal in CI.
44. [ ] **[S]** _Bug_ — `mergeRecords` ignores deletions and edits made in another tab (documented), so a run deleted in tab A reappears when tab B saves; and starring in one tab is overwritten by the other's older copy. Add per-record `updatedAt` plus tombstones and merge by newest.
45. [ ] **[S]** _Bug_ — `stopWatching()` clears every watch when the studio unmounts, but `waiting`/`inflight` are module-level; React StrictMode double-mount in development can drop watches that started in the first mount. Make watchers owned by a controller instance created in an effect, not by module state.
46. [ ] **[S]** _Bug_ — `round()` in `poll.ts` fetches statuses for all waiters sequentially in batches of 50 and then `deliver`s; if a batch throws, earlier batches' results are discarded (`results` is local and the catch only counts a miss). Deliver each batch as it returns.
47. [ ] **[S]** _Bug_ — Poll cadence follows the newest watch only (`Math.max(startedAt)`); a long video started an hour ago plus a new image run polls every 4 s for both, wasting calls for the old video. Poll each request on its own backoff schedule and batch only those due.
48. [ ] **[S]** _Bug_ — `getGenerationStatuses` throws `Too many request ids` instead of returning results for the first 50; the client batches at 50 but a bug elsewhere turns into a failed poll round, counted as a "miss". Slice and return partial results.
49. [ ] **[S]** _Bug_ — `submitGeneration` classifies any 4xx as `rejected` (safe to retry with a fresh key) including 408 and 409; a 409 conflict usually means "already accepted", and 408 is a timeout. Treat 408/409/425 as `unknown` so the same idempotency key is reused.
50. [ ] **[S]** _Bug_ — `cancelGeneration` ignores which state the job is in; the platform only cancels queued jobs (docs comment) and returns 202; the UI then shows "Already running, can't cancel" only when the call fails, but a 202 on a running job leaves `canceling: true` until the next poll reports otherwise. Time out the canceling state after two polls and revert.
51. [ ] **[S]** _Bug_ — `settle()` treats `completed` with no URLs as a failure "The generation did not produce media" but a transient empty-result race (status flips before assets attach) is possible; re-poll once or twice before failing.
52. [ ] **[S]** _Bug_ — `settle()` maps `nsfw` to a fixed string but keeps no platform request id on the record; failed tiles want a "Support ID" (platform log says the request id doubles as one) yet queued/failed records only keep `requestId` for submitted runs. Show and copy it on every failed tile and in the detail modal.
53. [ ] **[S]** _Bug_ — `variation()` resubmits `record.media` URLs; if those reference URLs were signed with an expiry, the variation fails with a confusing platform error long after the original run. Store upload expiry (from the upload ticket) and re-upload from the cached blob, or warn on expired references.
54. [ ] **[S]** _Bug_ — `submit()` creates the queued record with `createdAt = Date.now()`, but `start()` creates a new record at submit time; the queue placeholder and the real record have different ids and the gallery briefly shows both or reorders (placeholder disappears when queue entry is filtered). Reuse the placeholder id for the real record so the tile doesn't flicker.
55. [ ] **[S]** _Bug_ — `pending.current` holds one fingerprint; two sequential retries of different planes (user changed the prompt after an ambiguous failure) leave the first job's key forgotten, so a retry of the first plane later creates a duplicate paid job. Keep a small LRU map of fingerprint → key with TTL.
56. [ ] **[S]** _Bug_ — `MAX_RUNNING = 2` is enforced client-side only; opening the studio in two tabs doubles concurrency and the 20-item queue is per tab. Coordinate with `BroadcastChannel` (or a Web Lock) so the cap is global to the browser profile.
57. [ ] **[S]** _Bug_ — `exportHistory` downloads only metadata JSON (URLs), not media; combined with URL expiry the export can't restore a library. Offer "Export with media" (zip via the existing `zip.ts`) and an import that re-creates runs.
58. [ ] **[S]** _Bug_ — `wipeEverything` removes localStorage keys starting with `hf.` and the `studio` IndexedDB only; any other persisted store name (zustand `persist` keys without the prefix) survives. Centralize storage keys and test that wipe leaves nothing.
59. [ ] **[S]** _Bug_ — `usage-dialog` computes stats from the 400 retained records; the dialog reads "Total" as lifetime. Label it "last 400 runs" or maintain running counters outside the capped history.
60. [ ] **[S]** _Bug_ — Downloaded files get opaque CDN names (`generation.bin` when no extension is known). Name downloads `<model>-<prompt-slug>-<yyyymmdd-hhmm>.<ext>` and keep the extension from `Content-Type` or the URL; the history knows model, prompt and time.
61. [ ] **[S]** _Bug_ — `downloadMedia`'s fallback `clickDownload(url, filename, true)` opens the CDN URL in a new tab with a `download` attribute that cross-origin links ignore, so users see a raw image/video tab instead of a download. Show a toast ("Opened in a new tab; use Save as") when the fetch path fails.
62. [ ] **[S]** _Bug_ — `useRunSignals` creates a `Notification` without `tag`, `data` or a click handler: repeated completions stack identical popups and clicking one does not focus the studio tab. Add `tag: r.id`, `onclick = () => window.focus()`, and an icon.
63. [ ] **[S]** _Bug_ — `playChime()` constructs a new `AudioContext` for every finished run and closes it after 1 s; browsers cap contexts and block creation without a user gesture after long idle. Keep one lazily created context, resume it on first interaction, and reuse it.
64. [ ] **[S]** _Bug_ — Prompt length is unbounded. The prompt boxes have no `maxLength` or counter and the catalog has no per-model prompt limit, so an over-long prompt is rejected by the platform with a generic 4xx after the user waited. Add `maxPromptChars` to `ModelEntry` (default 2,000), show a counter near the limit and block submit above it.
65. [ ] **[S]** _Bug_ — `runToGalleryItems` gives completed videos `src: ""` and only `videoSrc`, so every video tile mounts a `<video>` to show anything; with dozens of videos the gallery decodes many streams. Use a lightweight poster: `<video preload="metadata" src="…#t=0.1">` for the first frame, and mount full playback only on hover/focus.
66. [ ] **[S]** _Bug_ — Library items use the URL as `id` (`AssetLibraryItem.id = url`), so the same image as an upload and as a generation result collapses or duplicates depending on source; and URLs with signed query strings change per session. Use content hashes or run ids as stable ids and keep URL as an attribute.
67. [ ] **[S]** _Bug_ — `useUploads` keeps only 200 items and drops the oldest, but runs may still reference those URLs; and `slice(0, 200)` is silent. Show "Library holds the 200 most recent references" and let starred references be pinned.
68. [ ] **[S]** _Bug_ — The local storage keys are all `hf.*.v1` with no migration hook; the first schema change to `projects`, `uploads` or `settings` will either lose data or crash on parse. Add a small `migrate(version, state)` in each persist config now and a test that old shapes load.
69. [ ] **[S]** _Bug_ — `persist` stores use `browserStorage()` that silently swallows `QuotaExceededError` on `setItem`; when localStorage is full (large `uploads`), settings stop saving with no message. Surface a "Storage is full" toast and offer to prune.
70. [ ] **[S]** _Bug_ — `dayGroup()` computes "Today/Yesterday" at render with the current date but memoized gallery items keep the old group labels past midnight; recompute groups on a minute timer or when the date changes.
71. [ ] **[S]** _Bug_ — `runToLibraryItems` names assets with `run.prompt.slice(0, 60)` which can cut mid-word and includes whitespace/newlines; use a cleaned single-line excerpt with an ellipsis.
72. [ ] **[S]** _Deployment_ — Document and test deployment targets (Vercel, Docker, self-hosted Node): env vars, cookie `secure` behavior behind a proxy (`NODE_ENV` only), and `Trusted-Proxy`/`X-Forwarded-Proto` handling so the key cookie gets `Secure` in real HTTPS deployments.
73. [ ] **[S]** _Deployment_ — Add a Dockerfile (multi-stage, standalone output, non-root) and `output: "standalone"` in `next.config.ts`.
74. [ ] **[S]** _Deployment_ — Rate limiting for server actions and `/api/upload` (per IP/cookie) to protect a shared deployment from abuse of the owner's platform quota; today any visitor with a key uses their own, but `/api/upload` and actions are unthrottled.
75. [ ] **[S]** _Deployment_ — Add `robots` noindex and a minimal `manifest.webmanifest` + icons; the favicon is 26 KB `.ico`, and the app is meant as an installable tool.
76. [ ] **[S]** _Docs_ — Rewrite README into a real product README: purpose, screenshots, architecture diagram (browser ↔ server actions ↔ platform), configuration table, data locations and limits (400 runs, 2 concurrent, 20 queued).
77. [ ] **[S]** _Docs_ — Add `docs/ARCHITECTURE.md` with the run lifecycle (queued → submitting → running → settled), the poll scheduler, idempotency rules and the server boundary; AGENTS.md has rules but no flow diagrams.
78. [ ] **[S]** _Docs_ — Add `docs/ADDING_A_MODEL.md` with a worked example (settings types, mappers, icon, tests) and a checklist, since the catalog is the main extension point.
79. [ ] **[S]** _Docs_ — Document platform error mapping (`friendlyError`) as a table of status/text → message so support can predict what users see.
80. [ ] **[S]** _Docs_ — Add a `CHANGELOG.md` and tag releases; the repo is a template scaffold and downstream copies need a diff-friendly upgrade path (`agentUpgrade` is configured).
81. [ ] **[S]** _Docs_ — Add `docs/RUN_LIFECYCLE.md` with a state diagram covering queued, submitting, running, stalled, canceling, completed, failed, plus the exact retry/idempotency rules in `use-runs.ts` and `actions.ts`.
82. [ ] **[S]** _Docs_ — Add `docs/PRIVACY.md` listing what leaves the browser (prompts and reference URLs to the Higgsfield platform via the server; uploads to signed storage) and what stays local; the privacy dialog's text should be generated from it.
83. [ ] **[S]** _Feature_ — Seed control. There is no seed anywhere in the app (grep finds none) and "More like this" only re-rolls; add an optional seed field per model that supports it, show the seed on the detail view, and add "Same seed, new prompt" and "Lock seed" actions for iteration.
84. [ ] **[S]** _Feature_ — Negative prompt and prompt-adherence (CFG/guidance) settings for models that expose them, rendered from the catalog schema instead of hard-coding in the UI.
85. [ ] **[S]** _Feature_ — Batch/size settings surfaced consistently: only one catalog model has `batchSize`; add an "N variations" stepper to the dock for every image model by queueing N runs with different seeds when the model lacks native batching.
86. [ ] **[S]** _Feature_ — Aspect-ratio preview chips in the dock showing the exact crop for each setting, and a "match reference" option that reads the first reference image's ratio.
87. [ ] **[S]** _Feature_ — Prompt library with tags: save prompts as reusable entries (separate from templates), search them from the command palette, and insert with variables (`{subject}`).
88. [ ] **[S]** _Feature_ — Prompt variables and batching: `{red|blue|green}` and `[a, b, c]` syntax expands to one run per combination (capped), a standard pattern for exploring options.
89. [ ] **[S]** _Feature_ — Compare view: select two or more completed runs and view them side by side with synced zoom and the settings diff highlighted.
90. [ ] **[S]** _Feature_ — Reference image picker from history: use any previous result as a start/reference frame in one click (the asset library exists; add a "Use as reference" action on tiles and in the viewer).
91. [ ] **[S]** _Feature_ — Frame extraction from video results: pick a frame at the playhead and use it as the start frame of the next video ("continue this shot"); needs a canvas capture and an upload.
92. [ ] **[S]** _Feature_ — Upscale/extend/edit as follow-up actions on a result if the catalog exposes such models; wire them as tile menu entries that prefill the dock with the right model and references.
93. [ ] **[S]** _Feature_ — Local favorites folders ("collections") separate from projects: a result can live in a project and several collections; filter and share by collection.
94. [ ] **[S]** _Feature_ — Notes and ratings per run: 1-5 stars and a free-text note shown in the detail view and searchable; star exists, add rating and note fields to `RunRecord`.
95. [ ] **[S]** _Feature_ — Search over history: full-text across prompts, notes, model names and settings values, with filters (model, surface, status, date) in the feed controls and the command palette.
96. [ ] **[S]** _Feature_ — Cost awareness: if the platform returns credit cost or the catalog knows relative cost, show an estimate before submit and a running total in the usage dialog (existing items mention cost; this ties it to a catalog field `cost`).
97. [ ] **[S]** _Feature_ — Scheduled/off-peak generation: queue runs to start later (when credits refresh or after a time), stored locally and run while the tab is open.
98. [ ] **[S]** _Feature_ — Share a run as a read-only link or image card (prompt, model, settings) without exposing the key; a static export of a result with metadata for posting.
99. [ ] **[S]** _Feature_ — Import/export a project as a folder or zip (media + `project.json`) and re-import on another machine; today data is browser-local only.
100. [ ] **[S]** _Feature_ — Optional sync backend adapter: the app says to replace `history.ts`/`projects.ts` for shared persistence; provide a documented `Storage` interface and a sample adapter (S3-compatible or Supabase) behind env flags.
101. [ ] **[S]** _Feature_ — Multi-account/key profiles: store several named API keys, switch the active profile in the sidebar, and keep history per profile.
102. [ ] **[S]** _Feature_ — Model recommendations: a "which model?" helper that suggests models from the prompt and references (video vs image, character consistency, text rendering), based on catalog tags.
103. [ ] **[S]** _Feature_ — Catalog tags and capability metadata (text rendering, character consistency, max duration, sound, aspect ratios) so the picker can filter and compare 28 models; today the picker is a flat list ordered by `order`.
104. [ ] **[S]** _Feature_ — Model changelog/deprecation banner: flag models marked `deprecated` or `preview` in the catalog and steer users to successors.
105. [ ] **[S]** _Feature_ — Saved presets per model: named setting bundles ("cinematic 16:9 1080p") applied from the dock settings popover.
106. [ ] **[S]** _Feature_ — Global default settings per surface (aspect, resolution) overriding per-model defaults where compatible.
107. [ ] **[S]** _Feature_ — Image-to-prompt: describe an uploaded image into prompt text using a platform captioning model if available, or a local WebGPU model.
108. [ ] **[S]** _Feature_ — Prompt enhancement via the platform's `enhancePrompt` setting where it exists, with a diff view of the enhanced prompt (the setting exists on one model; surface the result text if returned).
109. [ ] **[S]** _Feature_ — Audio tools for video models: waveform preview for uploaded audio references and trimming before upload (WAV only supported).
110. [ ] **[S]** _Feature_ — Strip metadata from WebP, GIF and MP4 as well; `stripMetadata` handles only JPEG and PNG, so a WebP with EXIF/XMP or an MP4 with GPS atoms leaves the browser untouched.
111. [ ] **[S]** _Feature_ — Paste-to-attach: pasting an image or URL anywhere in the studio attaches it as a reference (outside the prompt textarea), with a toast.
112. [ ] **[S]** _Feature_ — Drag a result tile into the dock to use it as a reference (HTML5 drag from gallery to prompt box).
113. [ ] **[S]** _Feature_ — Prompt autosave with undo history inside the textarea (beyond the browser's default), and a "restore last submitted prompt" button.
114. [ ] **[S]** _Feature_ — Keyboard shortcuts: remap in Preferences, plus a "?" cheat sheet that reflects custom bindings (`shortcuts-dialog.tsx` is static).
115. [ ] **[S]** _Feature_ — Notifications: Web Push for completion when the tab is closed requires a server; document an opt-in design using a lightweight webhook relay, or notify via the Notifications API while open (already partly done).
116. [ ] **[S]** _Feature_ — Sound/chime options and per-model completion tones; the chime setting exists, add choice and volume.
117. [ ] **[S]** _Feature_ — Gallery density and grouping options (by day, project, model, status) with sticky headers; the justified gallery has one layout.
118. [ ] **[S]** _Feature_ — Timeline view of generation activity (per day, per model) from `usage.ts` data with click-through to that day's runs.
119. [ ] **[S]** _Feature_ — Tile hover preview scrub for videos (move the mouse across the tile to scrub frames) and poster-frame selection stored per run.
120. [ ] **[S]** _Feature_ — Detail modal: show full metadata panel (model, settings, seed, timings, request id, references) with "Copy as JSON" and "Copy as curl" for debugging against the platform API.
121. [ ] **[S]** _Feature_ — Compare prompts across models: "Run on all selected models" with one prompt and a side-by-side results grid.
122. [ ] **[S]** _Feature_ — Run templates for repeated workflows (product shot, character sheet, social post sizes) as multi-run recipes producing several aspect ratios at once.
123. [ ] **[S]** _Feature_ — Brand kit: stored style words, color palette and reference images auto-attached to prompts for a given project.
124. [ ] **[S]** _Feature_ — Project settings: default model, default settings, shared references, and a project description/notes, applied when generating inside the project.
125. [ ] **[S]** _Feature_ — Project cover image and pinning, sorting projects by recent use or manual order in the sidebar.
126. [ ] **[S]** _Feature_ — Archive (not delete) for runs and projects, hidden from the main feed but restorable; reduces accidental loss beyond the undo toast.
127. [ ] **[S]** _Feature_ — Trash with 30-day retention for deleted runs and projects instead of immediate removal (undo toast lasts seconds).
128. [ ] **[S]** _Feature_ — Descriptive file metadata: write the prompt, model, settings and seed into downloaded PNG (`tEXt` chunk) or JPEG EXIF/XMP so files remain self-documenting outside the app, with a preference to disable it for privacy.
129. [ ] **[S]** _Feature_ — "Copy prompt", "Copy settings as JSON" and "Copy link to this run" (a deep link `#run=<id>` that opens the detail modal) in the tile menu and the detail view.
130. [ ] **[S]** _Feature_ — Deep links: URL state for project, surface, model and open run so browser back/forward and bookmarks work; the studio is one route today and a reload loses the current view context.
131. [ ] **[S]** _Feature_ — Keyboard-first prompt box: `Ctrl/Cmd+Enter` to generate, `Ctrl+Shift+Enter` to generate and keep the dock, `Alt+Up/Down` to cycle models, `Alt+1..9` for aspect ratios; list them in the shortcuts dialog from one registry so the dialog can't drift.
132. [ ] **[S]** _Feature_ — A `/` command in the prompt box (e.g. `/model kling-3`, `/ar 9:16`, `/dur 8`) that sets dock options without leaving the keyboard, alongside the command palette.
133. [ ] **[S]** _Feature_ — Reference slots with roles shown inline (start, end, reference) using the catalog's `roles`/`mediaModes`, including drag reordering and a swap-start/end button; the picker exists, but role clarity is the most common confusion with multi-input video models.
134. [ ] **[S]** _Feature_ — Per-model "what's different" tooltips: show max duration, supported aspect ratios and whether sound/audio references are supported, derived from the catalog `settings`/`roles` so every model's constraints are visible before submit.
135. [ ] **[S]** _Feature_ — Warn before submitting settings known to be unsupported together (e.g. `multiShots` with an end frame) using declarative `incompatible` rules in the catalog (older item notes the need; define the schema: `{when: {...}, disable: [...]}`).
136. [ ] **[S]** _Feature_ — Presets for aspect ratio + resolution + duration bundles ("Vertical 9:16 short", "Cinematic 16:9") that apply across models by mapping to each model's closest supported values.
137. [ ] **[S]** _Feature_ — Run lineage: record `parentRunId` when creating a variation or using a result as a reference, show a small lineage chain in the detail modal and a "revert to parent" action.
138. [ ] **[S]** _Feature_ — Prompt A/B mode: submit two prompts (or two models) as a linked pair and show them side by side with a vote to keep one; records the winner as a star.
139. [ ] **[S]** _Feature_ — Auto-naming runs for the sidebar/projects: derive a short title from the prompt (first 5 words) so lists are scannable; editable in the detail modal.
140. [ ] **[S]** _Feature_ — Smart project suggestions: when a prompt shares keywords with an existing project's runs, suggest filing the generation there at submit time.
141. [ ] **[S]** _Feature_ — Export a project as a Markdown "shot list" (prompt, model, settings, thumbnails) plus a zip of media; pairs with the shot list view idea and stays local.
142. [ ] **[S]** _Feature_ — Import/restore from the exported history JSON (the export exists, import doesn't) with duplicate detection by request id.
143. [ ] **[S]** _Feature_ — Media library cleanup tools: find unused references (not used by any run), duplicates (hash exists), and expired URLs (HEAD check) with bulk delete.
144. [ ] **[S]** _Feature_ — A "recent errors" panel in Settings listing the last 20 failed runs with friendly reason, platform request id and a one-click "retry with same settings".
145. [ ] **[S]** _Feature_ — Cost/credit estimates per model in the catalog (`credits` field with a note on uncertainty) feeding a pre-submit estimate and a weekly summary in the usage dialog.
146. [ ] **[S]** _Feature_ — Rate-limit aware queueing: when the platform returns 429, pause the local queue for the `Retry-After` period automatically with a visible countdown instead of failing runs.
147. [ ] **[S]** _Observability_ — Structured server logs: `log()` prints JSON lines for submit/cancel/error but not status failures or upload tickets; add a request id per action and log durations, platform status and retry classification (never prompts or URLs).
148. [ ] **[S]** _Observability_ — Client error reporting (opt-in, privacy-preserving): capture error boundary hits and failed-run reasons with model id and platform request id for debugging, with a visible "Send diagnostics" button.
149. [ ] **[S]** _Observability_ — A `/api/health` route returning build version, model count and whether `HF_API_BASE_URL` is set, for deploy checks and uptime monitors.
150. [ ] **[S]** _Observability_ — Expose build info (commit, version) in Settings and the diagnostics copy, so bug reports include it.
151. [ ] **[S]** _Performance_ — Virtualization row measurement in `justified-engine.ts` recomputes on resize; debounce with `ResizeObserver` + `requestAnimationFrame` and cache layout by width/aspect hash.
152. [ ] **[S]** _Performance_ — Use `content-visibility: auto` and `contain-intrinsic-size` for off-screen tiles that are mounted (loaded media must stay mounted per AGENTS), and `loading="lazy"` + `decoding="async"` for posters.
153. [ ] **[S]** _Performance_ — Pause offscreen `<video>` elements (pause + `preload="none"`) while keeping their loaded state; many simultaneous autoplay-on-hover videos can exhaust decoders on mobile.
154. [ ] **[S]** _Performance_ — Move history persistence to per-record IndexedDB rows (keyed by id with indexes on createdAt/projectId) instead of one `history.v1` array; the whole 400-record array is rewritten on every debounced save.
155. [ ] **[S]** _Performance_ — Memoize `groupMedia`, `parseSettings` and `usageStats` computations; the layout (886 lines) recomputes derived lists on every poll tick.
156. [ ] **[S]** _Performance_ — Split `layouts/studio.tsx` (27 KB, 886 lines) and `studio-prompt-box.tsx` (816 lines) into smaller components and hooks to reduce re-render scope and ease testing.
157. [ ] **[S]** _Performance_ — Bundle analysis (`@next/bundle-analyzer`) in CI with a budget; `lucide-react` icons and Base UI tree-shaking should be verified, and the model registry JSON (21 KB) shouldn't ship to routes that don't need it.
158. [ ] **[S]** _Performance_ — Server actions use `cookies()` and a fresh platform client per call; cache the client per request and avoid re-parsing the cookie in each of status/submit/cancel.
159. [ ] **[S]** _Performance_ — Defer `usageStats`, `runToLibraryItems` and gallery item mapping to `useMemo` keyed by `records` identity plus a cheap version counter; currently each poll tick creates a new records array and recomputes derived lists even when nothing changed visually.
160. [ ] **[S]** _Performance_ — Make `use-justified-gallery`'s layout incremental: when a new run is added at the top only recompute the affected groups instead of the whole feed; test with 400 records.
161. [ ] **[S]** _Performance_ — Lazy-load `asset-library.tsx` (19 KB), `template-picker`, `usage-dialog` and `privacy-dialog` with `next/dynamic` since they're modal-only; reduces first-load JS.
162. [ ] **[S]** _Performance_ — Prefetch the next page of media only for tiles near the viewport using `IntersectionObserver` with `rootMargin`, and use `fetchPriority="low"` for off-screen posters.
163. [ ] **[S]** _Privacy_ — Make the privacy dialog data-driven from a single storage registry (keys, purpose, location, retention) so it can't drift from code; add a "Download my data" and a "Delete everything" in one flow (wipe exists).
164. [ ] **[S]** _Privacy_ — Redact prompts in any client-side diagnostics copy by default (there is "Copy diagnostics"-style data in several places); include an opt-in toggle to include prompts.
165. [ ] **[S]** _Privacy_ — Warn when pasting something that looks like an API key into the prompt box (key regex) before sending it to a model.
166. [ ] **[S]** _Privacy_ — Per-project "private" flag that excludes runs from exports, usage stats and the command palette search.
167. [ ] **[S]** _Quality_ — Add component tests (Testing Library + jsdom/happy-dom) for the prompt box, key dialog and gallery tile; the test suite covers catalog, errors, poll, strip-metadata and misc only.
168. [ ] **[S]** _Quality_ — Property-based tests for `parseSettings` (any input yields valid settings within bounds) and `toPlatform` (every model builds a request from defaults — exists — and from random valid settings).
169. [ ] **[S]** _Quality_ — Contract tests for the platform client with recorded fixtures (submit/status/cancel/upload ticket) in `tests/fixtures/`, so mapper changes show up as diffs.
170. [ ] **[S]** _Quality_ — Mutation testing on `poll.ts` and `use-runs.ts` (Stryker) — they carry the reliability promise; the current poll tests cover the happy path and misses.
171. [ ] **[S]** _Quality_ — Enforce `exactOptionalPropertyTypes` (the code already uses conditional spreads for optional props) and `noUncheckedIndexedAccess` (already on) — verify `tsconfig` has both and add `@typescript-eslint/switch-exhaustiveness-check`.
172. [ ] **[S]** _Quality_ — Type-safe model registry: generate a union type of model ids from `registry.json` so `getModel("typo")` is a compile error and pickers can't reference unknown ids.
173. [ ] **[S]** _Quality_ — Validate `models/*.ts` at test time for icon existence in `public/model-icons`, unique `order`, label length and presence of each declared role in mappers.
174. [ ] **[S]** _Quality_ — Add a script `pnpm models:check` that diffs the installed catalog against the template's latest (shadcn registry) to flag new models, deprecated paths and changed settings ranges.
175. [ ] **[S]** _Quality_ — Unit tests for `stripJpeg`/`stripPng` with truncated/malformed inputs and fuzzing (they parse binary headers manually); return the original file on any parse doubt.
176. [ ] **[S]** _Quality_ — Lint rule forbidding `console.*` outside `generation/platform.ts` logging (there is a lint rule for logging per commit `0734053`; extend to forbid prompt/URL fields in log calls).
177. [ ] **[S]** _Quality_ — Dependency hygiene: `radix-ui` and `@base-ui/react` are both dependencies, and `cn` plus `class-variance-authority` appear; confirm `radix-ui` is still used (knip is configured) and remove if not.
178. [ ] **[S]** _Quality_ — Pin `pnpm` and Node via `engines`/`.nvmrc`/Corepack and add a CI workflow (typecheck, lint, test, build, knip) — `.githooks` exists locally but there's no hosted CI.
179. [ ] **[S]** _Quality_ — Add Renovate/Dependabot groups for Next/React/Base UI (dependabot exists per `0734053`; verify ecosystem coverage for GitHub Actions and pnpm).
180. [ ] **[S]** _Quality_ — Add a storybook-less "component gallery" route in dev (`/dev/components`) rendering each studio component with fixture data for visual review; AGENTS says to read component docs before composing, so a live catalog helps.
181. [ ] **[S]** _Quality_ — Add `tests/use-runs.test.ts` using fake timers and a mocked `submitGeneration`/`watchRequest`: queue → running → completed, ambiguous failure retry reuses the idempotency key, cancel queued vs running, two-tab merge.
182. [ ] **[S]** _Quality_ — Add tests for `mergeRecords` (tombstone-free today): same id different status, added from other tab, ordering by createdAt; and for `readHistory` skipping malformed rows.
183. [ ] **[S]** _Quality_ — Fuzz `friendlyError` with real platform error samples and assert no raw JSON/stack ever reaches the UI; keep a table of recorded messages as a regression suite.
184. [ ] **[S]** _Quality_ — Introduce an `env.ts` validated at build (`HF_API_BASE_URL` format, https) and an `.env.example` check in CI; today a missing env only fails when the first generation runs.
185. [ ] **[S]** _Quality_ — Add `eslint-plugin-jsx-a11y` rules (Next config includes some) and `eslint-plugin-react-compiler`; gallery and dock code carry many effects with refs where compiler rules would catch stale closures.
186. [ ] **[?]** _Accessibility and i18n_ — Visible focus rings on every tile and menu item; verify contrast of dim text on the dark tokens (WCAG AA).
187. [ ] **[?]** _Accessibility and i18n_ — Alt text for results = the prompt (truncated); `aria-label` on icon-only buttons (audit).
188. [ ] **[?]** _Accessibility and i18n_ — Focus trap and return-focus on all dialogs; confirm Base UI defaults are not overridden.
189. [ ] **[?]** _Accessibility and i18n_ — Skip link to the prompt box and to the feed.
190. [ ] **[?]** _Accessibility and i18n_ — Roving tabindex across the tile grid so Tab does not walk 400 tiles.
191. [ ] **[?]** _Accessibility and i18n_ — Announce queue position changes ("Queued, 2nd") politely, throttled.
192. [ ] **[?]** _Accessibility and i18n_ — High-contrast check for status colors (failed, running, queued) without relying on hue alone; add icons.
193. [ ] **[?]** _Assets and references_ — Asset library folders or tags (characters, products, styles).
194. [ ] **[?]** _Assets and references_ — Asset search and rename.
195. [ ] **[?]** _Assets and references_ — Reference limit meter ("2 of 4 images") per model, with the reason when full.
196. [ ] **[?]** _Assets and references_ — Bulk delete and bulk tag in the asset library.
197. [ ] **[?]** _Assets and references_ — "Used in" list on an asset: which runs referenced it.
198. [ ] **[?]** _Assets and references_ — Sort and filter the library by type, date, size and last used.
199. [ ] **[?]** _Assets and references_ — Paste-from-clipboard video thumbnail preview before upload so a wrong file is caught early.
200. [ ] **[?]** _Code quality testing and dev experience_ — Playwright smoke test for the AGENTS.md verification scenarios (missing key, cancel, empty history).
201. [ ] **[?]** _Code quality testing and dev experience_ — Unit tests for history load/migrate (corrupt row skipped, order kept, cap respected).
202. [ ] **[?]** _Code quality testing and dev experience_ — Component test for the gallery's rule "failed terminal runs stay visible" so it cannot regress.
203. [ ] **[?]** _Code quality testing and dev experience_ — Test for idempotency-key reuse and rotation (ties to the double-charge fix).
204. [ ] **[?]** _Code quality testing and dev experience_ — `pnpm check` script that runs typecheck, lint, test and knip in one command.
205. [ ] **[?]** _Code quality testing and dev experience_ — Fake platform server (tiny Node script behind `HF_API_BASE_URL`) usable by tests and local dev without a key.
206. [ ] **[?]** _Cost and usage awareness_ — Session spend counter ("14 generations, ~320 credits today") from per-model cost metadata.
207. [ ] **[?]** _Cost and usage awareness_ — Confirm dialog for expensive combos (long 4K video, batch >2) with "don't ask again".
208. [ ] **[?]** _Cost and usage awareness_ — Per-project budget cap that disables Generate when hit.
209. [ ] **[?]** _Cost and usage awareness_ — Weekly summary in the Usage dialog (runs, success rate, failures by reason).
210. [ ] **[?]** _Cost and usage awareness_ — Failure-reason breakdown (content filter, credits, timeout) with counts.
211. [ ] **[?]** _Cost and usage awareness_ — Busiest-hour and busiest-day heatmap from local history.
212. [ ] **[?]** _Dead code and dependencies_ — Persisted prompt and media stores exist but nothing uses them. `generation/stores/prompt.ts`, `generation/stores/media.ts` and `generation/plane.ts` (`assemblePlane`) have no importers; `StudioTemplate` keeps `prompt` and `media` in plain `useState` (`layouts/studio.tsx:273-274`). Result: refreshing the page loses an unsent prompt and attached references. Either wire the persisted per-surface stores into the dock (and keep blob URLs out, as `media.ts` already does) or delete the three files.
213. [ ] **[?]** _Dead code and dependencies_ — `batch` is half-built: `MAX_BATCH` and `batch`/`setBatch` live in `stores/active.ts`, but no component or submit path reads them (grep), and only Soul has its own `batchSize` setting. Either add a "Variations x1 / x2 / x4" control that submits N planes with distinct idempotency keys and shows N placeholder tiles, or remove the field.
214. [ ] **[?]** _Detail modal and viewers_ — Side-by-side "reference vs result" layout in the modal for image-to-image and image-to-video runs.
215. [ ] **[?]** _Detail modal and viewers_ — Filmstrip of siblings (same project or same prompt) under the media for quick browsing.
216. [ ] **[?]** _Detail modal and viewers_ — Fullscreen button and `F` shortcut for both images and videos.
217. [ ] **[?]** _Detail modal and viewers_ — Copy-settings buttons per field (prompt, model, aspect ratio) rather than only "Copy as JSON".
218. [ ] **[?]** _Editing and post-processing_ — Upscale action on video tiles.
219. [ ] **[?]** _Editing and post-processing_ — Background removal action on image tiles.
220. [ ] **[?]** _Editing and post-processing_ — Outpaint / reframe to another aspect ratio from the tile menu (9:16 for Shorts, 1:1 for feed).
221. [ ] **[?]** _Editing and post-processing_ — Inpaint brush: paint a mask on an image tile, then prompt the change.
222. [ ] **[?]** _Editing and post-processing_ — Trim video in the detail modal (in/out handles) and save the cut as a new asset client-side.
223. [ ] **[?]** _Editing and post-processing_ — "Edit with prompt" on image tiles: attach the image as a reference and focus the dock in one click (works with any image-edit model).
224. [ ] **[?]** _Editing and post-processing_ — Relight or restyle presets as tile-menu items that prefill the prompt.
225. [ ] **[?]** _Editing and post-processing_ — Aspect-ratio crop preview for 9:16, 1:1, 4:5, 16:9 with save-as-new-asset (client canvas only for same-origin or uploaded files).
226. [ ] **[?]** _Gallery and organization_ — Tags (free text) on runs with tag filter.
227. [ ] **[?]** _Gallery and organization_ — Keyboard navigation in the gallery: arrow keys move focus, Enter opens, `f` favorites, `Delete` removes (with undo).
228. [ ] **[?]** _Gallery and organization_ — Detail modal prev/next arrows and swipe on touch.
229. [ ] **[?]** _Gallery and organization_ — Saved filters ("Starred videos, Kling") as chips the user can pin.
230. [ ] **[?]** _Gallery and organization_ — Select-range with Shift+click in multi-select.
231. [ ] **[?]** _Gallery and organization_ — "Select all in this day" from the day heading.
232. [ ] **[?]** _Gallery and organization_ — Collapse a day group to a one-line summary ("12 images, 2 failed").
233. [ ] **[?]** _Gallery and organization_ — Pin a run to the top of the feed regardless of sort.
234. [ ] **[?]** _Gallery and organization_ — Show a count badge next to each project in the sidebar and in the filter chips.
235. [ ] **[?]** _Gallery and organization_ — Drag a tile onto a sidebar project to move it.
236. [ ] **[?]** _Gallery and organization_ — Smart collections: auto-projects such as "All videos from this week" (saved query, no copying).
237. [ ] **[?]** _Generation workflow_ — Compare mode: pin two tiles side by side (slider wipe for images, synced playback for videos).
238. [ ] **[?]** _Generation workflow_ — Run the same prompt on N models at once ("Model shootout") and show results in one grouped row.
239. [ ] **[?]** _Generation workflow_ — Prompt templates with `{variables}` (e.g. `{subject} in {style}`), fill-in form, run a grid of combinations.
240. [ ] **[?]** _Generation workflow_ — Negative prompt field for models that support it, hidden for others.
241. [ ] **[?]** _Generation workflow_ — "Enhance prompt" button that rewrites a short prompt per model's best practice (server action, key stays server side).
242. [ ] **[?]** _Generation workflow_ — Persist the queue (the "Queued · n" tiles) in IndexedDB so a reload resumes it instead of dropping it.
243. [ ] **[?]** _Generation workflow_ — Reorder and remove queued tiles by drag, before they start.
244. [ ] **[?]** _Generation workflow_ — Pause the queue (let running jobs finish, hold the rest) with a single toggle.
245. [ ] **[?]** _Generation workflow_ — Auto-retry transient submit failures (5xx, 429) once with the same idempotency key and a visible "Retrying…" state.
246. [ ] **[?]** _Generation workflow_ — Sequential "chain" mode: output of run A becomes the reference of run B (image -> image -> video) from a saved list of steps.
247. [ ] **[?]** _Generation workflow_ — Re-run a whole project's prompts on a different model to compare.
248. [ ] **[?]** _Image viewer_ — Zoom/pan with minimap in the detail modal; 100% pixel view.
249. [ ] **[?]** _Image viewer_ — Show dimensions and file size; "Download original" vs "Download WebP".
250. [ ] **[?]** _Image viewer_ — Color palette extraction (5 swatches) per image, click to copy hex and insert into the prompt.
251. [ ] **[?]** _Image viewer_ — "Describe this image" (caption) to reuse as a prompt (server action).
252. [ ] **[?]** _Mobile and PWA_ — PWA manifest + icons so it installs; offline shell with cached history thumbnails.
253. [ ] **[?]** _Mobile and PWA_ — Bottom-sheet model/settings pickers on narrow viewports (no second app shell, per AGENTS.md).
254. [ ] **[?]** _Mobile and PWA_ — Camera capture as a reference source via `<input capture>`.
255. [ ] **[?]** _Mobile and PWA_ — Web Share Target so photos shared from the phone open as references.
256. [ ] **[?]** _Mobile and PWA_ — Dock collapses to a single "+" sheet on narrow screens, keeping one app shell.
257. [ ] **[?]** _Mobile and PWA_ — Pull-to-refresh disabled inside the feed so scrolling does not reload the page.
258. [ ] **[?]** _Models and settings_ — Disable (grey out with reason) settings combos a model rejects, instead of failing at the platform.
259. [ ] **[?]** _Models and settings_ — Model favorites pinned to the top of the picker.
260. [ ] **[?]** _Models and settings_ — Detect surface from references automatically (video attached as input -> offer video models that accept it).
261. [ ] **[?]** _Models and settings_ — Per-model "last used settings" summary line in the picker so the user sees what they will get before selecting.
262. [ ] **[?]** _Models and settings_ — Hide-model toggle in app Settings (visual only, still installed, always reachable via search; keeps the AGENTS.md "all models visible" rule by showing a "n hidden" row).
263. [ ] **[?]** _Models and settings_ — Settings presets the user names and recalls ("Reels 9:16 High").
264. [ ] **[?]** _Models and settings_ — Copy settings from one model to another where the keys match.
265. [ ] **[?]** _Onboarding and first run_ — Example prompts per surface as clickable chips in the empty state (real, on-brand, per AGENTS.md).
266. [ ] **[?]** _Onboarding and first run_ — Guided "first video from your image" tour using a bundled sample image.
267. [ ] **[?]** _Onboarding and first run_ — Empty-state hero shows the three actions that matter (add key, make an image, make a video) with real state (done or not).
268. [ ] **[?]** _Onboarding and first run_ — Inline "what does this setting do" help text under each setting in the dialog, from the catalog description.
269. [ ] **[?]** _Onboarding and first run_ — Key dialog test button after the Issues item is resolved ("Check key"), with a clear pass or fail.
270. [ ] **[?]** _Performance_ — Generate and cache thumbnails in IndexedDB so reopening is instant offline.
271. [ ] **[?]** _Performance_ — Measure and cap the number of `<video>` elements alive at once (virtualization already helps; add a hard ceiling and test it).
272. [ ] **[?]** _Performance_ — Move SHA-256 hashing and EXIF stripping into a Web Worker for large files.
273. [ ] **[?]** _Performance_ — Memoize tile props so a single run update re-renders one tile, not the row.
274. [ ] **[?]** _Product expansion_ — Audio surface (TTS/music) if the platform catalog adds it; the Surface type already splits image/video *(check)*.
275. [ ] **[?]** _Product expansion_ — Lip-sync / talking-head flow: image + audio -> video with a dedicated mini-wizard.
276. [ ] **[?]** _Product expansion_ — Character library: named reusable characters with reference sets, `@name` in prompts.
277. [ ] **[?]** _Product expansion_ — Style library: saved style references + prompt suffix, applied in one click.
278. [ ] **[?]** _Product expansion_ — Brand kit (logo, colors, fonts) used by template presets.
279. [ ] **[?]** _Product expansion_ — Template gallery of real presets (AGENTS.md DoD): each loads prompt, model, and settings.
280. [ ] **[?]** _Product expansion_ — Prompt marketplace-style "Recipes" page built from the user's own best (starred) runs.
281. [ ] **[?]** _Product expansion_ — Shot list view for a project: ordered cards of prompt + result, printable.
282. [ ] **[?]** _Product expansion_ — Reference-pack presets (a character's front, side, back images attach together).
283. [ ] **[?]** _Product expansion_ — Scheduled batch at a quiet hour *(skip unless asked; needs the tab open)*.
284. [ ] **[?]** _Product gaps_ — History silently caps at 400 runs (`MAX_RECORDS`, `history.ts:27`), dropping the oldest. Tell the user when it happens and add Export / Import history (JSON) in a menu so a browser reset isn't a data loss. If the platform's result URLs expire, also offer "Download all" for completed runs.
285. [ ] **[?]** _Prompt box and input_ — Prompt history dropdown with search (extends the Up-arrow recall item in section 2).
286. [ ] **[?]** _Prompt box and input_ — Saved prompts / snippets library ("my style suffix") inserted with `/` command.
287. [ ] **[?]** _Prompt box and input_ — `Cmd/Ctrl+Enter` to generate, `Esc` to cancel focus, shown as hint on the button.
288. [ ] **[?]** _Prompt box and input_ — Character counter and per-model prompt length limit warning.
289. [ ] **[?]** _Prompt box and input_ — Prompt diff: when re-using a prompt from a tile, highlight what changed against the original before submit.
290. [ ] **[?]** _Prompt box and input_ — Insert-from-history picker (`@@`) that pastes a previous prompt at the cursor.
291. [ ] **[?]** _Prompt box and input_ — Prompt linting hints: warn on contradictions ("day" and "night"), duplicated words, or text the model cannot render *(check)*.
292. [ ] **[?]** _Prompt box and input_ — Undo/redo that survives "Enhance"/template inserts (own history stack, not browser default).
293. [ ] **[?]** _Resilience safety and privacy_ — Content-filter tile shows which input tripped it when known, and an "Edit prompt and retry" button.
294. [ ] **[?]** _Resilience safety and privacy_ — Warn before attaching images of people for models with likeness restrictions *(check)*.
295. [ ] **[?]** _Resilience safety and privacy_ — Detect IndexedDB being blocked (private window) and show "History won't be saved in this window" once.
296. [ ] **[?]** _Resilience safety and privacy_ — Conflict-safe import: merge by run id instead of replacing history.
297. [ ] **[?]** _Resilience safety and privacy_ — Log a local, user-visible "activity log" of submit/cancel/error events (no prompts) for debugging.
298. [ ] **[?]** _Resilience safety and privacy_ — Rate-limit key-save attempts server-side to blunt brute-force of the key dialog.
299. [ ] **[?]** _Resilience safety and privacy_ — Verify that error messages never echo the key or a signed URL (add a test with a fake key).
300. [ ] **[?]** _Sharing export and sync_ — Zip export of a project (media + a `prompts.csv`).
301. [ ] **[?]** _Sharing export and sync_ — Copy image to clipboard from the tile menu.
302. [ ] **[?]** _Sharing export and sync_ — Share page: read-only link for a single result *(needs server storage; only if product wants it)*.
303. [ ] **[?]** _Sharing export and sync_ — Optional cloud sync adapter behind the existing `useRuns` interface (AGENTS.md allows replacing history/projects modules).
304. [ ] **[?]** _Sharing export and sync_ — Multi-device: QR code that opens the app with an export bundle to import.
305. [ ] **[?]** _Sharing export and sync_ — Shareable "recipe link" (prompt/model/settings in the URL hash, no media) that preloads the dock.
306. [ ] **[?]** _Sharing export and sync_ — "Download all in project" as a zip with progress and a cancel button.
307. [ ] **[?]** _Sharing export and sync_ — Filename template setting (`{project}-{model}-{date}-{n}`) used by every download.
308. [ ] **[?]** _Sharing export and sync_ — Copy result URL with a note about its lifetime *(check platform TTL)*.
309. [ ] **[?]** _Sharing export and sync_ — Export history as CSV (prompt, model, status, created, finished) for spreadsheets.
310. [ ] **[?]** _Video viewer and tools_ — Storyboard mode: ordered list of shots (prompt + start frame), run all, auto-chain last frame to next start.
311. [ ] **[?]** _Video viewer and tools_ — Audio toggle badge: show which results have sound and let the user mute globally.
312. [ ] **[?]** _Video viewer and tools_ — Show duration and resolution as a badge on every video tile.
313. [ ] **[?]** _Video viewer and tools_ — Picture-in-picture button in the detail modal.
314. [ ] **[?]** _Visual design polish_ — Skeleton tiles sized to the requested aspect ratio so the layout doesn't jump on completion.
315. [ ] **[?]** _Visual design polish_ — Completion animation (subtle scale/fade), disabled under reduced motion.
316. [ ] **[?]** _Visual design polish_ — Tile status as a small consistent chip system (running, queued, failed, starred) with one shared component.
317. [ ] **[?]** _Visual design polish_ — Smooth reflow when tiles are added at the top (FLIP-style, off under reduced motion).
318. [ ] **[?]** _Visual design polish_ — Better drop-zone overlay when files are dragged over the window, not just the dock.

## Low value / nice to have

319. [ ] **[XS]** _Cleanup_ — `next.config.ts` runs `syncModels()` at import and `watchModels()` in dev; guard against running twice during config reloads and make the barrel write idempotent (skip when contents are unchanged).
320. [ ] **[XS]** _Cleanup_ — `tsconfig.tsbuildinfo` is in the working tree; confirm it is gitignored (it should not be committed).
321. [ ] **[XS]** _Cleanup_ — `app/favicon.ico` (26 KB) can be replaced by an SVG icon + small PNG fallbacks to cut weight.
322. [ ] **[XS]** _Cleanup_ — `public/model-icons/*.svg` include large files (`happy-horse.svg` 9.4 KB); run SVGO and add a test that each icon has a viewBox and no scripts.
323. [ ] **[XS]** _Cleanup_ — `styles/quanta/*` (many CSS files, ~100 KB) are design tokens and component CSS; run a CSS coverage report and delete unused rules, or confirm tree-shaking in the Tailwind layer.
324. [ ] **[XS]** _Cleanup_ — `CLAUDE.md` and `AGENTS.md` overlap; point one at the other to avoid drift.
325. [ ] **[XS]** _Cleanup_ — `FINDINGS.md` is 58 KB with three overlapping sections (Planned, Skipped, New ideas); this reorganization into one sorted list removes the duplication.
326. [ ] **[XS]** _Cleanup_ — `lib/studio/tips.ts` uses `localStorage` directly while all other stores go through `browserStorage()`; move it behind the same helper for consistent SSR safety and the `hf.` wipe rule.
327. [ ] **[XS]** _Cleanup_ — `generation/stores/active.ts` persists as `hf.active.v2` while others are `.v1`; document the versioning convention in `AGENTS.md` and add a test listing all persist keys so `wipeEverything` can't miss one.
328. [ ] **[XS]** _Cleanup_ — `public/presets/studio-*.svg` and placeholder templates remain (AGENTS requires replacing them); track as a launch checklist item with a script that fails the build if `placeholder-` assets are referenced.
329. [ ] **[S]** _Feature_ — Mobile layout pass: bottom-sheet dock, swipe between image/video surfaces, pull-to-refresh status, and a PWA install prompt (AGENTS: no second app shell, so adapt in place).
330. [ ] **[S]** _Feature_ — Offline mode: show history/gallery from cached media offline, queue submissions until online (they need the server, so queue locally and flush), and display connectivity state (`use-online` exists).
331. [ ] **[S]** _Feature_ — Bring-your-own-storage: let users configure an S3 bucket/WebDAV target to archive results automatically.
332. [ ] **[S]** _Feature_ — Webhooks/automation: an outgoing webhook on completion (URL in Settings) to trigger Zapier/n8n workflows with the result URL and metadata.
333. [ ] **[S]** _Feature_ — Public gallery export: generate a static HTML site from a project (grid + lightbox) for portfolios.
334. [ ] **[S]** _Feature_ — Prompt translation: auto-translate non-English prompts for models that perform better in English, shown with a diff before submit.
335. [ ] **[S]** _Feature_ — Voice input for prompts via the Web Speech API with language selection.
336. [ ] **[S]** _Feature_ — Collaboration (comments on runs, shared projects) requires a backend; design an adapter interface first and keep local-first as the default.
337. [ ] **[S]** _Feature_ — Optional PWA install with offline gallery browsing (cached posters) so the studio opens instantly and shows history without network.
338. [ ] **[S]** _Feature_ — Contact sheet export: a single PNG/PDF with N selected results, prompts as captions and model labels, for sending to clients.
339. [ ] **[S]** _Feature_ — Experiments tab: a table of runs for a fixed prompt across models/settings with columns for time-to-complete and star rating, to learn which settings work best.
340. [ ] **[M]** _Feature_ — Plugin API for post-processing steps (upscale, background removal, format conversion) running client-side via WASM and attachable to a run's output.
341. [ ] **[M]** _Feature_ — A CLI companion (`studio-cli`) sharing `generation/` code to run batch jobs from a prompt file and write results to disk, using the same catalog and error mapping.
342. [ ] **[?]** _Accessibility and i18n_ — Respect `prefers-reduced-motion` for video autoplay (show poster + play button), not just animations.
343. [ ] **[?]** _Accessibility and i18n_ — Touch targets >= 44 px on narrow viewports for tile menu and dock controls.
344. [ ] **[?]** _Accessibility and i18n_ — Tooltips with shortcut hints on all icon buttons.
345. [ ] **[?]** _Accessibility and i18n_ — Extract user-facing strings to one module to make translation possible later.
346. [ ] **[?]** _Accessibility and i18n_ — Format dates and durations with `Intl` using the browser locale.
347. [ ] **[?]** _Accessibility and i18n_ — Provide text equivalents for the elapsed-time ring on running tiles.
348. [ ] **[?]** _Accessibility and i18n_ — `lang` and `dir` attributes tied to a locale setting for future RTL.
349. [ ] **[?]** _Accessibility and i18n_ — Pluralization helper for "1 run / 2 runs" instead of string concatenation.
350. [ ] **[?]** _Assets and references_ — Auto-convert HEIC to JPEG in the browser before upload instead of refusing.
351. [ ] **[?]** _Assets and references_ — Auto-downscale oversized images to the model's max input size before upload.
352. [ ] **[?]** _Assets and references_ — Crop and rotate reference images before upload.
353. [ ] **[?]** _Assets and references_ — Reference reorder by drag, with role badges (start, end, style, character).
354. [ ] **[?]** _Assets and references_ — Mark an asset as "Character" and auto-attach it to prompts tagged `@name`.
355. [ ] **[?]** _Assets and references_ — Expire notice: if signed/public asset URLs expire, show "Re-upload needed" instead of failing at submit *(check platform TTL)*.
356. [ ] **[?]** _Assets and references_ — Show file size, dimensions and duration on each library card.
357. [ ] **[?]** _Assets and references_ — Duplicate-detection toast ("already uploaded, reusing") when the hash matches.
358. [ ] **[?]** _Assets and references_ — Drag a reference thumbnail from the dock to reorder or remove.
359. [ ] **[?]** _Assets and references_ — Remove-all-references one-click in the dock.
360. [ ] **[?]** _Code quality testing and dev experience_ — Replace the typed event bus idea with zustand selectors only; audit for prop drilling in `prompt-box.tsx`.
361. [ ] **[?]** _Code quality testing and dev experience_ — Generate a models table in the README from the catalog so docs never drift.
362. [ ] **[?]** _Code quality testing and dev experience_ — Lighthouse/axe run in CI against the built app.
363. [ ] **[?]** _Code quality testing and dev experience_ — Mock mode flag (`HF_MOCK=1`) that returns canned results, for screenshots and demos.
364. [ ] **[?]** _Code quality testing and dev experience_ — Typed `env.ts` that validates `HF_API_BASE_URL` at boot with a readable error.
365. [ ] **[?]** _Code quality testing and dev experience_ — Remove `console.*` from client code via an ESLint rule, routing through one logger.
366. [ ] **[?]** _Code quality testing and dev experience_ — Add a `docs/architecture.md` with one diagram of submit -> poll -> history.
367. [ ] **[?]** _Cost and usage awareness_ — Mark runs as free vs paid in the detail view.
368. [ ] **[?]** _Cost and usage awareness_ — Failed-run refund note ("not charged") when the platform says so *(check)*.
369. [ ] **[?]** _Cost and usage awareness_ — Average wait per model, so the "typical time" hint becomes per model after enough runs.
370. [ ] **[?]** _Cost and usage awareness_ — Export the usage stats as CSV.
371. [ ] **[?]** _Cost and usage awareness_ — Streak / habit counter (days with at least one generation); opt-in, off by default.
372. [ ] **[?]** _Dead code and dependencies_ — Unused dependencies and files: `radix-ui` (no component imports it; the UI is Base UI), `next-themes` and `components/theme-provider.tsx` (AGENTS.md says dark only, no toggle), the empty `components/.gitkeep`, `hooks/.gitkeep`, `lib/.gitkeep`. Remove them and run `pnpm install` to shrink the 595 MB `node_modules` a little and the dependency surface.
373. [ ] **[?]** _Dead code and dependencies_ — `lib/utils.ts` re-exports `cn` from an npm package literally named `cn` (`export { cn } from "cn"`, and `components/ui/*` import it directly). The usual shadcn helper is a six-line `clsx` + `tailwind-merge` function. Confirm what `cn@0.4.0` is and who maintains it, or replace it with the local helper so a third-party package isn't on the render path of every component.
374. [ ] **[?]** _Detail modal and viewers_ — Show the platform request id with a copy button for support.
375. [ ] **[?]** _Detail modal and viewers_ — Swipe-down to close on touch.
376. [ ] **[?]** _Detail modal and viewers_ — Preload the next and previous media while the modal is open.
377. [ ] **[?]** _Detail modal and viewers_ — Remember zoom level while paging between images.
378. [ ] **[?]** _Detail modal and viewers_ — Show "ago" and exact timestamp on hover for created and finished times.
379. [ ] **[?]** _Docs tests repo_ — AGENTS.md says every `/presets/placeholder-*.svg` and mock template must be replaced with real media and the placeholders deleted. `public/presets/studio-1..4.svg` and the starter `TEMPLATES` in `template-picker.tsx` are still the scaffold's (`HERO_FALLBACKS` in `layouts/studio.tsx` too). Either generate real example outputs with the app and use those, or remove the Explore tab until there is real content.
380. [ ] **[?]** _Editing and post-processing_ — Extract a frame from a video at the scrubber position and attach it as a reference or save as PNG.
381. [ ] **[?]** _Editing and post-processing_ — Convert video to GIF or WebM in the browser for sharing.
382. [ ] **[?]** _Editing and post-processing_ — Stitch several finished clips into one reel (client-side, `mediabunny` or `ffmpeg.wasm` only if asked).
383. [ ] **[?]** _Editing and post-processing_ — Flip / rotate for reference images before upload.
384. [ ] **[?]** _Editing and post-processing_ — Mask import (upload a PNG mask) for inpainting-capable models *(check)*.
385. [ ] **[?]** _Editing and post-processing_ — Speed up or slow down a finished video (client playback only, not a re-encode) for review.
386. [ ] **[?]** _Editing and post-processing_ — Add captions overlay preview (text on top of video, not burned in).
387. [ ] **[?]** _Editing and post-processing_ — Compare two takes with an A/B toggle key (`1`/`2`) in the modal.
388. [ ] **[?]** _Gallery and organization_ — "Open in new tab" and "Copy link" for result media.
389. [ ] **[?]** _Gallery and organization_ — Density control remembered per surface, plus a "Compact list" view with prompt text.
390. [ ] **[?]** _Gallery and organization_ — Project cover image picker (defaults to latest completed run).
391. [ ] **[?]** _Gallery and organization_ — Project descriptions and per-project default model/settings.
392. [ ] **[?]** _Gallery and organization_ — Duplicate project (copy run references into a new project).
393. [ ] **[?]** _Gallery and organization_ — Archive projects instead of only delete.
394. [ ] **[?]** _Gallery and organization_ — Comments/notes on a run (local) for review workflows.
395. [ ] **[?]** _Gallery and organization_ — Approval status on runs (Draft / Approved / Rejected) with filter.
396. [ ] **[?]** _Gallery and organization_ — A/B rating (thumbs up/down) on results, feeding a local "what works" prompt stats view.
397. [ ] **[?]** _Gallery and organization_ — "Jump to date" control and a mini scroll-rail with day ticks.
398. [ ] **[?]** _Gallery and organization_ — Hide failed runs with one toggle (without deleting; the AGENTS.md rule still holds for runs the user already saw generating).
399. [ ] **[?]** _Gallery and organization_ — Row-height / density slider with live relayout.
400. [ ] **[?]** _Gallery and organization_ — "Recently deleted" bin kept for 7 days with restore, backing the Undo toast.
401. [ ] **[?]** _Gallery and organization_ — Show the project name as a small chip on tiles when viewing "All".
402. [ ] **[?]** _Generation reliability_ — The API key is never verified on save. `savePlatformCredentials` only checks the character set (`credentials.ts:52-58`), so a wrong key shows "connected" until the first generation 401s. After saving, make one cheap authenticated request (for example `GET /requests/<random uuid>/status`: 401/403 = bad key, 404 = key accepted; confirm the platform really answers that way first) and show the result in the dialog.
403. [ ] **[?]** _Generation workflow_ — Auto-fill last frame: "Use last frame as next start frame" for video continuation chains.
404. [ ] **[?]** _Generation workflow_ — Batch CSV import: one prompt per row, run through a queue with a concurrency cap.
405. [ ] **[?]** _Generation workflow_ — Per-model "recommended settings" preset chips (Draft / Balanced / Final) mapped onto the settings dialog.
406. [ ] **[?]** _Generation workflow_ — Scheduled run: "Run again every N minutes" for daily-content use. *(skip unless asked)*
407. [ ] **[?]** _Generation workflow_ — "Re-run failed only" button for a selection or project.
408. [ ] **[?]** _Generation workflow_ — Show a per-run timeline in the detail modal (queued, started, finished) from timestamps we already record.
409. [ ] **[?]** _Generation workflow_ — Run notes: a free-text field on the dock that is saved with the run ("client wants warmer").
410. [ ] **[?]** _Generation workflow_ — Concurrency setting (1-4) in app Settings instead of the fixed 2.
411. [ ] **[?]** _Image viewer_ — Before/after toggle against the reference used.
412. [ ] **[?]** _Image viewer_ — Grid overlay (thirds, safe areas) toggle in the viewer.
413. [ ] **[?]** _Image viewer_ — Pinch-zoom in the detail modal for images.
414. [ ] **[?]** _Image viewer_ — Blur-up placeholder using a tiny base64 thumb stored with the run.
415. [ ] **[?]** _Image viewer_ — Dominant-color tile background while loading, to reduce flash.
416. [ ] **[?]** _Mobile and PWA_ — Safe-area insets (`env(safe-area-inset-bottom)`) for the dock on iOS.
417. [ ] **[?]** _Mobile and PWA_ — Long-press tile menu on touch instead of hover-only actions.
418. [ ] **[?]** _Mobile and PWA_ — Haptic tick (`navigator.vibrate`) on completion where supported.
419. [ ] **[?]** _Mobile and PWA_ — Share-sheet "Add to Studio" for images from the camera roll *(overlaps Web Share Target)*.
420. [ ] **[?]** _Mobile and PWA_ — Install prompt shown once after the third completed run.
421. [ ] **[?]** _Mobile and PWA_ — Reduce motion and autoplay by default on data-saver connections (`navigator.connection.saveData`).
422. [ ] **[?]** _Models and settings_ — Duration slider with live cost/time hint per model.
423. [ ] **[?]** _Models and settings_ — Model changelog/"new" badge when `registry.json` adds an entry since last visit.
424. [ ] **[?]** _Models and settings_ — "Cheapest model that supports these inputs" suggestion chip.
425. [ ] **[?]** _Models and settings_ — Show a "needs reference" badge on models that require an input image or video.
426. [ ] **[?]** _Models and settings_ — Model deprecation notice if the platform stops returning a model *(check)*.
427. [ ] **[?]** _Models and settings_ — Group the picker by vendor with collapsible sections.
428. [ ] **[?]** _Onboarding and first run_ — Sample project pre-seeded on first load that the user can delete.
429. [ ] **[?]** _Onboarding and first run_ — "What's new" dialog driven by a version constant.
430. [ ] **[?]** _Onboarding and first run_ — Contextual tip when the user's first video is slow: "Videos take a few minutes; you can leave the tab".
431. [ ] **[?]** _Onboarding and first run_ — "Replay tour" entry in the command palette.
432. [ ] **[?]** _Onboarding and first run_ — Link to docs/help from the shortcuts dialog.
433. [ ] **[?]** _Performance_ — Analyze the bundle (`@next/bundle-analyzer`) once; lazy-load the settings dialog, detail modal, asset library. *(Partly: the command palette, shortcuts, usage, privacy and move dialogs now load on first use. The analyzer was not run, and the settings dialog, detail modal and asset library stay eager because they are opened by their own trigger buttons.)*
434. [ ] **[?]** _Performance_ — Prefetch the next page of history on idle. *(Not applicable: IndexedDB history is read in one go, capped at 400 runs.)*
435. [ ] **[?]** _Performance_ — Turn on `reactCompiler` in Next 16 and measure re-renders in the gallery.
436. [ ] **[?]** _Performance_ — `content-visibility: auto` on off-screen sections of the detail modal.
437. [ ] **[?]** _Performance_ — Use `fetchpriority="high"` for the first row of images and `low` for the rest.
438. [ ] **[?]** _Performance_ — Service-worker cache for static assets only (not signed URLs).
439. [ ] **[?]** _Product expansion_ — Mood-board: drag finished tiles onto a free-form canvas inside a project.
440. [ ] **[?]** _Product expansion_ — Webhook/notify URL when a run finishes *(needs server; only if asked)*.
441. [ ] **[?]** _Product expansion_ — Public read-only API route to submit prompts (server-key mode for teams) *(security review first)*.
442. [ ] **[?]** _Product expansion_ — Team mode: shared key held server-side instead of per-browser cookie *(changes AGENTS.md boundary; ask first)*.
443. [ ] **[?]** _Product expansion_ — Project templates ("Product ad", "Social reel") that create a project with starter prompts.
444. [ ] **[?]** _Product expansion_ — Public "gallery mode" fullscreen slideshow of a project for presenting.
445. [ ] **[?]** _Product expansion_ — Plugin point for custom post-processing actions in the tile menu.
446. [ ] **[?]** _Product expansion_ — Read-only "client review" export: a static HTML file with the project's media embedded.
447. [ ] **[?]** _Product gaps_ — Model picker for 28 models: add search and a "Recent" group at the top (`useActive` already persists the selection), since Kling alone has five entries.
448. [ ] **[?]** _Product gaps_ — Prompt recall: keep the last ~30 distinct prompts per surface and open them with Up arrow in the empty prompt box, so reruns don't depend on finding the right tile and using Copy prompt.
449. [ ] **[?]** _Prompt box and input_ — Voice dictation for the prompt via Web Speech API (feature-detect).
450. [ ] **[?]** _Prompt box and input_ — Image-to-prompt: describe an attached reference into the prompt box (server action).
451. [ ] **[?]** _Prompt box and input_ — Slash commands: `/image`, `/video`, `/model kling`, `/project name` to drive the dock from the keyboard.
452. [ ] **[?]** _Prompt box and input_ — Word-wrap-aware token estimate shown under the box for models with a limit.
453. [ ] **[?]** _Prompt box and input_ — Drag text from a tile's prompt into the dock to reuse it.
454. [ ] **[?]** _Prompt box and input_ — Paste a URL to an image and have the server fetch and attach it as a reference (needs an SSRF-safe allowlist).
455. [ ] **[?]** _Prompt box and input_ — Smart quotes / whitespace cleanup on paste (toggle).
456. [ ] **[?]** _Prompt box and input_ — Rotating placeholder text that shows a real example per surface.
457. [ ] **[?]** _Resilience safety and privacy_ — Rate-limit Generate clicks client-side and show the server's `Retry-After`.
458. [ ] **[?]** _Resilience safety and privacy_ — Blur-NSFW-by-default toggle for results flagged by the platform *(check)*.
459. [ ] **[?]** _Resilience safety and privacy_ — Idle lock: hide the gallery behind a click after N minutes (shared screens).
460. [ ] **[?]** _Resilience safety and privacy_ — Panic key / "Hide previews" toggle for screen sharing.
461. [ ] **[?]** _Resilience safety and privacy_ — Subresource integrity / pinned CDN hosts list in CSP for media origins only.
462. [ ] **[?]** _Resilience safety and privacy_ — Auto-clear clipboard-pasted images from memory (revoke object URLs) once uploaded.
463. [ ] **[?]** _Resilience safety and privacy_ — "Private mode" toggle: do not write new runs to history until switched off.
464. [ ] **[?]** _Resilience safety and privacy_ — Warn when the origin is not HTTPS (cookie `secure` flag will not apply).
465. [ ] **[?]** _Resilience safety and privacy_ — Version the exported file format and reject files from the future with a clear message.
466. [ ] **[?]** _Sharing export and sync_ — Download with a meaningful filename (`{slug-of-prompt}-{model}-{id}.png`) rather than a hash.
467. [ ] **[?]** _Sharing export and sync_ — Native Web Share on mobile for the Share action.
468. [ ] **[?]** _Sharing export and sync_ — Export a "recipe" JSON (prompt + model + settings + reference URLs) and import it to reproduce.
469. [ ] **[?]** _Sharing export and sync_ — Export/import the *entire* app state (settings, projects, history index, prompts) in one file.
470. [ ] **[?]** _Sharing export and sync_ — Contact-sheet export: one PNG grid of a project's images.
471. [ ] **[?]** _Sharing export and sync_ — Print/contact-sheet layout CSS (`@media print`) for a project.
472. [ ] **[?]** _Sharing export and sync_ — Embed metadata (prompt, model) in downloaded PNG/MP4 where cheap.
473. [ ] **[?]** _Sharing export and sync_ — URL state for surface, model, and project so back/forward and bookmarks work.
474. [ ] **[?]** _Sharing export and sync_ — Deep link to a single generation (`?run=id`) opening the detail modal.
475. [ ] **[?]** _Sharing export and sync_ — Import prompts from a text file, one per line, into the prompt library.
476. [ ] **[?]** _Sharing export and sync_ — Auto-backup reminder: "Last export 30 days ago" nudge when history is large.
477. [ ] **[?]** _Sharing export and sync_ — Share sheet that builds a markdown snippet (prompt + link) for chat tools.
478. [ ] **[?]** _Sharing export and sync_ — Email-to-self of a recipe link via `mailto:`.
479. [ ] **[?]** _Video viewer and tools_ — Loop-seam preview: play last 1 s into first 1 s to judge loopability.
480. [ ] **[?]** _Video viewer and tools_ — Hover-scrub preview on video tiles (mouse X maps to time).
481. [ ] **[?]** _Video viewer and tools_ — Poster-frame picker: choose which frame is the tile thumbnail.
482. [ ] **[?]** _Video viewer and tools_ — Playback fallback message when the browser can't decode the codec, with Download.
483. [ ] **[?]** _Video viewer and tools_ — Remember mute/volume across sessions.
484. [ ] **[?]** _Video viewer and tools_ — Burn-in watermark/caption export (canvas + MediaRecorder) *(only if product asks)*.
485. [ ] **[?]** _Video viewer and tools_ — Background music attach for silent models (client-side mux) *(heavy; skip unless asked)*.
486. [ ] **[?]** _Visual design polish_ — Distinct, readable failed-tile design with the reason inline and Retry/Delete.
487. [ ] **[?]** _Visual design polish_ — Consistent model badges/icons per vendor in picker and tiles.
488. [ ] **[?]** _Visual design polish_ — Sticky dock that collapses to a single line while scrolling the feed.
489. [ ] **[?]** _Visual design polish_ — Toast stack with Undo, dedupe, and a max of 3 visible.
490. [ ] **[?]** _Visual design polish_ — Subtle gradient glow behind running tiles keyed to the model vendor.
491. [ ] **[?]** _Visual design polish_ — Consistent icon set audit (one stroke width and size across the app).
492. [ ] **[?]** _Visual design polish_ — Typographic scale review: one set of sizes for labels, metadata and headings.
493. [ ] **[?]** _Visual design polish_ — Empty-state illustrations replaced with on-brand art (ties to the placeholders Issue).
494. [ ] **[?]** _Visual design polish_ — Page-load fade of the first row only, so there is no large layout flash.

## Done (earlier rounds, kept for reference)

- [x] **[H]** One transient status error permanently fails a running generation. `getGenerationStatuses` turns any thrown `PlatformError` (a 502, a 429, a dropped connection) into `{ requestId, error }` (`generation/actions.ts:60-72`); `deliver()` then rejects that waiter at once (`generation/poll.ts:94`) and `useRuns` marks the run `failed` (`lib/studio/use-runs.ts:43-47`). The job is still running (and billed) on the platform, but the tile says failed and polling stops. Only treat 4xx other than 429 (unknown request, bad key) as terminal; count consecutive transient errors per request and give up after ~3 rounds, exactly as `MAX_MISSES` already does for whole-round failures.
- [x] **[H]** Only one generation can run at a time. `handleGenerate` returns while `generating` is true (`layouts/studio.tsx:387`), `useRuns.submit` has its own `submitting` lock (`use-runs.ts:76`), and the dock switches to Cancel for the whole queue. Yet `poll.ts` is built to watch many requests in one server action. Video models take minutes, so the user is stuck staring at one tile. Allow N concurrent runs (cap at 2 and show "2 running"), drop the global `generating` gate, keep the short `submitting` lock only around the submit call itself.
- [x] **[H]** Variations: "More like this" on any tile, re-run with the same prompt and settings, new seed. *(Done: tile menu "More like this"; the platform picks a new seed, the catalog has no seed setting.)*
- [x] **[H]** Favorites/stars with a "Starred" filter, stored in the run record.
- [x] **[H]** Key dialog explains where to get a key and links there; show "connected" state with masked key tail.
- [x] **[H]** Error boundary around the gallery and detail modal so one bad record doesn't blank the app.
- [x] **[M]** Cancel is all-or-nothing and not authoritative. `handleCancel` cancels every running run (`layouts/studio.tsx:408-413`). `cancel()` marks the run failed/"Canceled" as soon as the request returns (`use-runs.ts:116`) but the watch keeps going, so a later `completed` status silently overwrites "Canceled". `platform.ts` documents that only *queued* requests can be canceled (202), so for an in-progress job the tile lies. Add a per-tile cancel, show "Canceling…", stop the watch (`unwatch(requestId)` in `poll.ts`), and let the next poll decide the final state; if the platform refuses, say "Already running, can't cancel".
- [x] **[M]** A slow job becomes a permanent failure. Deadline is `createdAt + 15 min` (`use-runs.ts:39`), after which the run is marked "timed out waiting for the platform" and never polled again, even though the platform may still finish it (and charge for it). Use "Still working" instead of failed, keep a "Check again" button that re-watches by `requestId`, and give video models a longer deadline than image models.
- [x] **[M]** A retry after an ambiguous failure can double-charge. The idempotency key is minted inside `submit()` for every click (`use-runs.ts:82`). If `submitGeneration` times out after the platform accepted the job, the user's next click creates a new key and a second paid generation. Store the key with the pending attempt, reuse it for retries of the same plane, and rotate it only after success, a definite 4xx, or a change to the prompt/settings.
- [x] **[M]** Two tabs overwrite each other's history. Each tab loads history once and then writes its whole array on every change (`use-runs.ts:68`, `history.ts:38-41`), so runs created in tab B are erased the next time tab A saves. Use a `BroadcastChannel` to merge updates, or store one IndexedDB record per run (`put` by id) and read the union on focus.
- [x] **[M]** Expired key looks configured. `keyConfigured` is read once at mount (`layouts/studio.tsx:332`). If the 30-day cookie expires or is removed in another tab, Generate throws `MissingCredentialsError` and the message appears in the dock, but the Key dialog never opens. In `submit`'s catch, detect `MissingCredentialsError` / 401 / 403, set `keyConfigured` to false and open the dialog; re-check `hasPlatformCredentials()` on window focus.
- [x] **[M]** Tell the user when a long run finishes. *(Done: tab title count, "Done"/"Failed" title and opt-in desktop notification when the tab is hidden; the optional chime was left out.)* A video can take several minutes, and with the tab in the background timers are throttled and nothing signals completion. Put the count in `document.title` (`(2) generating…`), flip it to `Done` on completion, and offer an opt-in desktop notification (`Notification.requestPermission`) plus an optional soft chime.
- [x] **[M]** Move a generation into a project later. *(Done in the tile menu and the multi-select bar; not added to the detail modal.)* `projectId` is set only at submit time (`use-runs.ts:91`) and no code ever changes it, so anything generated from Home or "All" can't be filed. Add "Move to project" to the tile menu and the detail modal.
- [x] **[M]** Reference intake is click-only outside the library dialog. There is no drag-and-drop onto the dock and no paste-from-clipboard (`onPaste`/`onDrop` appear only in `asset-library.tsx`). Accept pasted images (Cmd/Ctrl+V in the prompt box) and files dropped on the dock, upload them, and attach with the right role. Also say why a file is refused: iPhone HEIC, MOV and MP3 are rejected today with a generic "Use JPEG, PNG, WebP, GIF, MP4, or WAV".
- [x] **[M]** Multi-select in the feed: select many tiles for bulk Download (zip), Delete and Move to project. All actions are per tile today, so clearing out 30 failed runs is 30 clicks (and Delete has no confirmation or undo, `onDelete={(item) => runs.remove(item.runId)}`; add a 5-second Undo toast).
- [x] **[M]** The platform client logs everything. `send()` writes `console.info("[platform] request", { method, url, body })` and the response body (`generation/platform.ts:63-80`), and polling calls it for every in-flight run every 4 seconds. Prompts and reference URLs end up in server logs and the log volume grows with each open generation. Log only submit, cancel and errors, never prompt bodies, and put the rest behind `HF_DEBUG=1`.
- [x] **[M]** `README.md` is the unedited shadcn/Next template text. Nothing says what this project is, that `HF_API_BASE_URL` must be set, where to get a key, or how models are added; the old `.env.example` (mentioned in the commit log) is gone. Commit `.env.example` (`HF_API_BASE_URL=`), document `pnpm dev|build|typecheck|lint`, the key flow (httpOnly cookie, per browser), and where data lives (IndexedDB + localStorage, nothing server-side).
- [x] **[M]** There are no tests, and the code that most needs them is pure: 28 hand-written model files with custom `toPlatform` maps (Kling 3 has six variants, Soul, Seedance). Add Vitest and one table test that, for every model in `MODELS`, builds a plane from its default settings and asserts `toPlatform` returns a path + JSON body without throwing (catches a bad model file immediately), plus unit tests for `poll.ts` (transient error vs terminal), `parseUploadTicket`, `aspectFromSettings` and `justified-engine` row math.
- [x] **[M]** Queue: accept new prompts while others run and show queue position per tile. *(Done: client-side queue, 2 run at once, "Queued · n" tiles; the queue is lost on reload and the dock shows "Cancel all" when there is nothing new to send.)*
- [x] **[M]** Model info popover: what it is best at, max duration, supported inputs, relative speed. *(Done as a one-line description under each model in the picker: inputs, longest clip, rough speed, all derived from the catalog. "Best at" is not in the catalog, so it is omitted.)*
- [x] **[M]** Dedupe uploads by content hash so re-attaching the same file reuses the URL. *(Done: SHA-256 stored on the upload record. A reused URL is assumed to still be valid; the platform's URL lifetime is unknown.)*
- [x] **[M]** Upload progress bar and cancel for large videos *(Done with XHR: percent in the library card and the dock, with Cancel.)* (XHR or `fetch` with stream; currently a spinner *(check)*).
- [x] **[M]** Filter chips: image / video / failed / by model / by project. *(Done: All/Images/Videos/Starred/Failed chips plus a model select. By-project is the sidebar's project view.)*
- [x] **[M]** Sort options: newest, oldest, model, favorites first.
- [x] **[M]** Group-by-day headings with sticky date labels in the feed. *(Day headings show in date order; they are off when sorting by model or starred.)*
- [x] **[M]** Empty-state per filter *(Done: filtered-out feeds say what is missing. The empty-state art is still the scaffold's; see Issues Needing Review.)* ("No failed runs" vs "No history yet") with a relevant action.
- [x] **[M]** Validate/migrate IndexedDB records on load *(Done with hand-written checks instead of zod, and a notice for skipped rows; unreadable rows are dropped on the next save. There is no schema version yet, and the shared `readJson` helper was not added: localStorage goes through zustand persist.)* (schema version + zod); skip and report corrupt rows rather than crash. Use one `readJson(schema)` helper for every IndexedDB/localStorage read.
- [x] **[M]** Offline banner: disable Generate and say "You're offline" instead of failing with a fetch error.
- [x] **[M]** Map platform error codes to friendly messages *(Done in `generation/errors.ts`, applied to submit errors and failed-run reasons.)* (content filter, insufficient credits, rate limit, model unavailable) with a next step each. Centralize in `generation/errors.ts`.
- [x] **[M]** Storage quota warning (`navigator.storage.estimate`) with "Clear cache" and Export. *(Done inside the Privacy and storage dialog (command palette), not as a proactive banner; "Clear cache" is the full wipe.)*
- [x] **[M]** Privacy panel: states exactly what is stored where (cookie, IndexedDB, localStorage) with a "Wipe everything" button.
- [x] **[M]** "Wipe everything" also clears the httpOnly cookie via a server action.
- [x] **[M]** Use `loading="lazy"` plus a low-res poster/thumbnail for videos *(Done for the lazy part: a video tile downloads only after it has been near the viewport, and never unloads. No low-res poster: result URLs are cross-origin, so frames cannot be read.)*; only attach `src` when near the viewport (keeps AGENTS.md rule: never unmount *loaded* media).
- [x] **[M]** Cap simultaneously playing videos (pause others on hover-play) to save CPU/battery.
- [x] **[M]** Back off polling: 4 s for the first minute *(Done: 4 s, then 8 s, then 15 s by age of the newest watch; a hidden tab polls every 30 s instead of pausing, so completion notifications still work.)*, then 8-15 s for long video jobs; pause when the tab is hidden and resume on `visibilitychange`.
- [x] **[M]** Progress feel for running tiles: elapsed timer plus per-model typical time ("~2 min"). *(Typical time is per surface (~30 s image, ~3 min video), not per model.)*
- [x] **[M]** Split `layouts/studio.tsx` *(Partly: `useKeyStatus` and `useStudioKeys` are extracted; a `useDock` was not, and the file is still about 800 lines.)* (it owns prompt, media, generate, cancel, key state); extract hooks (`useDock`, `useKeyStatus`) to make it testable.
- [x] **[M]** One typed `Result<T, E>` for server actions *(`Result` in `generation/result.ts`, used by save-key and cancel; submit has its own richer `SubmitResult`. Status polling and the upload route still use their own shapes.)* so the client never inspects thrown errors.
- [x] **[M]** Add `error.tsx` and `not-found.tsx` to `app/` with on-brand copy.
- [x] **[M]** Add `loading.tsx` / suspense skeleton for the first paint.
- [x] **[M]** Add structured server logging with request ids (no prompts) *(One JSON line per submit/cancel/error; the id shows as "Support ID" on failed tiles.)*, so a failed run's tile can show "Support ID".
- [x] **[L]** The status fan-out has no upper bound. `getGenerationStatuses` runs `Promise.all` over every id sent (`actions.ts:63`), and `parseRequestIds` only checks that the array is non-empty. A crafted server-action call can trigger thousands of platform requests. Dedupe, cap at 50 ids per call, and limit concurrency to ~8.
- [x] **[L]** Show cost/time expectations before submit. *(Done as a static Generate tooltip per surface; no per-model hints, the platform returns no cost, and there is no batch to confirm.)* If the platform returns credits or an estimate, display it on the Generate button; otherwise add a static per-model hint (`~30 s`, `~3 min`) to the catalog entries and a confirm for batches above 1.
- [x] **[L]** Add response headers in `next.config.ts` via `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP that allows `img-src`/`media-src` `https:` and `blob:` (results and references come from the platform's CDN) with `frame-ancestors 'none'`. The key is an httpOnly cookie, so clickjacking the key dialog is the realistic risk.
- [x] **[L]** Uploads have no client-side size check *(Done with guessed limits in `MAX_UPLOAD_BYTES`: 25 MB image, 200 MB video, 50 MB audio; replace with the platform's real limits.)* (`generation/upload.ts`). The browser PUTs straight to signed storage, so an oversized file wastes a signed URL and fails late with "Reference upload failed (413)". Validate `file.size` per kind (set limits from the platform docs) before requesting a ticket, and show the limit in the error.
- [x] **[L]** `proxy.ts` mints *(Done: both files removed.)* a `hf_device` cookie (400 days) for every new visitor, but nothing reads it (grep: only `proxy.ts` and `generation/device.ts` mention it). Remove both files, or document what the device id is for. It also removes a middleware hop from every page request.
- [x] **[L]** Add a GitHub Actions workflow: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build`. `next build` is the check that catches server/client boundary mistakes the template warns about (touching `window` during SSR).
- [x] **[L]** Page metadata is generic (`title: "Studio"`). *(Done: title template, Open Graph, description; the product name is still "Studio" and the theme color already matched the token. A custom favicon needs real brand art.)* Set a product name/description, Open Graph tags and a real favicon, and keep `viewport.themeColor` in sync with the actual background token.
- [x] **[L]** Remember settings per model, not per surface, so switching back restores them. *(Already true: `useSettings` is keyed by model.)*
- [x] **[L]** Auto-grow textarea with max height and internal scroll. *(Done with `field-sizing: content`; Chromium only, other browsers keep the fixed height and scroll.)*
- [x] **[L]** Spellcheck toggle and language hint. *(Spellcheck toggle done; the language hint was left out, the field follows the page language.)*
- [x] **[L]** Aspect ratio picker with visual frames and a "match reference" option. *(Frames done; "match reference" left out, since no model declares such a value.)*
- [x] **[L]** "Reset to defaults" button in the settings dialog.
- [x] **[L]** EXIF-free guarantee note: strip metadata from uploaded references (privacy). *(Done for JPEG and PNG; WebP, GIF, MP4 and WAV are uploaded as they are. A JPEG rotated by EXIF is re-encoded so it keeps its orientation.)*
- [x] **[L]** Detail modal shows all settings used, seed, model, duration, and timing, with "Copy as JSON". *(Done except seed: the catalog has no seed setting. "Took" is shown for runs finished after this change.)*
- [x] **[L]** One-time tip toasts for hidden features *(Done for shortcuts and paste/drop; Up-arrow recall does not exist yet.)* (paste image, Up-arrow recall), each shown once.
- [x] **[L]** Keyboard shortcut cheat sheet on `?`.
- [x] **[L]** Command palette (`Cmd/Ctrl+K`): switch model, project, surface, open settings, search history. *(Done for models, projects, surfaces, API key and shortcuts. "Open settings" and history search are left out: the settings dialog is opened by its own trigger and the feed has no text search yet.)*
- [x] **[L]** Usage dashboard: runs per model/day, success rate, median time-to-complete (local data). *(Done as a Usage dialog in the command palette; median time only counts runs finished after completion times were recorded.)*
- [x] **[L]** "Sign out" in the Key dialog that clears the cookie server side (confirm it exists and works). *(Confirmed: "Remove API key" calls `clearPlatformCredentials`.)*
- [x] **[L]** Debounce history writes (batch within 250 ms) *(Flushed on `pagehide`.)* instead of rewriting the whole array each tick.
- [x] **[L]** Move IndexedDB reads off first paint with `Suspense` skeletons *(Done as a loading skeleton in the feed, not `Suspense`; it also stops the "No generations yet" flash.)* to avoid layout shift.
- [x] **[L]** Custom scrollbars matching the dark tokens.
- [x] **[L]** Enforce "no `window` at module scope" *(Done as `no-restricted-globals` on the server-reachable files.)* with an ESLint rule/`no-restricted-globals` override for server-reachable files.
- [x] **[L]** Enable `noUncheckedIndexedAccess` in tsconfig and fix fallout *(No errors needed fixing.)* *(strict TS stays strict)*.
- [x] **[L]** Replace magic numbers (400 records, 15 min, 4 s) with one `lib/studio/limits.ts`. *(Polling intervals stay in `generation/poll.ts`.)*
- [x] **[L]** Add `scripts/check-models.mjs` run in CI *(Covered by `tests/catalog.test.ts`, which CI runs, instead of a separate script.)*: each model file has name, surface, defaults, and `toPlatform`.
- [x] **[L]** `CONTRIBUTING.md` / `docs/adding-a-model.md` with the exact shadcn command and the sync script behavior.
- [x] **[L]** Storybook-free visual check: a `/dev/components` route *(Renders generating, stalled, failed and ready tiles.)* (dev only) rendering tiles in every state (loading, failed, completed, filtered).
- [x] **[L]** Pre-commit hook (`lint-staged` + typecheck) *(A plain `.githooks/pre-commit` running typecheck and lint, enabled by the `prepare` script; no lint-staged dependency.)* so findings like unused deps don't recur.
- [x] **[L]** Dependabot/Renovate config; the 16.4.0 -> 16.4.3 security bump in the log shows this is manual today.
- [x] **[L]** Add `pnpm dlx knip` to CI *(Pinned and limited to files, dependencies and unlisted; `knip.json` ignores the known leftovers listed under Skipped > Dead code, so remove those entries when that cleanup lands.)* to catch dead files/exports (would have caught the stores/plane items).

---

## Issues needing review (earlier pass, decisions still open)

_Kept verbatim; each says why it was not done and what decision is needed._


- **API key verification on save** (Planned > Generation reliability, [L]). Not done. The plan probes `GET /requests/<random uuid>/status` and treats 401/403 as "bad key", but I can't confirm the platform answers an unknown request id with 404 rather than 403 (no key or `HF_API_BASE_URL` here). If it returns 403 for unknown ids, the check would block every valid key from being saved. Decision needed: confirm the platform's behavior (or name a cheap authenticated endpoint) and I'll wire it into `savePlatformCredentials`.

- **Replace scaffold placeholders with real media** (Planned > Docs, tests, repo, [L]). Not done. `public/presets/studio-1..4.svg`, the starter `TEMPLATES` in `components/studio/template-picker.tsx` and `HERO_FALLBACKS` in `layouts/studio.tsx` are still the scaffold's. Replacing them needs real, on-brand outputs: generating them spends Higgsfield credits and needs your brand direction. Decision needed: (a) tell me the product/brand and approve spending credits on example media, (b) supply the media, or (c) remove the Explore tab and hero fallbacks until there is content.

- **Disable settings combinations a model rejects** (Planned > Models and settings, [M]). Not done. Catalog entries only describe each setting on its own (`enum`/`range`/`boolean`); nothing says which combinations the platform refuses (for example resolution with duration), so there is nothing to grey out. Decision needed: list the known-invalid combinations per model (or point me at the platform docs) and I will add a `constraints` field to `ModelEntry` and disable options in the picker and dialog.

- **Auto-convert HEIC to JPEG before upload** (Planned > Assets and references, [L]). Not done. Browsers other than Safari cannot decode HEIC, so this needs a WASM decoder dependency (for example `heic2any`/`libheif-js`, roughly 1 MB+). Decision needed: approve adding that dependency (lazy-loaded), or keep the current clear refusal message ("Export the photo as JPEG or PNG first").
- **Auto-downscale oversized images to the model's max input size** (Planned > Assets and references, [L]). Not done. No catalog entry declares a maximum input resolution or file size, so there is no target to downscale to. Decision needed: the per-model (or global) max edge/size, and whether to add an `inputMaxEdge` field to `ModelEntry`.

- **Cache thumbnails in IndexedDB** (Planned > Performance, [M]). Not done. Result media is served cross-origin from the platform CDN, so the browser cannot draw video frames to a canvas (tainted canvas) and a `fetch` of the bytes depends on the CDN sending CORS headers, which I can't verify without a key. Decision needed: confirm the CDN sends `Access-Control-Allow-Origin` (then I will cache image thumbnails), or accept no offline thumbnails.
- **Turn on `reactCompiler` and measure re-renders** (Planned > Performance, [L]). Not done. It needs `babel-plugin-react-compiler` as a new dependency and a profiling session in a browser against real data, which I can't do here. Decision needed: approve the dependency and run the React profiler on the gallery before/after, or drop the item.

- **Playwright smoke test for the verification scenarios** (Planned > Code quality, [M]). Not done. It needs `@playwright/test` plus a multi-hundred-MB browser download, and the cancel / content-filter scenarios need a live platform key or a mocked platform server. Decision needed: approve the dependency and say whether to mock the platform (a small local fake behind `HF_API_BASE_URL`) or run against the real one.
- **Generate a models table in the README from the catalog** (Planned > Code quality, [L]). Not done. The catalog is TypeScript with `@/` imports, so a plain Node script can't load it; it needs `tsx` or a build step. Decision needed: approve `tsx` as a dev dependency (or accept a vitest-driven generator).
- **Lighthouse/axe run in CI** (Planned > Code quality, [L]). Not done. It needs a built server in CI plus a score threshold policy. Decision needed: which pages and what minimum scores should fail the build.
- **Audit `prompt-box.tsx` for prop drilling / replace the event-bus idea** (Planned > Code quality, [L]). Not done: the item is a design review rather than a concrete change. Decision needed: say which props bother you, or drop the item.
