# Higgsfield Studio: Findings

Reviewed 2026-10-13 against `17b2826` (Next.js 16, React 19, Tailwind 4, Base UI, zustand, 28 catalog models). `pnpm typecheck` and `pnpm lint` both pass clean, so everything below is behavior, design and hygiene, not type errors.

`AGENTS.md` is the template contract (server boundaries, dark theme only, preserve every model). Nothing here suggests breaking it; where an item touches a rule, the rule is quoted.

**Tags:** **[H]** high, **[M]** medium, **[L]** low. `[ ]` = open. Within every section, items run H, then M, then L.

## How this file is organized

- **Planned:** what we want to do eventually.
- **Skipped for now:** everything else. Kept for reference, not rejected.
- Both split into **Verified findings** (checked by reading the code or grepping) and **Ideas** (brainstorm, not verified bugs; *(check)* marks behavior I did not confirm in code). Ideas respect `AGENTS.md` (server boundary, dark only, all models visible).

## Start here (planned [H] items)

1. One transient status error permanently fails a running generation.
2. Only one generation can run at a time.
3. Favorites/stars with a "Starred" filter.
4. Variations: "More like this" on any tile.
5. Key dialog explains where to get a key.

(Also [H], in Resilience: error boundary around the gallery and detail modal.)

---

# Planned

## Verified findings

### Generation reliability (bugs)
- [x] **[H]** One transient status error permanently fails a running generation. `getGenerationStatuses` turns any thrown `PlatformError` (a 502, a 429, a dropped connection) into `{ requestId, error }` (`generation/actions.ts:60-72`); `deliver()` then rejects that waiter at once (`generation/poll.ts:94`) and `useRuns` marks the run `failed` (`lib/studio/use-runs.ts:43-47`). The job is still running (and billed) on the platform, but the tile says failed and polling stops. Only treat 4xx other than 429 (unknown request, bad key) as terminal; count consecutive transient errors per request and give up after ~3 rounds, exactly as `MAX_MISSES` already does for whole-round failures.
- [x] **[H]** Only one generation can run at a time. `handleGenerate` returns while `generating` is true (`layouts/studio.tsx:387`), `useRuns.submit` has its own `submitting` lock (`use-runs.ts:76`), and the dock switches to Cancel for the whole queue. Yet `poll.ts` is built to watch many requests in one server action. Video models take minutes, so the user is stuck staring at one tile. Allow N concurrent runs (cap at 2 and show "2 running"), drop the global `generating` gate, keep the short `submitting` lock only around the submit call itself.
- [x] **[M]** Cancel is all-or-nothing and not authoritative. `handleCancel` cancels every running run (`layouts/studio.tsx:408-413`). `cancel()` marks the run failed/"Canceled" as soon as the request returns (`use-runs.ts:116`) but the watch keeps going, so a later `completed` status silently overwrites "Canceled". `platform.ts` documents that only *queued* requests can be canceled (202), so for an in-progress job the tile lies. Add a per-tile cancel, show "Canceling…", stop the watch (`unwatch(requestId)` in `poll.ts`), and let the next poll decide the final state; if the platform refuses, say "Already running, can't cancel".
- [x] **[M]** A slow job becomes a permanent failure. Deadline is `createdAt + 15 min` (`use-runs.ts:39`), after which the run is marked "timed out waiting for the platform" and never polled again, even though the platform may still finish it (and charge for it). Use "Still working" instead of failed, keep a "Check again" button that re-watches by `requestId`, and give video models a longer deadline than image models.
- [x] **[M]** A retry after an ambiguous failure can double-charge. The idempotency key is minted inside `submit()` for every click (`use-runs.ts:82`). If `submitGeneration` times out after the platform accepted the job, the user's next click creates a new key and a second paid generation. Store the key with the pending attempt, reuse it for retries of the same plane, and rotate it only after success, a definite 4xx, or a change to the prompt/settings.
- [x] **[M]** Two tabs overwrite each other's history. Each tab loads history once and then writes its whole array on every change (`use-runs.ts:68`, `history.ts:38-41`), so runs created in tab B are erased the next time tab A saves. Use a `BroadcastChannel` to merge updates, or store one IndexedDB record per run (`put` by id) and read the union on focus.
- [x] **[M]** Expired key looks configured. `keyConfigured` is read once at mount (`layouts/studio.tsx:332`). If the 30-day cookie expires or is removed in another tab, Generate throws `MissingCredentialsError` and the message appears in the dock, but the Key dialog never opens. In `submit`'s catch, detect `MissingCredentialsError` / 401 / 403, set `keyConfigured` to false and open the dialog; re-check `hasPlatformCredentials()` on window focus.
- [x] **[L]** The status fan-out has no upper bound. `getGenerationStatuses` runs `Promise.all` over every id sent (`actions.ts:63`), and `parseRequestIds` only checks that the array is non-empty. A crafted server-action call can trigger thousands of platform requests. Dedupe, cap at 50 ids per call, and limit concurrency to ~8.
- [ ] **[L]** The API key is never verified on save. `savePlatformCredentials` only checks the character set (`credentials.ts:52-58`), so a wrong key shows "connected" until the first generation 401s. After saving, make one cheap authenticated request (for example `GET /requests/<random uuid>/status`: 401/403 = bad key, 404 = key accepted; confirm the platform really answers that way first) and show the result in the dialog.

### Product gaps (UX)
- [x] **[M]** Tell the user when a long run finishes. *(Done: tab title count, "Done"/"Failed" title and opt-in desktop notification when the tab is hidden; the optional chime was left out.)* A video can take several minutes, and with the tab in the background timers are throttled and nothing signals completion. Put the count in `document.title` (`(2) generating…`), flip it to `Done` on completion, and offer an opt-in desktop notification (`Notification.requestPermission`) plus an optional soft chime.
- [x] **[M]** Move a generation into a project later. *(Done in the tile menu and the multi-select bar; not added to the detail modal.)* `projectId` is set only at submit time (`use-runs.ts:91`) and no code ever changes it, so anything generated from Home or "All" can't be filed. Add "Move to project" to the tile menu and the detail modal.
- [x] **[M]** Reference intake is click-only outside the library dialog. There is no drag-and-drop onto the dock and no paste-from-clipboard (`onPaste`/`onDrop` appear only in `asset-library.tsx`). Accept pasted images (Cmd/Ctrl+V in the prompt box) and files dropped on the dock, upload them, and attach with the right role. Also say why a file is refused: iPhone HEIC, MOV and MP3 are rejected today with a generic "Use JPEG, PNG, WebP, GIF, MP4, or WAV".
- [x] **[M]** Multi-select in the feed: select many tiles for bulk Download (zip), Delete and Move to project. All actions are per tile today, so clearing out 30 failed runs is 30 clicks (and Delete has no confirmation or undo, `onDelete={(item) => runs.remove(item.runId)}`; add a 5-second Undo toast).
- [x] **[L]** Show cost/time expectations before submit. *(Done as a static Generate tooltip per surface; no per-model hints, the platform returns no cost, and there is no batch to confirm.)* If the platform returns credits or an estimate, display it on the Generate button; otherwise add a static per-model hint (`~30 s`, `~3 min`) to the catalog entries and a confirm for batches above 1.

### Server hygiene and security
- [x] **[M]** The platform client logs everything. `send()` writes `console.info("[platform] request", { method, url, body })` and the response body (`generation/platform.ts:63-80`), and polling calls it for every in-flight run every 4 seconds. Prompts and reference URLs end up in server logs and the log volume grows with each open generation. Log only submit, cancel and errors, never prompt bodies, and put the rest behind `HF_DEBUG=1`.
- [x] **[L]** Add response headers in `next.config.ts` via `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP that allows `img-src`/`media-src` `https:` and `blob:` (results and references come from the platform's CDN) with `frame-ancestors 'none'`. The key is an httpOnly cookie, so clickjacking the key dialog is the realistic risk.
- [x] **[L]** Uploads have no client-side size check *(Done with guessed limits in `MAX_UPLOAD_BYTES`: 25 MB image, 200 MB video, 50 MB audio; replace with the platform's real limits.)* (`generation/upload.ts`). The browser PUTs straight to signed storage, so an oversized file wastes a signed URL and fails late with "Reference upload failed (413)". Validate `file.size` per kind (set limits from the platform docs) before requesting a ticket, and show the limit in the error.
- [x] **[L]** `proxy.ts` mints *(Done: both files removed.)* a `hf_device` cookie (400 days) for every new visitor, but nothing reads it (grep: only `proxy.ts` and `generation/device.ts` mention it). Remove both files, or document what the device id is for. It also removes a middleware hop from every page request.

### Docs, tests, repo
- [x] **[M]** `README.md` is the unedited shadcn/Next template text. Nothing says what this project is, that `HF_API_BASE_URL` must be set, where to get a key, or how models are added; the old `.env.example` (mentioned in the commit log) is gone. Commit `.env.example` (`HF_API_BASE_URL=`), document `pnpm dev|build|typecheck|lint`, the key flow (httpOnly cookie, per browser), and where data lives (IndexedDB + localStorage, nothing server-side).
- [x] **[M]** There are no tests, and the code that most needs them is pure: 28 hand-written model files with custom `toPlatform` maps (Kling 3 has six variants, Soul, Seedance). Add Vitest and one table test that, for every model in `MODELS`, builds a plane from its default settings and asserts `toPlatform` returns a path + JSON body without throwing (catches a bad model file immediately), plus unit tests for `poll.ts` (transient error vs terminal), `parseUploadTicket`, `aspectFromSettings` and `justified-engine` row math.
- [x] **[L]** Add a GitHub Actions workflow: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build`. `next build` is the check that catches server/client boundary mistakes the template warns about (touching `window` during SSR).
- [ ] **[L]** AGENTS.md says every `/presets/placeholder-*.svg` and mock template must be replaced with real media and the placeholders deleted. `public/presets/studio-1..4.svg` and the starter `TEMPLATES` in `template-picker.tsx` are still the scaffold's (`HERO_FALLBACKS` in `layouts/studio.tsx` too). Either generate real example outputs with the app and use those, or remove the Explore tab until there is real content.
- [x] **[L]** Page metadata is generic (`title: "Studio"`). *(Done: title template, Open Graph, description; the product name is still "Studio" and the theme color already matched the token. A custom favicon needs real brand art.)* Set a product name/description, Open Graph tags and a real favicon, and keep `viewport.themeColor` in sync with the actual background token.

## Ideas

### Generation workflow
- [x] **[H]** Variations: "More like this" on any tile, re-run with the same prompt and settings, new seed. *(Done: tile menu "More like this"; the platform picks a new seed, the catalog has no seed setting.)*
- [x] **[M]** Queue: accept new prompts while others run and show queue position per tile. *(Done: client-side queue, 2 run at once, "Queued · n" tiles; the queue is lost on reload and the dock shows "Cancel all" when there is nothing new to send.)*
- [x] **[L]** Remember settings per model, not per surface, so switching back restores them. *(Already true: `useSettings` is keyed by model.)*

### Prompt box and input
- [x] **[L]** Auto-grow textarea with max height and internal scroll. *(Done with `field-sizing: content`; Chromium only, other browsers keep the fixed height and scroll.)*
- [x] **[L]** Spellcheck toggle and language hint. *(Spellcheck toggle done; the language hint was left out, the field follows the page language.)*

### Models and settings
- [x] **[M]** Model info popover: what it is best at, max duration, supported inputs, relative speed. *(Done as a one-line description under each model in the picker: inputs, longest clip, rough speed, all derived from the catalog. "Best at" is not in the catalog, so it is omitted.)*
- [ ] **[M]** Disable (grey out with reason) settings combos a model rejects, instead of failing at the platform.
- [x] **[L]** Aspect ratio picker with visual frames and a "match reference" option. *(Frames done; "match reference" left out, since no model declares such a value.)*
- [x] **[L]** "Reset to defaults" button in the settings dialog.

### Assets and references
- [x] **[M]** Dedupe uploads by content hash so re-attaching the same file reuses the URL. *(Done: SHA-256 stored on the upload record. A reused URL is assumed to still be valid; the platform's URL lifetime is unknown.)*
- [x] **[M]** Upload progress bar and cancel for large videos *(Done with XHR: percent in the library card and the dock, with Cancel.)* (XHR or `fetch` with stream; currently a spinner *(check)*).
- [ ] **[L]** Auto-convert HEIC to JPEG in the browser before upload instead of refusing.
- [ ] **[L]** Auto-downscale oversized images to the model's max input size before upload.
- [x] **[L]** EXIF-free guarantee note: strip metadata from uploaded references (privacy). *(Done for JPEG and PNG; WebP, GIF, MP4 and WAV are uploaded as they are. A JPEG rotated by EXIF is re-encoded so it keeps its orientation.)*

### Gallery and organization
- [x] **[H]** Favorites/stars with a "Starred" filter, stored in the run record.
- [x] **[M]** Filter chips: image / video / failed / by model / by project. *(Done: All/Images/Videos/Starred/Failed chips plus a model select. By-project is the sidebar's project view.)*
- [x] **[M]** Sort options: newest, oldest, model, favorites first.
- [x] **[M]** Group-by-day headings with sticky date labels in the feed. *(Day headings show in date order; they are off when sorting by model or starred.)*
- [x] **[M]** Empty-state per filter *(Done: filtered-out feeds say what is missing. The empty-state art is still the scaffold's; see Issues Needing Review.)* ("No failed runs" vs "No history yet") with a relevant action.
- [x] **[L]** Detail modal shows all settings used, seed, model, duration, and timing, with "Copy as JSON". *(Done except seed: the catalog has no seed setting. "Took" is shown for runs finished after this change.)*

### Onboarding and first run
- [ ] **[H]** Key dialog explains where to get a key and links there; show "connected" state with masked key tail.
- [ ] **[L]** One-time tip toasts for hidden features (paste image, Up-arrow recall), each shown once.
- [ ] **[L]** Keyboard shortcut cheat sheet on `?`.
- [ ] **[L]** Command palette (`Cmd/Ctrl+K`): switch model, project, surface, open settings, search history.

### Cost and usage awareness
- [ ] **[L]** Usage dashboard: runs per model/day, success rate, median time-to-complete (local data).

### Resilience, safety and privacy
- [ ] **[H]** Error boundary around the gallery and detail modal so one bad record doesn't blank the app.
- [ ] **[M]** Validate/migrate IndexedDB records on load (schema version + zod); skip and report corrupt rows rather than crash. Use one `readJson(schema)` helper for every IndexedDB/localStorage read.
- [ ] **[M]** Offline banner: disable Generate and say "You're offline" instead of failing with a fetch error.
- [ ] **[M]** Map platform error codes to friendly messages (content filter, insufficient credits, rate limit, model unavailable) with a next step each. Centralize in `generation/errors.ts`.
- [ ] **[M]** Storage quota warning (`navigator.storage.estimate`) with "Clear cache" and Export.
- [ ] **[M]** Privacy panel: states exactly what is stored where (cookie, IndexedDB, localStorage) with a "Wipe everything" button.
- [ ] **[M]** "Wipe everything" also clears the httpOnly cookie via a server action.
- [ ] **[L]** "Sign out" in the Key dialog that clears the cookie server side (confirm it exists and works).

### Performance
- [ ] **[M]** Use `loading="lazy"` plus a low-res poster/thumbnail for videos; only attach `src` when near the viewport (keeps AGENTS.md rule: never unmount *loaded* media).
- [ ] **[M]** Cap simultaneously playing videos (pause others on hover-play) to save CPU/battery.
- [ ] **[M]** Generate and cache thumbnails in IndexedDB so reopening is instant offline.
- [ ] **[M]** Back off polling: 4 s for the first minute, then 8-15 s for long video jobs; pause when the tab is hidden and resume on `visibilitychange`.
- [ ] **[L]** Debounce history writes (batch within 250 ms) instead of rewriting the whole array each tick.
- [ ] **[L]** Move IndexedDB reads off first paint with `Suspense` skeletons to avoid layout shift.
- [ ] **[L]** Analyze the bundle (`@next/bundle-analyzer`) once; lazy-load the settings dialog, detail modal, asset library.
- [ ] **[L]** Prefetch the next page of history on idle.
- [ ] **[L]** Turn on `reactCompiler` in Next 16 and measure re-renders in the gallery.

### Visual design polish
- [ ] **[M]** Progress feel for running tiles: elapsed timer plus per-model typical time ("~2 min").
- [ ] **[L]** Custom scrollbars matching the dark tokens.

### Code quality, testing and dev experience
- [ ] **[M]** Split `layouts/studio.tsx` (it owns prompt, media, generate, cancel, key state); extract hooks (`useDock`, `useKeyStatus`) to make it testable.
- [ ] **[M]** One typed `Result<T, E>` for server actions so the client never inspects thrown errors.
- [ ] **[M]** Add `error.tsx` and `not-found.tsx` to `app/` with on-brand copy.
- [ ] **[M]** Add `loading.tsx` / suspense skeleton for the first paint.
- [ ] **[M]** Add structured server logging with request ids (no prompts), so a failed run's tile can show "Support ID".
- [ ] **[M]** Playwright smoke test for the AGENTS.md verification scenarios (missing key, cancel, empty history).
- [ ] **[L]** Enforce "no `window` at module scope" with an ESLint rule/`no-restricted-globals` override for server-reachable files.
- [ ] **[L]** Enable `noUncheckedIndexedAccess` in tsconfig and fix fallout *(strict TS stays strict)*.
- [ ] **[L]** Replace magic numbers (400 records, 15 min, 4 s) with one `lib/studio/limits.ts`.
- [ ] **[L]** Replace the typed event bus idea with zustand selectors only; audit for prop drilling in `prompt-box.tsx`.
- [ ] **[L]** Add `scripts/check-models.mjs` run in CI: each model file has name, surface, defaults, and `toPlatform`.
- [ ] **[L]** Generate a models table in the README from the catalog so docs never drift.
- [ ] **[L]** `CONTRIBUTING.md` / `docs/adding-a-model.md` with the exact shadcn command and the sync script behavior.
- [ ] **[L]** Storybook-free visual check: a `/dev/components` route (dev only) rendering tiles in every state (loading, failed, completed, filtered).
- [ ] **[L]** Pre-commit hook (`lint-staged` + typecheck) so findings like unused deps don't recur.
- [ ] **[L]** Dependabot/Renovate config; the 16.4.0 -> 16.4.3 security bump in the log shows this is manual today.
- [ ] **[L]** Add `pnpm dlx knip` to CI to catch dead files/exports (would have caught the stores/plane items).
- [ ] **[L]** Lighthouse/axe run in CI against the built app.

---

# Skipped for now

## Verified findings

### Product gaps (UX)
- [ ] **[H]** No way to retry, remix or vary a generation. Grep finds no Retry/Regenerate/Reuse action anywhere; a failed tile just says "Generation unavailable" (`components/studio/generation-card.tsx`), and the tile menu offers Download, Copy prompt, Share, Delete (`gallery-tile.tsx:171-175`). Add **Retry** (resubmit the same plane with a new key) on failed tiles and **Reuse settings** (load prompt, model, settings and references into the dock) on every tile; `RunRecord` already stores `prompt`, `modelId` and `settings`.
- [ ] **[H]** Chain image to video in one click. The core workflow is generate a still, then animate it, but a finished image can only reach the video dock through the asset library. Add "Animate" on image tiles (switch to a video surface/model that takes a start frame and attach the image as `start`) and "Extend" on video tiles for models that support it (Seedance 2.5 Edit/Extend is already wired). `mergeMedia`/`inputRoles` do the role handling.
- [ ] **[M]** History silently caps at 400 runs (`MAX_RECORDS`, `history.ts:27`), dropping the oldest. Tell the user when it happens and add Export / Import history (JSON) in a menu so a browser reset isn't a data loss. If the platform's result URLs expire, also offer "Download all" for completed runs.
- [ ] **[L]** Model picker for 28 models: add search and a "Recent" group at the top (`useActive` already persists the selection), since Kling alone has five entries.
- [ ] **[L]** Prompt recall: keep the last ~30 distinct prompts per surface and open them with Up arrow in the empty prompt box, so reruns don't depend on finding the right tile and using Copy prompt.

### Dead code and dependencies
- [ ] **[M]** Persisted prompt and media stores exist but nothing uses them. `generation/stores/prompt.ts`, `generation/stores/media.ts` and `generation/plane.ts` (`assemblePlane`) have no importers; `StudioTemplate` keeps `prompt` and `media` in plain `useState` (`layouts/studio.tsx:273-274`). Result: refreshing the page loses an unsent prompt and attached references. Either wire the persisted per-surface stores into the dock (and keep blob URLs out, as `media.ts` already does) or delete the three files.
- [ ] **[M]** `batch` is half-built: `MAX_BATCH` and `batch`/`setBatch` live in `stores/active.ts`, but no component or submit path reads them (grep), and only Soul has its own `batchSize` setting. Either add a "Variations x1 / x2 / x4" control that submits N planes with distinct idempotency keys and shows N placeholder tiles, or remove the field.
- [ ] **[L]** Unused dependencies and files: `radix-ui` (no component imports it; the UI is Base UI), `next-themes` and `components/theme-provider.tsx` (AGENTS.md says dark only, no toggle), the empty `components/.gitkeep`, `hooks/.gitkeep`, `lib/.gitkeep`. Remove them and run `pnpm install` to shrink the 595 MB `node_modules` a little and the dependency surface.
- [ ] **[L]** `lib/utils.ts` re-exports `cn` from an npm package literally named `cn` (`export { cn } from "cn"`, and `components/ui/*` import it directly). The usual shadcn helper is a six-line `clsx` + `tailwind-merge` function. Confirm what `cn@0.4.0` is and who maintains it, or replace it with the local helper so a third-party package isn't on the render path of every component.

## Ideas

### Generation workflow
- [ ] **[H]** Seed control and "lock seed" toggle for models that expose one, so the user can A/B a single setting.
- [ ] **[M]** Compare mode: pin two tiles side by side (slider wipe for images, synced playback for videos).
- [ ] **[M]** Run the same prompt on N models at once ("Model shootout") and show results in one grouped row.
- [ ] **[M]** Prompt templates with `{variables}` (e.g. `{subject} in {style}`), fill-in form, run a grid of combinations.
- [ ] **[M]** Negative prompt field for models that support it, hidden for others.
- [ ] **[M]** "Enhance prompt" button that rewrites a short prompt per model's best practice (server action, key stays server side).
- [ ] **[L]** Auto-fill last frame: "Use last frame as next start frame" for video continuation chains.
- [ ] **[L]** Batch CSV import: one prompt per row, run through a queue with a concurrency cap.
- [ ] **[L]** Per-model "recommended settings" preset chips (Draft / Balanced / Final) mapped onto the settings dialog.
- [ ] **[L]** Scheduled run: "Run again every N minutes" for daily-content use. *(skip unless asked)*

### Prompt box and input
- [ ] **[M]** Prompt history dropdown with search (extends the Up-arrow recall item in section 2).
- [ ] **[M]** Saved prompts / snippets library ("my style suffix") inserted with `/` command.
- [ ] **[M]** `Cmd/Ctrl+Enter` to generate, `Esc` to cancel focus, shown as hint on the button.
- [ ] **[M]** Character counter and per-model prompt length limit warning.
- [ ] **[L]** Voice dictation for the prompt via Web Speech API (feature-detect).
- [ ] **[L]** Image-to-prompt: describe an attached reference into the prompt box (server action).
- [ ] **[L]** Slash commands: `/image`, `/video`, `/model kling`, `/project name` to drive the dock from the keyboard.

### Models and settings
- [ ] **[M]** Model favorites pinned to the top of the picker.
- [ ] **[M]** Detect surface from references automatically (video attached as input -> offer video models that accept it).
- [ ] **[L]** Duration slider with live cost/time hint per model.
- [ ] **[L]** Model changelog/"new" badge when `registry.json` adds an entry since last visit.
- [ ] **[L]** "Cheapest model that supports these inputs" suggestion chip.

### Assets and references
- [ ] **[H]** "Save as reference" on any finished tile adds it to the asset library without a re-upload (result URL is already public).
- [ ] **[M]** Asset library folders or tags (characters, products, styles).
- [ ] **[M]** Asset search and rename.
- [ ] **[L]** Crop and rotate reference images before upload.
- [ ] **[L]** Reference reorder by drag, with role badges (start, end, style, character).
- [ ] **[L]** Mark an asset as "Character" and auto-attach it to prompts tagged `@name`.
- [ ] **[L]** Expire notice: if signed/public asset URLs expire, show "Re-upload needed" instead of failing at submit *(check platform TTL)*.

### Gallery and organization
- [ ] **[H]** Search history by prompt text, model, and date.
- [ ] **[M]** Tags (free text) on runs with tag filter.
- [ ] **[M]** Keyboard navigation in the gallery: arrow keys move focus, Enter opens, `f` favorites, `Delete` removes (with undo).
- [ ] **[M]** Detail modal prev/next arrows and swipe on touch.
- [ ] **[L]** "Open in new tab" and "Copy link" for result media.
- [ ] **[L]** Density control remembered per surface, plus a "Compact list" view with prompt text.
- [ ] **[L]** Project cover image picker (defaults to latest completed run).
- [ ] **[L]** Project descriptions and per-project default model/settings.
- [ ] **[L]** Duplicate project (copy run references into a new project).
- [ ] **[L]** Archive projects instead of only delete.
- [ ] **[L]** Comments/notes on a run (local) for review workflows.
- [ ] **[L]** Approval status on runs (Draft / Approved / Rejected) with filter.
- [ ] **[L]** A/B rating (thumbs up/down) on results, feeding a local "what works" prompt stats view.

### Editing and post-processing
- [ ] **[H]** Upscale action on image tiles (platform has upscale endpoints in the Higgsfield toolset; wire as a catalog model or action).
- [ ] **[M]** Upscale action on video tiles.
- [ ] **[M]** Background removal action on image tiles.
- [ ] **[M]** Outpaint / reframe to another aspect ratio from the tile menu (9:16 for Shorts, 1:1 for feed).
- [ ] **[M]** Inpaint brush: paint a mask on an image tile, then prompt the change.
- [ ] **[M]** Trim video in the detail modal (in/out handles) and save the cut as a new asset client-side.
- [ ] **[L]** Extract a frame from a video at the scrubber position and attach it as a reference or save as PNG.
- [ ] **[L]** Convert video to GIF or WebM in the browser for sharing.
- [ ] **[L]** Stitch several finished clips into one reel (client-side, `mediabunny` or `ffmpeg.wasm` only if asked).

### Video viewer and tools
- [ ] **[H]** Custom player: scrub, speed (0.25-2x), frame step, loop, mute default, keyboard (`space`, `j/l`, `,` `.`).
- [ ] **[M]** Storyboard mode: ordered list of shots (prompt + start frame), run all, auto-chain last frame to next start.
- [ ] **[M]** Audio toggle badge: show which results have sound and let the user mute globally.
- [ ] **[M]** Show duration and resolution as a badge on every video tile.
- [ ] **[M]** Picture-in-picture button in the detail modal.
- [ ] **[L]** Loop-seam preview: play last 1 s into first 1 s to judge loopability.
- [ ] **[L]** Hover-scrub preview on video tiles (mouse X maps to time).
- [ ] **[L]** Poster-frame picker: choose which frame is the tile thumbnail.
- [ ] **[L]** Playback fallback message when the browser can't decode the codec, with Download.
- [ ] **[L]** Remember mute/volume across sessions.
- [ ] **[L]** Burn-in watermark/caption export (canvas + MediaRecorder) *(only if product asks)*.
- [ ] **[L]** Background music attach for silent models (client-side mux) *(heavy; skip unless asked)*.

### Image viewer
- [ ] **[M]** Zoom/pan with minimap in the detail modal; 100% pixel view.
- [ ] **[M]** Show dimensions and file size; "Download original" vs "Download WebP".
- [ ] **[M]** Color palette extraction (5 swatches) per image, click to copy hex and insert into the prompt.
- [ ] **[M]** "Describe this image" (caption) to reuse as a prompt (server action).
- [ ] **[L]** Before/after toggle against the reference used.
- [ ] **[L]** Grid overlay (thirds, safe areas) toggle in the viewer.
- [ ] **[L]** Pinch-zoom in the detail modal for images.
- [ ] **[L]** Blur-up placeholder using a tiny base64 thumb stored with the run.
- [ ] **[L]** Dominant-color tile background while loading, to reduce flash.

### Sharing, export and sync
- [ ] **[M]** Zip export of a project (media + a `prompts.csv`).
- [ ] **[M]** Copy image to clipboard from the tile menu.
- [ ] **[M]** Share page: read-only link for a single result *(needs server storage; only if product wants it)*.
- [ ] **[M]** Optional cloud sync adapter behind the existing `useRuns` interface (AGENTS.md allows replacing history/projects modules).
- [ ] **[M]** Multi-device: QR code that opens the app with an export bundle to import.
- [ ] **[M]** Shareable "recipe link" (prompt/model/settings in the URL hash, no media) that preloads the dock.
- [ ] **[L]** Download with a meaningful filename (`{slug-of-prompt}-{model}-{id}.png`) rather than a hash.
- [ ] **[L]** Native Web Share on mobile for the Share action.
- [ ] **[L]** Export a "recipe" JSON (prompt + model + settings + reference URLs) and import it to reproduce.
- [ ] **[L]** Export/import the *entire* app state (settings, projects, history index, prompts) in one file.
- [ ] **[L]** Contact-sheet export: one PNG grid of a project's images.
- [ ] **[L]** Print/contact-sheet layout CSS (`@media print`) for a project.
- [ ] **[L]** Embed metadata (prompt, model) in downloaded PNG/MP4 where cheap.
- [ ] **[L]** URL state for surface, model, and project so back/forward and bookmarks work.
- [ ] **[L]** Deep link to a single generation (`?run=id`) opening the detail modal.

### Onboarding and first run
- [ ] **[H]** First-run checklist card: add key -> first image -> first video, ticks off as done, dismissible.
- [ ] **[M]** Example prompts per surface as clickable chips in the empty state (real, on-brand, per AGENTS.md).
- [ ] **[M]** Guided "first video from your image" tour using a bundled sample image.
- [ ] **[L]** Sample project pre-seeded on first load that the user can delete.
- [ ] **[L]** "What's new" dialog driven by a version constant.

### Cost and usage awareness
- [ ] **[H]** Credits/balance indicator in the sidebar if the platform exposes it *(check)*; warn before a run that exceeds it.
- [ ] **[M]** Session spend counter ("14 generations, ~320 credits today") from per-model cost metadata.
- [ ] **[M]** Confirm dialog for expensive combos (long 4K video, batch >2) with "don't ask again".
- [ ] **[M]** Per-project budget cap that disables Generate when hit.
- [ ] **[L]** Mark runs as free vs paid in the detail view.
- [ ] **[L]** Failed-run refund note ("not charged") when the platform says so *(check)*.

### Resilience, safety and privacy
- [ ] **[M]** Content-filter tile shows which input tripped it when known, and an "Edit prompt and retry" button.
- [ ] **[M]** Warn before attaching images of people for models with likeness restrictions *(check)*.
- [ ] **[L]** Rate-limit Generate clicks client-side and show the server's `Retry-After`.
- [ ] **[L]** Blur-NSFW-by-default toggle for results flagged by the platform *(check)*.
- [ ] **[L]** Idle lock: hide the gallery behind a click after N minutes (shared screens).
- [ ] **[L]** Panic key / "Hide previews" toggle for screen sharing.
- [ ] **[L]** Subresource integrity / pinned CDN hosts list in CSP for media origins only.

### Accessibility and i18n
- [ ] **[H]** Announce generation state changes to screen readers with an `aria-live="polite"` region ("Image ready", "Failed: content filter").
- [ ] **[M]** Visible focus rings on every tile and menu item; verify contrast of dim text on the dark tokens (WCAG AA).
- [ ] **[M]** Alt text for results = the prompt (truncated); `aria-label` on icon-only buttons (audit).
- [ ] **[M]** Focus trap and return-focus on all dialogs; confirm Base UI defaults are not overridden.
- [ ] **[L]** Respect `prefers-reduced-motion` for video autoplay (show poster + play button), not just animations.
- [ ] **[L]** Touch targets >= 44 px on narrow viewports for tile menu and dock controls.
- [ ] **[L]** Tooltips with shortcut hints on all icon buttons.
- [ ] **[L]** Extract user-facing strings to one module to make translation possible later.
- [ ] **[L]** Format dates and durations with `Intl` using the browser locale.

### Mobile and PWA
- [ ] **[M]** PWA manifest + icons so it installs; offline shell with cached history thumbnails.
- [ ] **[M]** Bottom-sheet model/settings pickers on narrow viewports (no second app shell, per AGENTS.md).
- [ ] **[M]** Camera capture as a reference source via `<input capture>`.
- [ ] **[M]** Web Share Target so photos shared from the phone open as references.
- [ ] **[L]** Safe-area insets (`env(safe-area-inset-bottom)`) for the dock on iOS.
- [ ] **[L]** Long-press tile menu on touch instead of hover-only actions.
- [ ] **[L]** Haptic tick (`navigator.vibrate`) on completion where supported.

### Visual design polish
- [ ] **[M]** Skeleton tiles sized to the requested aspect ratio so the layout doesn't jump on completion.
- [ ] **[M]** Completion animation (subtle scale/fade), disabled under reduced motion.
- [ ] **[L]** Distinct, readable failed-tile design with the reason inline and Retry/Delete.
- [ ] **[L]** Consistent model badges/icons per vendor in picker and tiles.
- [ ] **[L]** Sticky dock that collapses to a single line while scrolling the feed.
- [ ] **[L]** Toast stack with Undo, dedupe, and a max of 3 visible.

### Product expansion
- [ ] **[M]** Audio surface (TTS/music) if the platform catalog adds it; the Surface type already splits image/video *(check)*.
- [ ] **[M]** Lip-sync / talking-head flow: image + audio -> video with a dedicated mini-wizard.
- [ ] **[M]** Character library: named reusable characters with reference sets, `@name` in prompts.
- [ ] **[M]** Style library: saved style references + prompt suffix, applied in one click.
- [ ] **[M]** Brand kit (logo, colors, fonts) used by template presets.
- [ ] **[M]** Template gallery of real presets (AGENTS.md DoD): each loads prompt, model, and settings.
- [ ] **[L]** Mood-board: drag finished tiles onto a free-form canvas inside a project.
- [ ] **[L]** Webhook/notify URL when a run finishes *(needs server; only if asked)*.
- [ ] **[L]** Public read-only API route to submit prompts (server-key mode for teams) *(security review first)*.
- [ ] **[L]** Team mode: shared key held server-side instead of per-browser cookie *(changes AGENTS.md boundary; ask first)*.

---

# Issues Needing Review

- **API key verification on save** (Planned > Generation reliability, [L]). Not done. The plan probes `GET /requests/<random uuid>/status` and treats 401/403 as "bad key", but I can't confirm the platform answers an unknown request id with 404 rather than 403 (no key or `HF_API_BASE_URL` here). If it returns 403 for unknown ids, the check would block every valid key from being saved. Decision needed: confirm the platform's behavior (or name a cheap authenticated endpoint) and I'll wire it into `savePlatformCredentials`.

- **Replace scaffold placeholders with real media** (Planned > Docs, tests, repo, [L]). Not done. `public/presets/studio-1..4.svg`, the starter `TEMPLATES` in `components/studio/template-picker.tsx` and `HERO_FALLBACKS` in `layouts/studio.tsx` are still the scaffold's. Replacing them needs real, on-brand outputs: generating them spends Higgsfield credits and needs your brand direction. Decision needed: (a) tell me the product/brand and approve spending credits on example media, (b) supply the media, or (c) remove the Explore tab and hero fallbacks until there is content.

- **Disable settings combinations a model rejects** (Planned > Models and settings, [M]). Not done. Catalog entries only describe each setting on its own (`enum`/`range`/`boolean`); nothing says which combinations the platform refuses (for example resolution with duration), so there is nothing to grey out. Decision needed: list the known-invalid combinations per model (or point me at the platform docs) and I will add a `constraints` field to `ModelEntry` and disable options in the picker and dialog.

- **Auto-convert HEIC to JPEG before upload** (Planned > Assets and references, [L]). Not done. Browsers other than Safari cannot decode HEIC, so this needs a WASM decoder dependency (for example `heic2any`/`libheif-js`, roughly 1 MB+). Decision needed: approve adding that dependency (lazy-loaded), or keep the current clear refusal message ("Export the photo as JPEG or PNG first").
- **Auto-downscale oversized images to the model's max input size** (Planned > Assets and references, [L]). Not done. No catalog entry declares a maximum input resolution or file size, so there is no target to downscale to. Decision needed: the per-model (or global) max edge/size, and whether to add an `inputMaxEdge` field to `ModelEntry`.
