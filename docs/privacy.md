# Privacy: what leaves the browser

| Data                             | Goes to                                                                                                                              | Why                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Prompt, settings, reference URLs | This server, then Higgsfield                                                                                                         | To run the generation                  |
| API key                          | Stays in an httpOnly cookie; the server adds it to platform calls. Optionally encrypted with `HF_COOKIE_SECRET`                      | To authenticate                        |
| Reference files                  | Higgsfield storage, directly, via a signed URL with no credentials                                                                   | So the platform can read them          |
| Request/response status          | Server logs: one JSON line per event with ids and status codes, never prompts, URLs or keys (`HF_DEBUG=1` adds bodies; leave it off) | Debugging, the Support ID              |
| Result images/video              | Loaded by the browser from the platform's CDN                                                                                        | Showing results (the CDN sees your IP) |

Not sent anywhere: history, projects, favourites, the reference library,
drafts and settings. They stay in this browser ([docs/storage.md](storage.md)).
There are no analytics, trackers or third-party scripts.

**Metadata:** before upload, location/camera/timestamp data is removed from
JPEG, PNG, WebP, GIF and MP4 files. WAV audio is uploaded as is. A file the
studio cannot parse is uploaded unchanged.

**Local copies:** finished images are also saved in this browser (IndexedDB)
so tiles survive an expired link. Videos are not.

**Offline cache:** a service worker keeps the app's own static files (scripts,
icons, sample images) and the home page. It never caches `/api`, results or uploads.

**Removing it all:** Settings → Privacy and storage → Wipe everything clears the
cookie, IndexedDB, localStorage, sessionStorage, the offline cache and the worker.
