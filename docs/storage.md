# Browser storage

Everything the studio saves lives in this browser. Nothing here leaves it
(see the privacy notes in the README). "Wipe everything" in Settings → Privacy
removes all of it, plus the API key cookie and the offline file cache.

## Naming

- Keys are `hf.<name>.v<N>` (localStorage) or `<name>.v<N>` (IndexedDB).
- `N` is the shape version. When a saved shape changes, bump `N` **or** keep the
  key and branch in `migrate` (zustand stores take it from `persistVersion` in
  `generation/stores/browser-storage.ts`). Never read old data without a
  migration: a bad read must degrade to "empty", not crash.
- New keys must be added to the table below; `tests/storage-keys.test.ts`
  fails when code and this table disagree.

## Keys

| Key                 | Where                   | What                                         |
| ------------------- | ----------------------- | -------------------------------------------- |
| `hf.settings.v1`    | localStorage            | Per-model generation settings                |
| `hf.active.v2`      | localStorage            | Current surface (image/video) and model      |
| `hf.preferences.v1` | localStorage            | Settings dialog switches                     |
| `hf.projects.v1`    | localStorage            | Project names and ids                        |
| `hf.uploads.v1`     | localStorage            | Reference library (uploaded and saved files) |
| `hf.draft.v1`       | localStorage            | Unsent prompt and attached references        |
| `hf.tips.v1`        | localStorage            | Tips already shown                           |
| `history.v1`        | IndexedDB `studio`/`kv` | Runs (newest 400 plus starred)               |
| `queue.v1.<tab id>` | IndexedDB `studio`/`kv` | Planes waiting to be sent, per tab           |
| `media.<url>`       | IndexedDB `studio`/`kv` | Local copy of a finished image               |
| `media.index`       | IndexedDB `studio`/`kv` | Which copies exist (newest first, max 150)   |
| `studio-tab`        | sessionStorage          | This tab's id (names its queue)              |

The API key is not here: it is an httpOnly cookie (`api_key`) set by the server.
