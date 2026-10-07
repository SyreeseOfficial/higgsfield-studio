const BASE = "https://api.higgsfield.ai";
const USER_AGENT = "higgsfield-studio/0.1";

export function authHeader(keyId: string, keySecret: string): string {
  return `Key ${keyId}:${keySecret}`;
}

// ponytail: Higgsfield has no account/validate endpoint. GET /requests/{id}/status
// on a random id returns 401 for bad credentials and 404 ("not found for this
// account") for good ones — zero-cost way to check a key. Swap for a real
// validate/balance endpoint if Higgsfield ever ships one.
export async function validateKey(keyId: string, keySecret: string): Promise<boolean> {
  const probeId = crypto.randomUUID();
  const res = await fetch(`${BASE}/requests/${probeId}/status`, {
    headers: {
      Authorization: authHeader(keyId, keySecret),
      "User-Agent": USER_AGENT,
    },
  });
  if (res.status === 401) return false;
  return true;
}
