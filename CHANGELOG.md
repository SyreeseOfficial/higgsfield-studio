# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow
`package.json`; tag a release with `git tag -a vX.Y.Z -m "..." && git push --tags`.

## [Unreleased]

### Added

- Viewer with zoom and pan, a real video player, compare with reference, per-field
  copy, copy as JSON / curl / image, fullscreen.
- Reference tools: crop and rotate, use or save a result as a reference, drag to
  reorder or remove, window-wide drop zone, size and dimensions on each card.
- Tile badges (model, duration, resolution, sound), consistent status chips,
  visible Retry / Delete on failed tiles, drag a tile onto a project.
- Usage: 14-day activity by model, weekly summary; Settings: Recent errors, version.
- Demo mode (`HF_MOCK=1`), `/api/health`, `pnpm check`, `pnpm models:diff`.
- Local copies of finished images; offline cache of static files.
- Docs: architecture, run lifecycle, errors, privacy, storage.

### Changed

- Submits are safe to retry: unique ids, 30 s call timeout, several remembered
  retry keys, one running-slot limit across tabs, auto-retry once, 429 pause.
- The queue and unsent prompt/references survive a reload.
- Starred runs are never dropped from history; "Wipe everything" clears all data.
- Stricter TypeScript and ESLint (no warnings), CSP and headers tightened.
- `studio.tsx` and the prompt box split into smaller files.

### Fixed

- Truncated JPEG EXIF crashed upload preparation; range settings accepted `NaN`;
  Image/Video filters hid failed runs; zip dates showed 1980; Download all could
  save a file twice; IndexedDB connections leaked.

### Removed

- Unused prompt/media stores, theme provider, `radix-ui` and `next-themes`.
