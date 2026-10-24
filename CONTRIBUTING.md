# Contributing

- `pnpm install` enables the pre-commit hook (typecheck + lint).
- Before opening a PR: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Read `AGENTS.md` first: it lists the server boundary, the dark-only theme and
  the other rules this project keeps.
- Adding a model: see [docs/adding-a-model.md](docs/adding-a-model.md).
- `/dev/components` (dev server only) renders tile states without generating.
