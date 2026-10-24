/** What server actions return instead of throwing: production masks the message of a thrown error. */
export type Result<T = void> =
  { ok: true; value: T } | { ok: false; error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export function fail(caught: unknown): { ok: false; error: string } {
  return {
    ok: false,
    error: caught instanceof Error ? caught.message : String(caught),
  }
}
