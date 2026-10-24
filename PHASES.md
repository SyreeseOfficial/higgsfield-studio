# Work Phases

Source of truth for details: [FINDINGS.md](FINDINGS.md). Do one phase at a time. When an item is done, tick it in **both** files. If an item needs you, move it to *Waiting on your decision* in FINDINGS.md and tag it ⛔ here.

**Rules**
- Tests must be free. Nothing calls the real Higgsfield API or spends credits. Use unit tests, recorded responses or the fake server (Phase 13).
- Don't hand-edit `generation/catalog/models.generated.ts`. Keep strict TypeScript. `pnpm typecheck` and `pnpm build` pass at the end of every phase.

**Status:** ☐ not started · ◐ in progress · ☑ done

| # | Phase | Items | Status |
|---|---|---|---|
| 1 | Safe submits (no double charges, no freezes) | 8 | ☑ |
| 2 | Run lifecycle & recovery | 10 | ☑ |
| 3 | History & data safety | 9 | ☑ |
| 4 | Security & downloads | 5 | ☑ |
| 5 | Result viewer | 9 | ☑ |
| 6 | Tiles & status look | 10 | ☐ |
| 7 | Prompt box & references | 9 | ☐ |
| 8 | Gallery, cost & usage | 8 | ☐ |
| 9 | First-run & visual polish | 7 | ☐ |
| 10 | Speed: rendering | 7 | ☐ |
| 11 | Speed: loading & bundle | 7 | ☐ |
| 12 | Tests: pure logic | 9 | ☐ |
| 13 | Tests: infrastructure & fake server | 7 | ☐ |
| 14 | Code quality & lint | 10 | ☐ |
| 15 | Cleanup & small ops | 14 | ☐ |
| 16 | Docs | 8 | ☐ |
| ⛔ | Blocked on you | 8 | see bottom |

---

## Phase 1 — Safe submits
Goal: one click = at most one paid job; one slow call never freezes the app.
- [x] Add a timeout to calls to Higgsfield
- [x] Unique ID on every generation (old-browser safe) / stop accidental double charges
- [x] Treat "timeout" and "conflict" as "maybe it worked"
- [x] Remember several pending retries
- [x] Limit running jobs across all browser tabs
- [x] Friendly "app isn't set up" screen
- [x] Handle "too many jobs" gracefully
- [x] Don't throw away good results when one status group fails

## Phase 2 — Run lifecycle & recovery
- [x] Dev-mode glitch: dropped status checks on hot reload
- [x] Fix "Canceling…" stuck
- [x] Wait a moment before "no media produced"
- [x] Warn when a reference link has expired
- [x] Stop queued/running tile flicker
- [x] "Retrying…" and auto-retry once on temporary errors
- [x] Pause queue automatically on "slow down", with countdown
- [x] Keep the queue after reload
- [x] "Your runs were recovered" notice
- [x] Error messages: check the real error code before keyword guessing

## Phase 3 — History & data safety
- [x] Never drop starred items past 400 runs
- [x] Save copies of results in case links expire
- [x] Fix IndexedDB memory leak
- [x] "Wipe everything" clears all data
- [x] Stable IDs for library items
- [x] Versioned saved data, upgrade path
- [x] Warn when browser storage is full
- [x] Label Usage numbers ("last 400 runs")
- [x] Keep unsent prompts and attached files across reload

## Phase 4 — Security & downloads
- [x] Encrypt the API key in the cookie
- [x] Tighten CSP / browser security rules
- [x] Strip hidden data from WebP, GIF, MP4 before upload
- [x] Fix "Download all" (memory, double downloads)
- [x] Fix zip dates (1980) and warn before >4 GB zips

## Phase 5 — Result viewer
- [x] Update the detail window live when the run finishes
- [x] Better video player (scrub, speed, frame step, loop, keys)
- [x] Full details panel + Copy as JSON / curl
- [x] Reference vs result side by side
- [x] Fullscreen button and `F`
- [x] Copy button for each field
- [x] Zoom and pan with minimap
- [x] Support ID with copy button
- [x] Copy image to clipboard

## Phase 6 — Tiles & status look
- [ ] Video tiles: still frame until hover (no full player each)
- [ ] Sound badge; global mute
- [ ] Duration/resolution badge on video tiles
- [ ] Skeleton tiles in the right shape
- [ ] Consistent status chips
- [ ] Clearer failed tiles (reason, Retry/Delete)
- [ ] Smooth reflow when tiles are added
- [ ] Gentle completion animation (respects reduced motion)
- [ ] Consistent model badges per company
- [ ] Glow behind running tiles

## Phase 7 — Prompt box & references
- [ ] Aspect ratio previews (exact crop)
- [ ] "Save as reference" on finished tiles (no re-upload)
- [ ] "Use as reference" on tiles and in viewer
- [ ] Crop and rotate before upload
- [ ] Size/dimensions/length on each reference card
- [ ] "Already uploaded, reusing" message
- [ ] Drag a thumbnail to reorder or remove
- [ ] Better drop zone when dragging files over the window
- [ ] ⛔ Auto-convert HEIC → see Blocked

## Phase 8 — Gallery, cost & usage
- [ ] Count badge next to each project
- [ ] Drag a tile onto a project
- [ ] Credit balance in sidebar + pre-run warning (check first that the balance call is free)
- [ ] Activity timeline per day and model
- [ ] Session spend counter
- [ ] Weekly summary
- [ ] "Not charged" note on failed runs when known
- [ ] "Recent errors" panel in Settings (last 20, reason, support ID, retry)

## Phase 9 — First-run & visual polish
- [ ] Help text under each setting
- [ ] Help link in the shortcuts window
- [ ] Toast stack with Undo, max 3
- [ ] One icon style
- [ ] One set of text sizes
- [ ] Fade in the first row only
- [ ] ⛔ "Check key" button → see Blocked (needs the API-key check answer)

## Phase 10 — Speed: rendering
- [ ] Smoother layout on resize
- [ ] Skip rendering off-screen tiles (keep loaded media)
- [ ] Don't recompute lists every poll tick
- [ ] Only update the changed part of the gallery
- [ ] Only re-render the tile that changed
- [ ] Hard cap on simultaneous videos
- [ ] Skip off-screen parts of the detail window

## Phase 11 — Speed: loading & bundle
- [ ] Load rarely used windows only when opened
- [ ] Preload images only near the screen
- [ ] Load first-row images first
- [ ] Heavy file work (fingerprinting, stripping) off the main thread
- [ ] Analyze the bundle once, lazy-load more windows
- [ ] Cache static files offline
- [ ] Split the two biggest files (886 and 816 lines)

## Phase 12 — Tests: pure logic (free)
- [ ] Test the error messages against recorded real responses
- [ ] Stress-test error messages with real samples
- [ ] Random-input tests for settings parsing
- [ ] Test merging of history and skipping bad rows
- [ ] Test history loading (bad row, order, cap)
- [ ] Test "failed runs stay visible"
- [ ] Test idempotency key reuse
- [ ] Test metadata stripping with broken files
- [ ] Tests for model files (icons, unique order, roles)

## Phase 13 — Tests: infrastructure & fake server (free)
- [ ] Fake Higgsfield server for tests and demos without a key
- [ ] Mock mode (`HF_MOCK=1`)
- [ ] Recorded-response tests for the Higgsfield connection
- [ ] Stress-test polling and run logic
- [ ] Test the run controller (queue, retry, cancel, two tabs)
- [ ] Tests for screens (prompt box, key dialog, gallery tile)
- [ ] Single `pnpm check` command

## Phase 14 — Code quality & lint
- [ ] Stricter TypeScript and lint rules
- [ ] Catch typo'd model names at build time
- [ ] Command to compare installed models with the latest catalog
- [ ] Lint rule against logging prompts/URLs
- [ ] Stronger accessibility and React lint rules
- [ ] Settings check at build time
- [ ] Check settings at startup with a readable error
- [ ] Replace `console.*` in browser code with one logger
- [ ] Pin tool versions, add hosted automatic checks
- [ ] Check update-bot coverage

## Phase 15 — Cleanup & small ops
- [ ] Remove dead code (unused saved-prompt and media stores)
- [ ] Remove unused add-ons (`radix-ui`, `next-themes`, empty placeholders)
- [ ] Check the `cn` package or replace with a local helper
- [ ] Avoid running model sync twice
- [ ] Make sure `tsconfig.tsbuildinfo` isn't committed
- [ ] Remove unused style rules
- [ ] `CLAUDE.md` and `AGENTS.md` point to each other
- [ ] Shrink FINDINGS.md (done by this reorganization)
- [ ] Move tips storage to the shared helper
- [ ] Document storage version naming + test listing all keys
- [ ] Dev page showing every component with sample data
- [ ] `/api/health`
- [ ] Version info in Settings
- [ ] Fail the build if placeholder images are still used (only after placeholders are replaced; see Blocked)

## Phase 16 — Docs
- [ ] Rewrite the README
- [ ] Architecture guide
- [ ] "Adding a model" guide
- [ ] Table of error messages
- [ ] Changelog and release tags
- [ ] Run lifecycle diagram
- [ ] Privacy doc (what leaves the browser)
- [ ] One-diagram architecture note

---

## ⛔ Blocked on you
Also listed in FINDINGS.md → *Waiting on your decision*. Start these only after you answer.
- [ ] Check the API key when it's saved (need Higgsfield's response to a safe test request)
- [ ] Auto-convert iPhone photos (HEIC): approve ~1 MB add-on, or keep current message
- [ ] Replace placeholder media (brand direction; images from you or credits approval)
- [ ] Store small thumbnails (needs confirmation Higgsfield's servers allow it)
- [ ] Browser click-through test (Playwright): add-on is hundreds of MB; must use the fake server, never the real API
- [ ] Generate the README model table (needs `tsx`)
- [ ] Automatic accessibility/speed scoring (Lighthouse): which pages, what scores
- [ ] Simplify prompt-box data flow (tell me what bothers you)
