Read PHASES.md and FINDINGS.md. Find the first phase not marked ☑ (resume any ◐ phase).
Work on that ONE phase only:

1. Read CLAUDE.md/AGENTS.md rules and the code each item touches before editing.
2. Do every unticked item in the phase. Skip items tagged ⛔ (they need my answer).
3. Tests must be free: never call the real Higgsfield API or spend credits.
4. Tick finished items in BOTH PHASES.md and FINDINGS.md; set the phase status to ☑ in the table.
5. Run `pnpm typecheck` and `pnpm build`. Both must pass (no `any`, `@ts-ignore`, `@ts-expect-error`).
6. If all pass: commit (clear message) and push. Then move on to the next phase and repeat.
7. If you hit an error, a question, or need me: stop and ask. Move the item to
   "Waiting on your decision" in FINDINGS.md and tag it ⛔ in PHASES.md.

Never hand-edit generation/catalog/models.generated.ts. Don't commit unrelated changes.
