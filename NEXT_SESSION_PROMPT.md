All 16 phases in PHASES.md are done. Only the items under "Blocked on you" remain, and each needs my answer first:

- Check the API key when it is saved (needs Higgsfield's response to a safe test request)
- Credit balance and pre-run warning (needs the balance endpoint, is it free?)
- Session spend counter (needs credit prices per model)
- "Not charged" note on failed runs (needs to know which failures are refunded)
- Run-controller and screen tests (approve the jsdom + @testing-library/react dev add-on)
- Auto-convert iPhone photos (HEIC): approve the ~1 MB add-on, or keep the current message
- Replace placeholder media (needs brand direction and images)
- Store small thumbnails (needs confirmation that Higgsfield's servers allow it)

Read CLAUDE.md/AGENTS.md first. Ask me which one to start. Tests must be free: never call the real Higgsfield API.
Run `pnpm typecheck` and `pnpm build`; both must pass.
