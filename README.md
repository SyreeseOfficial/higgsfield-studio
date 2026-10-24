# Studio

Generate images and video from prompts and reference media with Higgsfield
models. A Next.js 16 app: the browser talks to this server, and only the server
talks to the Higgsfield platform.

## Setup

1. `pnpm install`
2. `cp .env.example .env.local` and set `HF_API_BASE_URL` to the platform API base URL.
3. `pnpm dev`, then open the app and paste your API key into the key dialog.

| Command          | What it does                      |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Dev server (also syncs models)    |
| `pnpm build`     | Production build                  |
| `pnpm typecheck` | `tsc --noEmit`                    |
| `pnpm lint`      | ESLint                            |
| `pnpm test`      | Vitest (catalog, polling, layout) |

## API key

The key is saved in an `httpOnly` cookie (30 days, per browser) by a server
action. Browser code never sees it, and every authenticated platform call runs
on the server. Set `HF_DEBUG=1` to log request bodies server-side; they include
prompts, so leave it off in production.

## Where data lives

Nothing is stored on the server. Generation history is in IndexedDB; projects,
uploaded reference URLs, settings and the active model are in `localStorage`.
Clearing site data erases them.

## Models

Each model is one file in `generation/catalog/models/`. Add one with
`pnpm dlx shadcn@latest add higgsfield-ai/app-templates/<model>` or by dropping
a file there; the dev server regenerates `models.generated.ts` (never edit it
by hand). `pnpm test` builds a request from the defaults of every installed
model, so a broken model file fails fast.

See `AGENTS.md` for the architecture and the rules this project keeps.
