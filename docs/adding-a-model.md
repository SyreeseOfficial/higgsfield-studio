# Adding a model

Each model is one file in `generation/catalog/models/`. The picker, settings
dialog and request mapping are all driven by that file.

1. Add it with the registry command, or write the file by hand:

   ```bash
   pnpm dlx shadcn@latest add higgsfield-ai/app-templates/<model>
   ```

2. Fill in the `ModelEntry`: `id` (the platform path segment), `surface`
   (`image` or `video`), `label`, `roles` (which media inputs it takes and how
   many), `settings` (enum / range / boolean, each with a default), and either
   `paths` (shared mapper) or `toPlatform` (custom body).
3. The dev server (`pnpm dev`) and `next build` run `scripts/sync-models.mjs`,
   which regenerates `generation/catalog/models.generated.ts` and the registry
   barrel. Never edit those by hand.
4. Run `pnpm test`. The catalog test builds a request from the defaults of every
   model and input mode, so a broken mapping fails here instead of at the platform.
5. Open the app and check the model appears in its surface's picker. Try it
   without credits: `HF_MOCK=1 pnpm dev` runs the whole flow against a fake platform.
6. `generation/catalog/models.generated.ts` also exports a `ModelId` union of
   every installed id. Use it where an id is written by hand (templates, tests)
   so a typo fails the build. `tests/models.test.ts` checks icons, ids, defaults
   and picker order.
7. `pnpm models:diff` lists models that are new, removed or changed in the
   registry since you installed yours.

Keep every installed model; remove one only when asked.
