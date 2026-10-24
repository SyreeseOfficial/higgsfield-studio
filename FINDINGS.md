# Higgsfield Studio — To-Do List

A list of ideas and fixes for the app, written in plain language. Finished work is at the very bottom.

**How to read this**

| Mark | Meaning |
|---|---|
| 🔴 | Important. Do these first. |
| 🟡 | Worth doing. |
| ⚪ | Nice to have. Can wait. |
| ⏱ | Rough time for a developer. Items with no ⏱ have not been estimated. |

`[ ]` = not done yet. `[x]` = done.

**Plan:** work is split into phases in [PHASES.md](PHASES.md). Mark items `[x]` here when done. Anything blocked on you goes to *Waiting on your decision*. Everything not in a phase is under [Skip](#-skip).

**Rule for tests:** only free tests. Nothing may call the real Higgsfield API or use credits.

**Totals:** about 140 open items in phases (a few appear twice), 8 decisions waiting on you, 345 skipped.

**Jump to:**
[Do first](#-do-these-first) · [Your decisions](#-waiting-on-your-decision) · [Reliability](#1-generating-reliably) · [Saving & downloads](#2-saving-history--downloads) · [Small bugs](#3-small-bugs--glitches) · [Security](#4-security--privacy) · [Prompt box](#5-prompt-box--typing) · [Models](#7-models--settings) · [Gallery](#8-gallery--finding-things) · [Viewing](#9-viewing-results) · [References](#11-reference-files) · [Sharing](#12-sharing-export--backup) · [Cost](#13-cost--usage) · [Looks](#15-look--feel) · [First-time](#16-first-time-experience) · [Speed](#18-speed) · [Behind the scenes](#20-behind-the-scenes-tests-docs-cleanup) · [Skip](#-skip) · [Done](#done)

---

## 🚦 Do these first

The 8 most important items. Each one is also listed in its category below.

1. [x] **Add a timeout to calls to Higgsfield.** One stuck call can freeze everything else. ⏱ 15 min
2. [ ] **Stop accidental double charges.** Make sure every "Generate" click has a unique ID so a retry never creates a second paid job. ⏱ 15 min
3. [ ] **Don't lose starred items.** The app keeps only the newest 400 generations. Starred ones should never be dropped. ⏱ 15 min
4. [ ] **Save results in case links expire.** Right now we only save links to the images/videos. If those links die, the gallery shows blank tiles. ⏱ 15 min
5. [ ] **Show a friendly message when the app isn't set up right.** Today users see a raw technical error. ⏱ 15 min
6. [x] **Fix "Download all".** It can crash the browser and download files twice. ⏱ 15 min
7. [ ] **Protect the saved API key better.** It's stored in a readable form in the browser cookie. ⏱ 15 min
8. [ ] **Tighten the browser security rules.** The current ones leave a gap that hackers could use. ⏱ 15 min

---

## ❓ Waiting on your decision

I couldn't do these without an answer from you. Each says what I need.

- [ ] **Check the API key when it's saved.** Right now a wrong key looks fine until the first generation fails. I can test the key on save, but I'm not sure how Higgsfield answers a test request. If I guess wrong, **every good key would be rejected**. *Need:* confirm how Higgsfield responds, or name a safe test request.
- [ ] **Replace the sample/placeholder pictures with real ones.** The starter images and templates are still from the original template. Real ones cost Higgsfield credits and need your brand direction. *Pick one:* (a) tell me the brand and approve spending credits, (b) send me the images, or (c) remove the Explore tab until there's real content.
- [ ] **Auto-convert iPhone photos (HEIC) to JPEG.** This needs a ~1 MB add-on. *Pick one:* approve the add-on, or keep the current message asking users to convert the photo themselves.
- [ ] **Keep small copies of images for faster loading.** This only works if Higgsfield's servers allow it, and I can't test that without a key. *Pick one:* confirm they allow it, or accept no offline thumbnails.
- [ ] **Automatic click-through test of the whole app (Playwright).** Needs a big add-on (hundreds of MB). *Pick one:* approve it, and say whether to use a fake Higgsfield server or the real one.
- [ ] **Auto-generate a model list in the README.** Needs a small developer tool (`tsx`). *Need:* approve it.
- [ ] **Automatic accessibility/speed scoring (Lighthouse).** *Need:* which pages to check and what minimum scores should fail a build.
- [ ] **Clean up how the prompt box passes data around.** This one is a vague review, not a clear task. *Need:* tell me what bothers you, or drop it.

---

## 1. Generating reliably

Jobs getting stuck, charged twice, or failing for no reason.

- [x] 🔴 **Add a timeout to calls to Higgsfield.** One hung call freezes submit, cancel and status checks. ⏱ 15 min
- [x] 🔴 **Make sure every generation has a unique ID**, even from older browsers, so a retry can't double-charge. ⏱ 15 min
- [x] 🔴 **Show a clear "app isn't set up" screen** instead of raw errors on every generation when settings are missing. ⏱ 15 min
- [x] 🟡 **Dev-mode glitch:** checking on jobs can get dropped when the page reloads itself while developing. Fix it. ⏱ 15 min
- [x] 🟡 **Don't throw away good results.** If one group of status checks fails, results from the groups that worked are lost. ⏱ 15 min
- [x] 🟡 **Handle "too many jobs" gracefully** instead of failing the whole status check. ⏱ 15 min
- [x] 🟡 **Treat "timeout" and "conflict" errors as "maybe it worked"**, not "it failed". Prevents double-charging. ⏱ 15 min
- [x] 🟡 **Fix "Canceling…" getting stuck** if the job was already running and can't be canceled. ⏱ 15 min
- [x] 🟡 **Wait a moment before declaring "no media produced".** Sometimes results are just a second late. ⏱ 15 min
- [x] 🟡 **Warn when a reference link has expired** instead of failing with a confusing error when using "More like this" later. ⏱ 15 min
- [x] 🟡 **Stop the tile from flickering** between "queued" and "running". ⏱ 15 min
- [x] 🟡 **Remember several pending retries**, not just one, so changing a prompt after a failure can't cause a duplicate paid job. ⏱ 15 min
- [x] 🟡 **Limit running jobs across all browser tabs.** Two tabs currently allow double the limit. ⏱ 15 min
- [x] 🟡 **Show "Retrying…" and auto-retry once** on temporary server errors.
- [x] 🟡 **Pause the queue automatically** when Higgsfield says "slow down", with a visible countdown. ⏱ 15 min
- [x] 🟡 **Keep the queue after a page reload** instead of dropping it.
- [x] 🔴 **Show a notice after reload:** "Your runs were recovered."
- [ ] 🟡 **"Recent errors" panel** in Settings: last 20 failures, with reason, support ID and a one-click retry. ⏱ 15 min

## 2. Saving, history & downloads

Keeping your work safe and getting it out of the app.

- [x] 🔴 **Don't drop starred items** when history passes 400 runs. ⏱ 15 min
- [x] 🔴 **Save copies of results** in case the original links expire. ⏱ 15 min
- [x] 🔴 **Fix "Download all".** It loads everything at once, can crash, and downloads files twice if one fails. ⏱ 15 min
- [x] 🟡 **Fix a memory leak** in how the app opens browser storage. ⏱ 5 min
- [x] 🟡 **Fix the zip file dates** (show as 1980) and warn before creating zips over 4 GB that would silently corrupt. ⏱ 5 min
- [x] 🟡 **"Wipe everything" may miss some data.** Make sure it clears all of it. ⏱ 15 min
- [x] 🟡 **Label the Usage numbers correctly.** "Total" really means "last 400 runs". ⏱ 15 min
- [x] 🟡 **Give saved library items stable IDs** so the same image doesn't get duplicated or merged. ⏱ 15 min
- [x] 🟡 **Prepare for future updates:** add a way to upgrade saved data without losing it. ⏱ 15 min
- [x] 🟡 **Warn when browser storage is full** instead of silently not saving. ⏱ 15 min

## 3. Small bugs & glitches

- [x] 🟡 **Error messages guess wrong.** A prompt containing "credit card" gets treated as "not enough credits". Check the real error code first. ⏱ 5 min
- [x] 🟡 **Video tiles are heavy.** Each one loads a full video player. Show a still frame until hover. ⏱ 15 min

## 4. Security & privacy

- [x] 🔴 **Encrypt the API key** stored in the browser cookie. Today it's readable if someone gets the cookie. ⏱ 15 min
- [x] 🔴 **Tighten browser security rules** (CSP). They're too loose and allow any website's content. ⏱ 15 min
- [x] 🟡 **Remove hidden data from WebP, GIF and MP4 files** before upload (location, camera info). Today only JPEG/PNG are cleaned. ⏱ 15 min

## 5. Prompt box & typing

- [x] 🔴 **Keep unsent prompts and attached files** when the page reloads.

## 7. Models & settings

- [ ] 🟡 **Aspect ratio previews** showing the exact crop, plus "match my reference image". ⏱ 15 min

## 8. Gallery & finding things

- [ ] 🟡 **Count badge** next to each project.
- [ ] 🟡 **Drag a tile onto a project** to move it.

## 9. Viewing results

- [x] 🔴 **Update the detail window live** when its run finishes.
- [x] 🔴 **Better video player:** scrub, speed, frame step, loop, keyboard controls.
- [x] 🟡 **Full details panel** (model, settings, seed, timings, ID) with "Copy as JSON" and "Copy as curl". ⏱ 15 min
- [x] 🟡 **Reference vs result side by side** in the detail window.
- [x] 🟡 **Fullscreen button** and `F` shortcut.
- [x] 🟡 **Zoom and pan** with a minimap.
- [x] 🟡 **Sound badge** on videos; mute globally.
- [x] 🟡 **Duration/resolution badge** on video tiles.
- [x] ⚪ **Support ID with a copy button** in the detail window.

## 11. Reference files

Pictures, videos and audio you give the AI as input.

- [ ] 🔴 **"Save as reference"** on any finished tile, with no re-upload.
- [ ] 🟡 **"Use as reference"** on tiles and in the viewer. ⏱ 15 min
- [ ] ⚪ **Auto-convert iPhone photos (HEIC).** *(see Decisions)*
- [ ] ⚪ **Crop and rotate** before upload.
- [ ] ⚪ **Show size, dimensions, length** on each card.
- [ ] ⚪ **"Already uploaded, reusing" message.**
- [ ] ⚪ **Drag a thumbnail** to reorder or remove.

## 12. Sharing, export & backup

- [x] 🟡 **Copy image to clipboard.**

## 13. Cost & usage

- [ ] 🔴 **Credit balance in the sidebar** (if Higgsfield provides it), with a warning before a run you can't afford.
- [ ] 🟡 **Activity timeline** per day and model. ⏱ 15 min
- [ ] 🟡 **Session spend counter** ("14 generations, ~320 credits today").
- [ ] ⚪ **"Not charged" note** on failed runs when known.

## 15. Look & feel

- [x] 🟡 **Skeleton tiles in the right shape** so the layout doesn't jump.
- [x] 🟡 **Gentle completion animation** (off for reduced motion).
- [x] 🟡 **Consistent status chips** (running, queued, failed, starred).
- [x] 🟡 **Smooth reflow** when tiles are added.
- [ ] 🟡 **Better drop zone** when dragging files over the window.
- [x] ⚪ **Clearer failed tiles** with reason and Retry/Delete.
- [x] ⚪ **Consistent model badges** per company.
- [ ] ⚪ **Toast stack with Undo,** max 3 visible.
- [x] ⚪ **Glow behind running tiles** by company color.
- [ ] ⚪ **One icon style** across the app.
- [ ] ⚪ **One set of text sizes.**
- [ ] ⚪ **Fade in the first row only** on load.

## 16. First-time experience

- [ ] 🟡 **Help text under each setting** in the dialog.
- [ ] 🟡 **"Check key" button** in the key dialog.

## 18. Speed

- [ ] 🟡 **Smoother layout on resize.** ⏱ 15 min
- [ ] 🟡 **Skip rendering off-screen tiles** while keeping loaded media. ⏱ 15 min
- [ ] 🟡 **Don't recompute lists** on every poll tick. ⏱ 15 min
- [ ] 🟡 **Split the two biggest files** (886 and 816 lines) into smaller pieces. ⏱ 15 min
- [ ] 🟡 **Only update the part of the gallery that changed.** ⏱ 15 min
- [ ] 🟡 **Load rarely used windows only when opened.** ⏱ 15 min
- [ ] 🟡 **Preload images only near the screen.** ⏱ 15 min
- [ ] 🟡 **Store small thumbnails** for instant reopening.
- [ ] 🟡 **Cap simultaneous videos** at a hard limit.
- [ ] 🟡 **Do heavy file work** (fingerprinting, metadata stripping) in the background.
- [ ] 🟡 **Only re-render the tile that changed.**
- [ ] ⚪ **Analyze the bundle once** and lazy-load more windows.
- [ ] ⚪ **Skip off-screen parts** of the detail window.
- [ ] ⚪ **Load first-row images first,** others later.
- [ ] ⚪ **Cache static files** offline.

## 20. Behind the scenes (tests, docs, cleanup)

Work that users don't see but keeps the app healthy.

**Tests**
- [ ] 🔴 **Test the error messages** against real Higgsfield responses.
- [ ] 🟡 **Tests for screens** (prompt box, key dialog, gallery tile). ⏱ 15 min
- [ ] 🟡 **Tests with random inputs** for settings parsing. ⏱ 15 min
- [ ] 🟡 **Recorded-response tests** for the Higgsfield connection. ⏱ 15 min
- [ ] 🟡 **Stress-test** the polling and run logic. ⏱ 15 min
- [ ] 🟡 **Test the run controller** (queue, retry, cancel, two tabs). ⏱ 15 min
- [ ] 🟡 **Test merging of history** and skipping bad rows. ⏱ 15 min
- [ ] 🟡 **Stress-test error messages** with real samples. ⏱ 15 min
- [ ] 🟡 **Test metadata stripping** with broken files. ⏱ 15 min
- [ ] 🟡 **Browser test of the main scenarios** (missing key, cancel, empty history). *(see Decisions)*
- [ ] 🟡 **Test history loading** (bad row skipped, order, cap).
- [ ] 🟡 **Test "failed runs stay visible."**
- [ ] 🟡 **Test idempotency key reuse.**
- [ ] 🟡 **Tests for model files** (icons, unique order, roles). ⏱ 15 min
- [ ] 🟡 **Single `pnpm check` command** for all checks.
- [ ] 🟡 **Fake Higgsfield server** for tests and demos without a key.
- [ ] ⚪ **Automatic accessibility/speed run** in CI. *(see Decisions)*
- [ ] ⚪ **Mock mode** (`HF_MOCK=1`) for demos.

**Code quality**
- [ ] 🟡 **Stricter TypeScript settings** and lint rules. ⏱ 15 min
- [ ] 🟡 **Catch typo'd model names** at build time. ⏱ 15 min
- [ ] 🟡 **Command to compare installed models** with the latest catalog. ⏱ 15 min
- [ ] 🟡 **Lint rule against logging prompts/URLs.** ⏱ 15 min
- [ ] 🟡 **Remove an unused add-on** (`radix-ui`) if confirmed. ⏱ 15 min
- [ ] 🟡 **Pin tool versions** and add hosted automatic checks. ⏱ 15 min
- [ ] 🟡 **Check update-bot coverage.** ⏱ 15 min
- [ ] 🟡 **Dev page showing every component** with sample data. ⏱ 15 min
- [ ] 🟡 **Settings check at build time** so a missing setting fails early. ⏱ 15 min
- [ ] 🟡 **Stronger accessibility and React lint rules.** ⏱ 15 min
- [ ] ⚪ **Simplify how data flows** in the prompt box. *(see Decisions)*
- [ ] ⚪ **Generate the model table in the README.** *(see Decisions)*
- [ ] ⚪ **Check settings at startup** with a readable error.
- [ ] ⚪ **Replace `console.*` in browser code** with one logger.

**Docs**
- [ ] 🟡 **Rewrite the README** (purpose, screenshots, setup table, limits). ⏱ 15 min
- [ ] 🟡 **Architecture guide.** ⏱ 15 min
- [ ] 🟡 **"Adding a model" guide.** ⏱ 15 min
- [ ] 🟡 **Table of error messages** for support. ⏱ 15 min
- [ ] 🟡 **Changelog** and release tags. ⏱ 15 min
- [ ] 🟡 **Run lifecycle diagram.** ⏱ 15 min
- [ ] 🟡 **Privacy doc** of what leaves the browser. ⏱ 15 min
- [ ] ⚪ **One-diagram architecture note.**

**Setup & running the app**
- [ ] 🟡 **`/api/health` page** for uptime checks. ⏱ 15 min
- [ ] 🟡 **Show version info in Settings.** ⏱ 15 min

**Cleanup**
- [ ] 🟡 **Remove dead code:** unused saved-prompt and media stores. Wire them in or delete them.
- [ ] ⚪ **Avoid running model sync twice** in config reloads. ⏱ 5 min
- [ ] ⚪ **Make sure a build file isn't committed** (`tsconfig.tsbuildinfo`). ⏱ 5 min
- [ ] ⚪ **Remove unused style rules.** ⏱ 5 min
- [ ] ⚪ **Make `CLAUDE.md` and `AGENTS.md` point to each other.** ⏱ 5 min
- [ ] ⚪ **Shrink this file** (done by this reorganization). ⏱ 5 min
- [ ] ⚪ **Move tips storage** to the same helper as everything else. ⏱ 5 min
- [ ] ⚪ **Document the storage version naming** and add a test listing all keys. ⏱ 5 min
- [ ] ⚪ **Fail the build if placeholder images are still used.** ⏱ 5 min
- [ ] ⚪ **Remove unused add-ons:** `radix-ui`, `next-themes`, empty placeholder files.
- [ ] ⚪ **Check the package named `cn`** or replace it with a six-line local helper.
- [ ] ⚪ **Replace placeholder media** *(see Decisions)*.

---

## ⏭ Skip

Not doing these. Moved here from the sections above; kept in case you change your mind.

**❓ Waiting on your decision**
- [ ] **Grey out setting combos a model refuses.** Nothing in the app says which combos don't work (like certain resolution + length pairs). *Need:* a list of bad combos per model, or a link to Higgsfield's docs.
- [ ] **Auto-shrink huge images before upload.** No model says its maximum image size, so I have nothing to shrink to. *Need:* the max size (per model or one global value).
- [ ] **Turn on React Compiler (a speed-up tool).** Needs a new add-on and someone to measure before/after in a browser. *Pick one:* approve it, or drop the idea.

**1. Generating reliably**
- [ ] 🟡 **Check old jobs less often.** A video started an hour ago is checked every 4 seconds just because a new image started. ⏱ 15 min
- [ ] 🟡 **Show a "Support ID" on every failed tile** so you can quote it to Higgsfield support. ⏱ 15 min
- [ ] ⚪ **Limit how fast Generate can be clicked** and show how long to wait.

**2. Saving, history & downloads**
- [ ] 🟡 **Clean up file names inside zips** so odd characters don't cause problems. ⏱ 5 min
- [ ] 🟡 **Fix two-tab conflicts.** Delete or star something in one tab and the other tab can bring it back. ⏱ 15 min
- [ ] 🟡 **"Export with media":** current export saves only links, which break when links expire. ⏱ 15 min
- [ ] 🟡 **Give downloads real names** like `kling-sunset-beach-20261024.mp4` instead of random ones. ⏱ 15 min
- [ ] 🟡 **When download fails,** tell the user a new tab opened and to use "Save as". ⏱ 15 min
- [ ] 🟡 **Warn when the library hits 200 items** instead of silently dropping the oldest. ⏱ 15 min
- [ ] 🟡 **Save each generation separately** instead of rewriting all 400 every time (faster). ⏱ 15 min
- [ ] 🟡 **Tell the user when history hits 400** and add Export/Import so a browser reset isn't a disaster.
- [ ] 🟡 **Warn when history can't be saved** (e.g. private browsing window).
- [ ] 🟡 **Safe import:** merge by ID instead of replacing everything.
- [ ] ⚪ **Reject backup files from the future** with a clear message.

**3. Small bugs & glitches**
- [ ] 🟡 **Video/image tiles start as squares** for some models, then jump when the real picture loads. ⏱ 5 min
- [ ] 🟡 **Usage chart is off by an hour** on daylight-saving days. ⏱ 5 min
- [ ] 🟡 **"Median time" counts waiting in line** as generation time. Record start and finish properly. ⏱ 5 min
- [ ] 🟡 **Notifications stack up** and clicking one doesn't open the app. ⏱ 15 min
- [ ] 🟡 **Finish sound is unreliable.** Use one sound player instead of making a new one each time. ⏱ 15 min
- [ ] 🟡 **No prompt length limit.** Users wait, then get a vague error. Add a counter and block over-long prompts. ⏱ 15 min
- [ ] 🟡 **"Today / Yesterday" labels go stale** after midnight. ⏱ 15 min
- [ ] 🟡 **Library names cut off mid-word** or include line breaks. ⏱ 15 min

**4. Security & privacy**
- [ ] 🟡 **Limit how often the app can be called** so a shared site can't be abused to burn the owner's quota. ⏱ 15 min
- [ ] 🟡 **Make the privacy page build itself** from a single list so it can't get out of date. Add "Download my data". ⏱ 15 min
- [ ] 🟡 **Hide prompts in copied diagnostics** by default. ⏱ 15 min
- [ ] 🟡 **Warn if someone pastes an API key** into the prompt box. ⏱ 15 min
- [ ] 🟡 **"Private" projects** that are left out of exports, stats and search. ⏱ 15 min
- [ ] 🟡 **Slow down key-guessing** in the key dialog.
- [ ] 🟡 **Test that errors never reveal the key** or private links.
- [ ] 🟡 **Warn before attaching photos of people** to models with restrictions.
- [ ] ⚪ **Hide possibly unsafe results by default** (blur).
- [ ] ⚪ **Auto-lock:** hide the gallery after some idle minutes.
- [ ] ⚪ **"Hide previews" panic button** for screen sharing.
- [ ] ⚪ **Only allow trusted media sources** in the security rules.
- [ ] ⚪ **Free up memory** from pasted images after upload.
- [ ] ⚪ **"Private mode":** don't save new runs to history.
- [ ] ⚪ **Warn if the site isn't HTTPS** (key protection won't fully apply).

**5. Prompt box & typing**
- [ ] 🟡 **Prompt library with tags:** save, search and reuse prompts; add placeholders like `{subject}`. ⏱ 15 min
- [ ] 🟡 **Prompt variations:** typing `{red|blue|green}` creates one run for each option. ⏱ 15 min
- [ ] 🟡 **Paste anywhere to attach** an image or link as a reference. ⏱ 15 min
- [ ] 🟡 **Drag a finished image** into the prompt box to use it as a reference. ⏱ 15 min
- [ ] 🟡 **Prompt undo history** and a "restore last prompt" button. ⏱ 15 min
- [ ] 🟡 **Customizable keyboard shortcuts** and a help sheet that updates itself. ⏱ 15 min
- [ ] 🟡 **Keyboard-first prompt box:** Ctrl+Enter to generate, shortcuts to switch model or aspect ratio. ⏱ 15 min
- [ ] 🟡 **Type `/` commands** like `/model kling-3` or `/ar 9:16`. ⏱ 15 min
- [ ] 🟡 **Describe an image as a prompt** (image-to-prompt). ⏱ 15 min
- [ ] 🟡 **"Enhance prompt"** that improves a short prompt. ⏱ 15 min
- [ ] 🟡 **Saved snippets** (like "my style suffix") inserted with `/`.
- [ ] 🟡 **Ctrl+Enter hint** on the Generate button.
- [ ] 🟡 **Character counter and length warning** per model.
- [ ] 🟡 **Show what changed** when reusing an old prompt.
- [ ] 🟡 **Insert an old prompt** at the cursor with `@@`.
- [ ] 🟡 **Prompt hints:** warn about contradictions like "day" and "night", or repeated words.
- [ ] 🟡 **Better undo/redo** that survives "Enhance" and template inserts.
- [ ] 🟡 **Prompt history dropdown** with search.
- [ ] ⚪ **Dictate prompts** with your voice.
- [ ] ⚪ **Describe an attached image** into the prompt box.
- [ ] ⚪ **More `/` commands:** `/image`, `/video`, `/project name`.
- [ ] ⚪ **Estimate length** for models with a limit.
- [ ] ⚪ **Drag prompt text** from a tile into the box.
- [ ] ⚪ **Paste an image URL** and have the app fetch it.
- [ ] ⚪ **Clean up pasted text** (curly quotes, extra spaces).
- [ ] ⚪ **Rotating example text** in the empty prompt box.
- [ ] ⚪ **Auto-translate prompts** into English with a preview. ⏱ 15 min
- [ ] ⚪ **Voice input** with language choice. ⏱ 15 min

**6. Generating workflow**
- [ ] 🔴 **"Retry with edits"** on failed tiles: reopen the prompt with the error shown above. 
- [ ] 🔴 **Ask before sending a duplicate** paid job within 10 seconds.
- [ ] 🔴 **Retry / Reuse buttons on tiles.** Retry a failed one; reuse the prompt, model and settings of any one.
- [ ] 🔴 **"Animate" button on images** to turn a still into a video in one click. Also "Extend" on videos.
- [ ] 🔴 **Seed control + "lock seed"** so you can test one change at a time.
- [ ] 🟡 **Seed field per model,** shown on the detail view, plus "same seed, new prompt". ⏱ 15 min
- [ ] 🟡 **"N variations" control** (1, 2, 4) for every image model. ⏱ 15 min
- [ ] 🟡 **Run one prompt on many models** and compare side by side. ⏱ 15 min
- [ ] 🟡 **Family tree of runs:** track which run came from which. ⏱ 15 min
- [ ] 🟡 **A/B mode:** send two prompts as a pair and pick a winner. ⏱ 15 min
- [ ] 🟡 **Reusable workflows** (product shot, social sizes) that make several ratios at once. ⏱ 15 min
- [ ] 🟡 **Scheduled generation** to start later. ⏱ 15 min
- [ ] 🟡 **Turn on notifications when the tab is closed.** ⏱ 15 min
- [ ] 🟡 **Sound options and volume** for the finish chime. ⏱ 15 min
- [ ] 🟡 **Finish the half-built batch feature** or delete it.
- [ ] 🟡 **Compare mode:** two tiles side by side with a slider.
- [ ] 🟡 **"Model shootout":** same prompt on N models in one row.
- [ ] 🟡 **Prompt templates** with fill-in blanks and grid of combinations.
- [ ] 🟡 **Negative prompt field** (what to avoid) for models that support it.
- [ ] 🟡 **Reorder or remove queued tiles** before they start.
- [ ] 🟡 **Pause the queue** with one toggle.
- [ ] 🟡 **Chain mode:** output of step A becomes input of step B.
- [ ] 🟡 **Re-run a whole project** on a different model.
- [ ] ⚪ **"Use last frame as next start frame"** for video chains.
- [ ] ⚪ **Batch from a spreadsheet (CSV):** one prompt per row.
- [ ] ⚪ **Quick presets** (Draft / Balanced / Final) for each model.
- [ ] ⚪ **"Run again every N minutes"** *(skip unless asked)*.
- [ ] ⚪ **"Re-run failed only"** button.
- [ ] ⚪ **Per-run timeline** (queued, started, finished).
- [ ] ⚪ **Notes on a run** saved with it.
- [ ] ⚪ **Choose how many jobs run at once** (1–4) in Settings.

**7. Models & settings**
- [ ] 🔴 **"Why this model" comparison table** for all models. 
- [ ] 🟡 **Negative prompt and strictness (CFG) settings** for models that offer them. ⏱ 15 min
- [ ] 🟡 **Model suggestions** based on your prompt and files. ⏱ 15 min
- [ ] 🟡 **Tags on models** (text rendering, characters, sound…) so the picker can filter 28 models. ⏱ 15 min
- [ ] 🟡 **Flag old/preview models** and point to newer ones. ⏱ 15 min
- [ ] 🟡 **Saved setting bundles** like "cinematic 16:9 1080p". ⏱ 15 min
- [ ] 🟡 **Global default settings** per surface. ⏱ 15 min
- [ ] 🟡 **Explain each model's limits** (max length, ratios, sound) before you generate. ⏱ 15 min
- [ ] 🟡 **Warn about settings that don't work together.** ⏱ 15 min
- [ ] 🟡 **Cross-model presets** like "Vertical 9:16 short". ⏱ 15 min
- [ ] 🟡 **Grey out invalid setting combos** with the reason. *(see Decisions)*
- [ ] 🟡 **Pin favorite models** to the top.
- [ ] 🟡 **Auto-suggest video models** when you attach a video.
- [ ] 🟡 **Show last-used settings** in the picker.
- [ ] 🟡 **Hide models in Settings** (still searchable, with "n hidden" row).
- [ ] 🟡 **Name and recall your setting presets** ("Reels 9:16 High").
- [ ] 🟡 **Copy settings between models** where they match.
- [ ] ⚪ **Duration slider** with live cost/time hint.
- [ ] ⚪ **"New" badge** when a model is added.
- [ ] ⚪ **"Cheapest model that fits"** suggestion.
- [ ] ⚪ **"Needs reference" badge** on models that require an input.
- [ ] ⚪ **Notice when a model disappears** from the platform.
- [ ] ⚪ **Group models by company** with collapsible sections.
- [ ] ⚪ **Model search and a "Recent" group** (Kling alone has five entries).

**8. Gallery & finding things**
- [ ] 🔴 **Search by prompt, model and date.**
- [ ] 🔴 **Quick text search** in the feed header, with matches highlighted.
- [ ] 🟡 **Collections** (favorites folders) separate from projects. ⏱ 15 min
- [ ] 🟡 **Notes and 1–5 star ratings** on runs. ⏱ 15 min
- [ ] 🟡 **Full search** across prompts, notes, models and settings, with filters. ⏱ 15 min
- [ ] 🟡 **Show gallery by day, project, model or status** with sticky headers. ⏱ 15 min
- [ ] 🟡 **Project settings:** default model, shared references, notes. ⏱ 15 min
- [ ] 🟡 **Project cover image, pinning and sorting.** ⏱ 15 min
- [ ] 🟡 **Archive** runs and projects instead of deleting. ⏱ 15 min
- [ ] 🟡 **Trash with 30-day recovery.** ⏱ 15 min
- [ ] 🟡 **Auto-name runs** from the prompt. ⏱ 15 min
- [ ] 🟡 **Suggest the right project** when you generate. ⏱ 15 min
- [ ] 🟡 **Tags** on runs, with a tag filter.
- [ ] 🟡 **Keyboard navigation** in the gallery (arrows, Enter, `f`, Delete).
- [ ] 🟡 **Prev/next arrows and swipe** in the detail window.
- [ ] 🟡 **Saved filters** as pinned chips.
- [ ] 🟡 **Shift+click** to select a range.
- [ ] 🟡 **"Select all in this day."**
- [ ] 🟡 **Collapse a day** into a summary ("12 images, 2 failed").
- [ ] 🟡 **Pin a run** to the top.
- [ ] 🟡 **Smart collections** like "All videos this week".
- [ ] ⚪ **"Open in new tab" and "Copy link"** for results.
- [ ] ⚪ **Density remembered per surface** + compact list view.
- [ ] ⚪ **Pick the project cover image.**
- [ ] ⚪ **Project descriptions** and default model.
- [ ] ⚪ **Duplicate a project.**
- [ ] ⚪ **Archive projects.**
- [ ] ⚪ **Comments on a run** for review.
- [ ] ⚪ **Approval status** (Draft / Approved / Rejected).
- [ ] ⚪ **Thumbs up/down** feeding a "what works" view.
- [ ] ⚪ **"Jump to date"** control and scroll rail.
- [ ] ⚪ **Hide failed runs** with one toggle.
- [ ] ⚪ **Row-height slider.**
- [ ] ⚪ **"Recently deleted" bin** for 7 days.
- [ ] ⚪ **Project name chip** on tiles in "All".

**9. Viewing results**
- [ ] 🟡 **Filmstrip of related runs** below the media.
- [x] 🟡 **Copy buttons** for each field.
- [ ] 🟡 **Show size and dimensions;** download original vs WebP.
- [ ] 🟡 **Color swatches** from the image.
- [ ] 🟡 **"Describe this image"** to reuse as a prompt.
- [ ] 🟡 **Picture-in-picture** button.
- [ ] 🟡 **Storyboard mode:** ordered shots, run all, chain last frame to next start.
- [ ] ⚪ **Swipe down to close** on touch.
- [ ] ⚪ **Preload next/previous** media.
- [ ] ⚪ **Remember zoom** between images.
- [ ] ⚪ **Exact timestamp on hover.**
- [ ] ⚪ **Before/after toggle** against the reference.
- [ ] ⚪ **Grid overlay** (thirds, safe areas).
- [ ] ⚪ **Pinch-zoom** on images.
- [ ] ⚪ **Blur-up placeholder** while loading.
- [ ] ⚪ **Dominant-color background** while loading.
- [ ] ⚪ **Loop-seam preview.**
- [ ] ⚪ **Hover-scrub** on video tiles.
- [ ] ⚪ **Pick the video poster frame.**
- [ ] ⚪ **Message if the browser can't play the video,** with Download.
- [ ] ⚪ **Remember mute/volume.**
- [ ] ⚪ **Burn in a watermark/caption** *(only if asked)*.
- [ ] ⚪ **Attach background music** to silent videos *(heavy; skip unless asked)*.

**10. Editing results**
- [ ] 🔴 **Upscale button** on image tiles.
- [ ] 🟡 **Grab a frame from a video** and use it as the next start frame. ⏱ 15 min
- [ ] 🟡 **Upscale/extend/edit** as tile-menu follow-ups. ⏱ 15 min
- [ ] 🟡 **Audio tools:** waveform preview and trimming before upload. ⏱ 15 min
- [ ] 🟡 **Upscale videos.**
- [ ] 🟡 **Remove background** on images.
- [ ] 🟡 **Outpaint / reframe** to 9:16, 1:1, etc.
- [ ] 🟡 **Paint a mask** on an image, then describe the change.
- [ ] 🟡 **Trim a video** in the detail window.
- [ ] 🟡 **"Edit with prompt":** attach the image and focus the prompt in one click.
- [ ] 🟡 **Relight / restyle presets.**
- [ ] 🟡 **Crop preview** for 9:16, 1:1, 4:5, 16:9.
- [ ] ⚪ **Extract a frame as PNG.**
- [ ] ⚪ **Convert video to GIF/WebM.**
- [ ] ⚪ **Stitch clips into one reel.**
- [ ] ⚪ **Flip / rotate** reference images.
- [ ] ⚪ **Import a mask PNG** for inpainting.
- [ ] ⚪ **Preview speed changes** on videos.
- [ ] ⚪ **Caption overlay preview.**
- [ ] ⚪ **A/B toggle** between two takes.
- [ ] ⚪ **Plug-in system** for post-processing steps. ⏱ 1 hr

**11. Reference files**
- [ ] 🔴 **Plain-language role names:** "First frame", "Last frame", "Style", "Character".
- [ ] 🟡 **Show roles on slots** (start, end, reference) with drag-reorder and a swap button. ⏱ 15 min
- [ ] 🟡 **Library folders / tags** (characters, products, styles).
- [ ] 🟡 **Library search and rename.**
- [ ] 🟡 **Limit meter** ("2 of 4 images") with a reason when full.
- [ ] 🟡 **Bulk delete / tag** in the library.
- [ ] 🟡 **"Used in" list** for each asset.
- [ ] 🟡 **Sort and filter** the library.
- [ ] 🟡 **Preview video before upload** to catch a wrong file.
- [ ] 🟡 **Clean up the library:** unused files, duplicates, expired links. ⏱ 15 min
- [ ] ⚪ **Auto-shrink huge images.** *(see Decisions)*
- [ ] ⚪ **Drag to reorder** references, with role badges.
- [ ] ⚪ **Mark an asset as "Character"** and auto-attach with `@name`.
- [ ] ⚪ **"Re-upload needed" notice** when a link expires.
- [ ] ⚪ **Remove-all-references** button.

**12. Sharing, export & backup**
- [ ] 🟡 **Share a run as a read-only link or image card** (no key exposed). ⏱ 15 min
- [ ] 🟡 **Export/import a whole project** (media + info) to another machine. ⏱ 15 min
- [ ] 🟡 **Optional sync** across devices, with a sample setup. ⏱ 15 min
- [ ] 🟡 **Multiple API key profiles** with separate history. ⏱ 15 min
- [ ] 🟡 **Save prompt/model/settings inside downloaded files** so they describe themselves. ⏱ 15 min
- [ ] 🟡 **"Copy prompt / settings / link to this run"** in the tile menu. ⏱ 15 min
- [ ] 🟡 **Web addresses for views and runs** so Back button and bookmarks work. ⏱ 15 min
- [ ] 🟡 **Project as Markdown shot list** plus media zip. ⏱ 15 min
- [ ] 🟡 **Import a history backup,** skipping duplicates. ⏱ 15 min
- [ ] 🟡 **Zip a project** with a `prompts.csv`.
- [ ] 🟡 **Public share page** for one result *(needs a server)*.
- [ ] 🟡 **Cloud sync** behind the existing history interface.
- [ ] 🟡 **QR code** to move to another device.
- [ ] 🟡 **Shareable "recipe link"** that preloads the prompt box.
- [ ] 🟡 **"Download all in project"** with progress and cancel.
- [ ] 🟡 **File name template** setting.
- [ ] 🟡 **Copy result link** with a note about its lifetime.
- [ ] 🟡 **Export history as CSV.**
- [ ] ⚪ **Auto-archive to your own storage** (S3 / WebDAV). ⏱ 15 min
- [ ] ⚪ **Webhook on completion** for Zapier / n8n. ⏱ 15 min
- [ ] ⚪ **Static web gallery** from a project. ⏱ 15 min
- [ ] ⚪ **Comments / shared projects** (needs a backend first). ⏱ 15 min
- [ ] ⚪ **Contact sheet PNG/PDF** for clients. ⏱ 15 min
- [ ] ⚪ **Meaningful download names.**
- [ ] ⚪ **Native Share on mobile.**
- [ ] ⚪ **Export/import a "recipe"** file.
- [ ] ⚪ **Export/import the whole app state** in one file.
- [ ] ⚪ **One-image contact sheet** of a project.
- [ ] ⚪ **Print layout** for a project.
- [ ] ⚪ **Embed prompt/model** in downloads.
- [ ] ⚪ **Web addresses for surface, model, project.**
- [ ] ⚪ **Link to a single generation.**
- [ ] ⚪ **Import prompts from a text file.**
- [ ] ⚪ **Backup reminder** ("Last export 30 days ago").
- [ ] ⚪ **Markdown snippet** for chat tools.
- [ ] ⚪ **Email-to-self** of a recipe link.
- [ ] ⚪ **Client-review export:** one HTML file with media inside.

**13. Cost & usage**
- [ ] 🟡 **Cost estimate before you generate** and a running total. ⏱ 15 min
- [ ] 🟡 **Per-model credit estimates** feeding a weekly summary. ⏱ 15 min
- [ ] 🟡 **Confirm expensive combos** (long 4K, batches over 2).
- [ ] 🟡 **Per-project budget cap.**
- [ ] 🟡 **Weekly summary** (runs, success rate, failures by reason).
- [ ] 🟡 **Failure reasons breakdown** with counts.
- [ ] 🟡 **Busiest hour/day heatmap.**
- [ ] ⚪ **Mark runs free vs paid.**
- [ ] ⚪ **Average wait per model.**
- [ ] ⚪ **Export usage as CSV.**
- [ ] ⚪ **Streak counter** (opt-in, off by default).

**14. Phone & installing the app**
- [ ] 🟡 **Install as an app** (manifest and icons) with an offline shell.
- [ ] 🟡 **Bottom-sheet pickers** on narrow screens.
- [ ] 🟡 **Camera capture** as a reference.
- [ ] 🟡 **Accept photos shared from the phone.**
- [ ] 🟡 **Prompt box collapses to a "+" sheet** on narrow screens.
- [ ] 🟡 **No pull-to-refresh** inside the feed.
- [ ] 🟡 **Add `robots` noindex, manifest and icons;** the favicon is 26 KB. ⏱ 15 min
- [ ] 🟡 **Phone layout pass** (bottom prompt box, swipe between surfaces). ⏱ 15 min
- [ ] 🟡 **Offline mode:** browse history offline; queue sends until online. ⏱ 15 min
- [ ] ⚪ **Offline gallery** with cached posters. ⏱ 15 min
- [ ] ⚪ **Safe-area spacing** for iPhones.
- [ ] ⚪ **Long-press tile menu** on touch.
- [ ] ⚪ **Vibrate on completion.**
- [ ] ⚪ **Share-sheet "Add to Studio."**
- [ ] ⚪ **Install prompt** after the third run.
- [ ] ⚪ **Less motion and autoplay** on data-saver connections.
- [ ] ⚪ **Bigger touch targets** (44 px) on narrow screens.

**15. Look & feel**
- [ ] ⚪ **Prompt box shrinks to one line** while scrolling.
- [ ] ⚪ **On-brand empty-state art.**

**16. First-time experience**
- [ ] 🔴 **First-run checklist:** add key → first image → first video.
- [ ] 🟡 **Example prompts** as clickable chips in the empty state.
- [ ] 🟡 **Guided "first video from your image"** tour.
- [ ] 🟡 **Empty-state hero** with the three key actions and real progress.
- [ ] ⚪ **Sample project** on first load.
- [ ] ⚪ **"What's new" window.**
- [ ] ⚪ **Tip:** "Videos take a few minutes; you can leave the tab."
- [ ] ⚪ **"Replay tour"** in the command palette.
- [ ] ⚪ **Help link** in the shortcuts window.

**17. Accessibility & languages**
- [ ] 🔴 **Announce state changes to screen readers** ("Image ready", "Failed: content filter").
- [ ] 🔴 **Keyboard access to every tile action** (not hover-only).
- [ ] 🟡 **Name every tile** (prompt + model + status) and allow arrow-key movement. ⏱ 15 min
- [ ] 🟡 **Respect "reduce motion"** for hover video and shimmer. ⏱ 15 min
- [ ] 🟡 **Alt text for images** from the prompt (editable). ⏱ 15 min
- [ ] 🟡 **Check dialogs** return focus properly and Escape closes in the right order. ⏱ 15 min
- [ ] 🟡 **Skip links and page landmarks,** plus a clearer focus outline. ⏱ 15 min
- [ ] 🟡 **High-contrast option** within the dark theme. ⏱ 15 min
- [ ] 🟡 **Prepare for translation** and right-to-left languages. ⏱ 15 min
- [ ] 🟡 **Label every icon button;** run an automatic accessibility check. ⏱ 15 min
- [ ] 🟡 **Visible focus rings** and text contrast check.
- [ ] 🟡 **Keyboard focus trap** in all dialogs.
- [ ] 🟡 **Skip link** to the prompt box and feed.
- [ ] 🟡 **Don't tab through 400 tiles** (arrow-key navigation).
- [ ] 🟡 **Announce queue position changes.**
- [ ] 🟡 **Status colors with icons,** not color alone.
- [ ] ⚪ **Pause autoplay video** for reduced motion (show poster + play).
- [ ] ⚪ **Tooltips with shortcut hints.**
- [ ] ⚪ **One place for all text** to ease translation.
- [ ] ⚪ **Format dates and times** for the user's locale.
- [ ] ⚪ **Text alternative for the timer ring.**
- [ ] ⚪ **Language and direction setting.**
- [ ] ⚪ **"1 run / 2 runs"** plural handling.

**18. Speed**
- [ ] 🟡 **Pause off-screen videos** to save phone batteries. ⏱ 15 min
- [ ] 🟡 **Measure the app's download size** and set a budget. ⏱ 15 min
- [ ] 🟡 **Reuse the Higgsfield connection** within one request. ⏱ 15 min
- [ ] ⚪ **React Compiler** (see Decisions).

**19. Big new ideas**
- [ ] 🟡 **Audio surface** (voice/music) if the platform adds it.
- [ ] 🟡 **Talking-head flow:** image + audio → video.
- [ ] 🟡 **Character library** with `@name` in prompts.
- [ ] 🟡 **Style library** applied in one click.
- [ ] 🟡 **Brand kit** (logo, colors, fonts, style words) used by templates. ⏱ 15 min
- [ ] 🟡 **Real template gallery** where each one loads a prompt, model and settings.
- [ ] 🟡 **"Recipes" page** built from your best starred runs.
- [ ] 🟡 **Shot list view** for a project, printable.
- [ ] 🟡 **Reference-pack presets** (front, side, back of a character).
- [ ] 🟡 **Schedule a batch** at a quiet hour *(skip unless asked)*.
- [ ] 🟡 **Experiments tab:** same prompt across models/settings with times and ratings. ⏱ 15 min
- [ ] ⚪ **Command-line version** to run batch jobs from a text file. ⏱ 1 hr
- [ ] ⚪ **Mood board:** drag tiles onto a free canvas.
- [ ] ⚪ **Notify URL** when a run finishes *(needs server)*.
- [ ] ⚪ **Public API to submit prompts** *(security review first)*.
- [ ] ⚪ **Team mode:** shared key kept on the server *(changes core rules; ask first)*.
- [ ] ⚪ **Project templates** ("Product ad", "Social reel").
- [ ] ⚪ **Fullscreen slideshow** of a project.
- [ ] ⚪ **Plug-in point** for custom tile-menu actions.

**20. Behind the scenes (tests, docs, cleanup) — Setup & running the app**
- [ ] 🟡 **Document deployment** (Vercel, Docker, own server), including HTTPS cookie behavior. ⏱ 15 min
- [ ] 🟡 **Add a Dockerfile.** ⏱ 15 min
- [ ] 🟡 **Structured server logs** with timings. ⏱ 15 min
- [ ] 🟡 **Opt-in error reporting** with a "Send diagnostics" button. ⏱ 15 min

**20. Behind the scenes (tests, docs, cleanup) — Cleanup**
- [ ] ⚪ **Shrink the favicon.** ⏱ 5 min
- [ ] ⚪ **Shrink large model icons.** ⏱ 5 min

---

## Done

_Finished work, kept as it was._

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
