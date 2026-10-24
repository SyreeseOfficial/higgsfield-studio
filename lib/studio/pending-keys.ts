/** Idempotency keys for submits whose outcome is unknown, so retrying the same
    request cannot create a second paid job. Oldest entries are forgotten past `max`. */
export class PendingKeys {
  private keys = new Map<string, string>()

  constructor(private readonly max = 20) {}

  /** The key to send: the one from an earlier attempt of this exact request, else a new one. */
  keyFor(fingerprint: string, make: () => string): string {
    const key = this.keys.get(fingerprint) ?? make()
    this.keys.delete(fingerprint) // re-insert last: Map order is recency
    this.keys.set(fingerprint, key)
    if (this.keys.size > this.max)
      this.keys.delete(this.keys.keys().next().value!)
    return key
  }

  /** The platform answered for certain (accepted or refused): the next attempt is a new request. */
  settle(fingerprint: string): void {
    this.keys.delete(fingerprint)
  }
}
