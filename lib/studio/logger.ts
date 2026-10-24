/**
 * The one place browser code writes to the console. It logs a scope plus the
 * error's name and message and nothing else, so a prompt, reference URL or
 * signed upload URL can never reach the console by accident (ESLint bans
 * `console` everywhere else).
 */
export function logError(scope: string, error: unknown, detail?: string): void {
  const what =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "non-error value thrown"
  console.error(`[${scope}] ${what}${detail ? `\n${detail}` : ""}`)
}
