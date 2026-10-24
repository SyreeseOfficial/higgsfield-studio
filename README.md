# Studio

Generate images and video from prompts and reference media with Higgsfield
models. A Next.js 16 app: the browser talks to this server, and only the server
talks to the Higgsfield platform.

> Screenshots are not included yet. Run `HF_MOCK=1 pnpm dev` to see every
> screen with no key and no credits.

## What you can do

- Pick image or video, choose a model, write a prompt, attach references
  (upload, paste, drag in; crop and rotate first if you like) and generate.
- Watch runs in an edge-to-edge feed. Failed runs stay as tiles with the reason,
  a Support ID, and Retry. Cancel works on runs still waiting in the platform's queue.
- Open any result in the viewer: zoom and pan, video scrubbing and frame
  stepping, compare with the reference, copy the prompt, JSON or a `curl`.
- Organise with projects (drag a tile onto one), star favourites, download
  one file or a zip, export or wipe everything.

## Setup

1. `pnpm install`
2. `cp .env.example .env.local` and fill in the settings below.
3. `pnpm dev`, open the app and paste your API key into the key dialog.

| Setting                     | Required | What it does                                                                                |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `HF_API_BASE_URL`           | yes      | Address of the Higgsfield platform API. A production build fails without it.                |
| `HF_COOKIE_SECRET`          | no       | 16+ random characters; encrypts the saved API key inside its cookie.                        |
| `HF_MEDIA_HOSTS`            | no       | Space-separated hosts allowed for images, video and uploads. Unset allows any `https` host. |
| `HF_MOCK=1`                 | no       | Demo mode: an in-memory fake platform, no key, no network.                                  |
| `HF_DEBUG=1`                | no       | Logs request bodies on the server (includes prompts). Leave off in production.              |
| `HF_FAIL_ON_PLACEHOLDERS=1` | no       | Fails a production build while sample media (`/presets/*`) is still used.                   |
| `HF_SKIP_ENV_CHECK=1`       | no       | Skips the settings check at build and startup.                                              |

In demo mode put a token in the prompt to see an outcome: `[nsfw]`, `[fail]`,
`[empty]`, `[slow]`, `[ratelimit]`, `[credits]`, `[badkey]` or `[500]`.

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev`         | Dev server (also syncs models)                             |
| `pnpm build`       | Production build                                           |
| `pnpm check`       | Typecheck, lint (no warnings), tests, build                |
| `pnpm models:diff` | Compare installed models with the registry (needs network) |

## Limits worth knowing

- **History lives in this browser.** The newest 400 runs plus every starred
  run, in IndexedDB. Clearing site data erases it; Export first. See
  [docs/storage.md](docs/storage.md).
- **Result links can expire.** Finished images keep a local copy when the host
  allows it; videos do not.
- **Cancel only stops queued jobs.** A running job finishes (and is billed).
- **Two running jobs at a time** across all tabs; up to 20 more wait locally.
- The theme is dark only.

## Documentation

- [Architecture](docs/architecture.md): one diagram and the module map
- [Run lifecycle](docs/run-lifecycle.md): from Generate to a finished tile
- [Adding a model](docs/adding-a-model.md)
- [Error messages](docs/errors.md): what users see and why
- [Privacy](docs/privacy.md): what leaves the browser
- [Browser storage](docs/storage.md): every saved key
- [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · `AGENTS.md` (the rules this project keeps)
