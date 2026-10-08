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

// ponytail: Higgsfield's public API has no account/balance endpoint (checked the
// OpenAPI spec and the billing docs — neither lists one; the only place balance
// shows up is the web dashboard, the `hf` CLI, and an unrelated MCP server tool
// that isn't reachable with a raw API key). So there is no real `credits` number
// to surface here. Don't fake one.

export type Cred = { keyId: string; keySecret: string };

export type ErrShape = { title: string; detail: string };

const ERR: Record<string, ErrShape> = {
  credits: { title: "Not enough credits", detail: "Your Higgsfield account doesn't have enough credits for this generation. No credits were charged." },
  invalidKey: { title: "API key no longer works", detail: "Higgsfield rejected this key. Reconnect it in Settings." },
  blocked: { title: "Model temporarily blocked", detail: "Higgsfield has this model blocked for your account right now. Try again later or pick another model." },
  unavailable: { title: "Model unavailable", detail: "Higgsfield's model is disabled or not ready. Try again shortly." },
  safety: { title: "Blocked by the content filter", detail: "Higgsfield flagged something in this prompt or reference. Rephrase it and try again. No credits were charged." },
  server: { title: "Higgsfield couldn't finish this run", detail: "The server returned an error. This is usually temporary. Your credits were refunded." },
  canceled: { title: "Generation canceled", detail: "This generation was canceled before it finished." },
  unsupported: { title: "Model not connected yet", detail: "This model isn't wired to a real Higgsfield endpoint yet." },
  concurrency: { title: "Too many requests at once", detail: "Higgsfield is limiting requests from this key right now." },
};

// ponytail: Higgsfield has no 429/Retry-After for its concurrency limit — it's a
// plain 400 with a message ("Maximum number of concurrent requests (N) has been
// reached", per their rate-limits doc, which also says they don't publish a
// retry-after value). Detect it by message and give the route a flag so it can
// still answer our own client with a real 429 + a made-up but reasonable wait.
export function isConcurrencyLimit(httpStatus: number, body: any): boolean {
  return httpStatus === 400 && /concurrent/i.test(String(body?.detail || ""));
}
export const ERR_CONCURRENCY = ERR.concurrency;

function errFromStatus(httpStatus: number, body: any): ErrShape {
  if (isConcurrencyLimit(httpStatus, body)) return ERR.concurrency;
  if (httpStatus === 401) return ERR.invalidKey;
  if (httpStatus === 403) return ERR.credits;
  if (httpStatus === 423) return ERR.blocked;
  if (httpStatus === 503) return ERR.unavailable;
  if (httpStatus >= 500) return ERR.server;
  return { title: "Higgsfield rejected this request", detail: String(body?.detail || body?.error || "Invalid parameters.") };
}

async function hf(cred: Cred, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(cred.keyId, cred.keySecret), "User-Agent": USER_AGENT, ...(init.headers || {}) },
  });
  return res;
}

/** Relays one file's bytes to Higgsfield's presigned upload flow and returns its public URL. */
export async function uploadFile(cred: Cred, bytes: Buffer, contentType: string): Promise<string> {
  const genRes = await hf(cred, "/files/generate-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!genRes.ok) throw new Error(`generate-upload-url failed: ${genRes.status}`);
  const { upload_url, upload_headers, public_url } = await genRes.json();
  const put = await fetch(upload_url, { method: "PUT", headers: upload_headers, body: new Uint8Array(bytes) });
  if (!put.ok) throw new Error(`upload PUT failed: ${put.status}`);
  return public_url as string;
}

export type RefInput = { url: string; kind: string; tag?: string };
export type CreateJob = {
  type: "image" | "video";
  model: string;
  prompt: string;
  negative?: string;
  ratio: string;
  res?: string;
  duration?: number;
  audio?: boolean;
  refs: RefInput[];
};

type CreateResult = { requestId: string } | { error: ErrShape };

// ponytail: Higgsfield has one HTTP endpoint PER MODEL (and a different one again
// for the text-only vs reference-image variant of the same model), not one
// generic "create a generation" call — confirmed against the official OpenAPI
// spec and per-model reference docs. Only the four models below (soul, seedance,
// kling, minimax) have a verified real endpoint; the rest of the catalog in
// server/src/routes/models.ts is real (checked against open.higgsfield.ai/explore)
// but schema-unverified, and falls through to ERR.unsupported here — better to
// say so than to guess a path and silently waste the user's credits on a
// malformed call.
async function createOne(cred: Cred, job: CreateJob): Promise<CreateResult> {
  let res: Response;
  if (job.model === "soul") {
    const resolution = job.res === "4K" ? "4K" : "2K"; // soul only ships 2K/4K
    res = await hf(cred, "/higgsfield-ai/soul/standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: job.prompt, num_images: 1, resolution, aspect_ratio: job.ratio }),
    });
  } else if (job.model === "seedance") {
    const images = job.refs.filter((r) => r.kind === "image").map((r) => r.url);
    const videos = job.refs.filter((r) => r.kind === "video").map((r) => r.url);
    const path = images.length || videos.length ? "/bytedance/seedance-2.0/reference-to-video" : "/bytedance/seedance-2.0/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration || 5, resolution: job.res || "720p", aspect_ratio: job.ratio, generate_audio: !!job.audio };
    if (images.length) body.image_urls = images.slice(0, 9);
    if (videos.length) body.video_urls = videos.slice(0, 3);
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else if (job.model === "kling") {
    // kling-video takes one image_url, not an array — first image ref wins (Start frame, if tagged).
    const img = job.refs.find((r) => r.kind === "image");
    const path = img ? "/kling-video/v2.5-turbo/pro/image-to-video" : "/kling-video/v2.5-turbo/pro/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration === 10 ? 10 : 5 };
    if (job.negative) body.negative_prompt = job.negative;
    if (img) body.image_url = img.url;
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else if (job.model === "minimax") {
    // hailuo-2.3/standard: confirmed via the OpenAPI spec. duration is 6|10 (not 5|10 like kling) —
    // prompt_optimizer has no UI control, left at the API's own default (true).
    const img = job.refs.find((r) => r.kind === "image");
    const path = img ? "/minimax/hailuo-2.3/standard/image-to-video" : "/minimax/hailuo-2.3/standard/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration === 10 ? 10 : 6, prompt_optimizer: true };
    if (img) body.image_url = img.url;
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else {
    return { error: ERR.unsupported };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: errFromStatus(res.status, body) };
  }
  const data = await res.json();
  return { requestId: data.request_id as string };
}

/** Creates `count` Higgsfield requests for one generation (soul alone could batch via num_images, but
 * kept to one request per item for all models — simplest uniform path, see ponytail note above). */
export async function createMany(cred: Cred, job: CreateJob, count: number): Promise<CreateResult[]> {
  const out: CreateResult[] = [];
  for (let i = 0; i < count; i++) out.push(await createOne(cred, job));
  return out;
}

export type StatusResult =
  | { status: "pending" }
  | { status: "completed"; url: string }
  | { status: "failed"; error: ErrShape };

export async function getStatus(cred: Cred, requestId: string): Promise<StatusResult> {
  const res = await hf(cred, `/requests/${requestId}/status`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { status: "failed", error: errFromStatus(res.status, body) };
  }
  const d = await res.json();
  if (d.status === "queued" || d.status === "in_progress") return { status: "pending" };
  if (d.status === "completed") {
    const url = d.images?.[0]?.url || d.video?.url || d.audio?.url || d.audios?.[0]?.url;
    if (!url) return { status: "failed", error: ERR.server };
    return { status: "completed", url };
  }
  if (d.status === "nsfw") return { status: "failed", error: ERR.safety };
  if (d.status === "canceled") return { status: "failed", error: ERR.canceled };
  return { status: "failed", error: d.error ? { title: "Higgsfield couldn't finish this run", detail: String(d.error) } : ERR.server };
}

export async function cancelRequest(cred: Cred, requestId: string): Promise<void> {
  await hf(cred, `/requests/${requestId}/cancel`, { method: "POST" }).catch(() => {});
}
