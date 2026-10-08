import { Router } from "express";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { db } from "../db.js";
import { readStoredKey } from "./key.js";
import { createMany, getStatus, cancelRequest, uploadFile, ERR_CONCURRENCY, type RefInput, type ErrShape } from "../higgsfield.js";

export const generationsRouter = Router();

// ponytail: in-memory last-submission fingerprint, not a persisted idempotency-key table — this is
// a safety net for an accidental double-click/double-Enter within a few seconds, not a distributed
// de-dup system. Single-user local server, one process, restart clears it (fine).
const DEDUP_WINDOW_MS = 4000;
let lastSubmit: { hash: string; at: number } | null = null;

const MEDIA_DIR = new URL("../../data/media/", import.meta.url).pathname;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
};

/** Reads a local /media/... url straight off disk — both uploads and saved generation outputs
 * live under MEDIA_DIR, so there's no need for a self HTTP round trip to fetch our own files. */
function readLocalMedia(url: string): { buffer: Buffer; contentType: string } {
  const rel = url.replace(/^\/media\//, "");
  const path = `${MEDIA_DIR}${rel}`;
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return { buffer: readFileSync(path), contentType: EXT_MIME[ext] || "application/octet-stream" };
}

type GenRow = {
  id: string; project: string | null; type: string; model: string; prompt: string; negative: string | null;
  ratio: string; res: string | null; fmt: string | null; duration: number | null; audio: number; batch: number;
  status: string; error_title: string | null; error_detail: string | null; created_at: number;
};
type ItemRow = { id: string; generation_id: string; hf_request_id: string | null; seed: string; status: string; url: string | null; fav: number };
type RefRow = { generation_id: string; url: string; kind: string; name: string | null; tag: string | null; upload_id: string | null };

function fullGen(row: GenRow) {
  const items = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(row.id) as ItemRow[];
  const refs = db.prepare("SELECT url, kind, name, tag, upload_id FROM generation_refs WHERE generation_id = ?").all(row.id) as RefRow[];
  return {
    id: row.id, project: row.project, type: row.type, model: row.model, prompt: row.prompt, negative: row.negative || "",
    ratio: row.ratio, res: row.res, fmt: row.fmt, duration: row.duration, audio: !!row.audio, batch: row.batch,
    t: row.created_at, status: row.status, error: row.error_title ? { title: row.error_title, detail: row.error_detail } : null,
    refs: refs.map((r) => ({ url: r.url, kind: r.kind, name: r.name, tag: r.tag || "" })),
    items: items.map((it) => ({ id: it.id, seed: it.seed, fav: !!it.fav, status: it.status, url: it.url })),
  };
}

generationsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM generations ORDER BY created_at ASC").all() as GenRow[];
  res.json(rows.map(fullGen));
});

type RefInputBody = { uploadId?: string; url?: string; kind: string; tag?: string; name?: string };

generationsRouter.post("/", async (req, res) => {
  const cred = readStoredKey();
  if (!cred) return res.status(401).json({ error: { title: "Connect your API key", detail: "Connect a Higgsfield API key in Settings before generating." } });

  const meta: any = req.body || {};
  const batch = Math.max(1, Math.min(10, Number(meta.batch) || 1));
  const refInputs: RefInputBody[] = Array.isArray(meta.refs) ? meta.refs : [];

  // Reject an exact repeat of the last-accepted submission within DEDUP_WINDOW_MS — catches a
  // double-click/double-Enter reaching the server, not just the UI-level guard in App.tsx.
  const hash = createHash("sha1").update(JSON.stringify({
    type: meta.type, model: meta.model, prompt: meta.prompt, negative: meta.negative,
    ratio: meta.ratio, res: meta.res, duration: meta.duration, batch, refs: refInputs,
  })).digest("hex");
  const now0 = Date.now();
  if (lastSubmit && lastSubmit.hash === hash && now0 - lastSubmit.at < DEDUP_WINDOW_MS) {
    return res.status(409).json({ error: { title: "Already submitting", detail: "This generation was just submitted — give it a moment." } });
  }
  lastSubmit = { hash, at: now0 };

  // Refs arrive as either an uploadId (from the Uploads library / a fresh composer attach, which
  // now always lands in the uploads table first) or a bare local url (reusing an existing Assets
  // output as a reference). Resolve both to a LOCAL, persistent url + bytes: the local url is what
  // we store and show the user (so a lightbox/composer chip survives a refresh and doesn't depend
  // on Higgsfield's ephemeral hosting), the bytes get relayed through Higgsfield's presigned upload
  // flow (uploadFile) purely to get something *their* generation endpoints can fetch for this one
  // request — that result is never persisted.
  let resolvedRefs: { url: string; kind: string; name: string | null; tag: string | null; uploadId: string | null }[];
  let hfRefs: RefInput[];
  try {
    resolvedRefs = refInputs.map((r) => {
      if (r.uploadId) {
        const row = db.prepare("SELECT path, name FROM uploads WHERE id = ?").get(r.uploadId) as { path: string; name: string } | undefined;
        if (!row) throw new Error("upload not found");
        return { url: `/media/uploads/${row.path.split("/").pop()}`, kind: r.kind, name: row.name, tag: r.tag || null, uploadId: r.uploadId };
      }
      if (r.url) return { url: r.url, kind: r.kind, name: r.name || null, tag: r.tag || null, uploadId: null };
      throw new Error("ref needs uploadId or url");
    });
    hfRefs = await Promise.all(resolvedRefs.map(async (r) => {
      const { buffer, contentType } = readLocalMedia(r.url);
      const url = await uploadFile(cred, buffer, contentType);
      return { url, kind: r.kind, tag: r.tag || undefined };
    }));
  } catch {
    return res.status(502).json({ error: { title: "Couldn't attach reference", detail: "Higgsfield didn't accept one of the attached files. Try again." } });
  }

  const job = { type: meta.type, model: meta.model, prompt: meta.prompt, negative: meta.negative, ratio: meta.ratio, res: meta.res, duration: meta.duration, audio: meta.audio, refs: hfRefs };
  const results = await createMany(cred, job, batch);
  const firstError = results.find((r) => "error" in r) as { error: ErrShape } | undefined;
  if (firstError) {
    // best-effort: cancel whatever already got queued before the failure
    await Promise.all(results.filter((r) => "requestId" in r).map((r) => cancelRequest(cred, (r as { requestId: string }).requestId)));
    if (firstError.error === ERR_CONCURRENCY) res.set("Retry-After", "15");
    return res.status(firstError.error === ERR_CONCURRENCY ? 429 : 400).json({ error: firstError.error });
  }

  const id = "g" + Date.now() + Math.random().toString(36).slice(2, 7);
  const now = Date.now();
  const insertGen = db.prepare(
    `INSERT INTO generations (id, project, type, model, prompt, negative, ratio, res, fmt, duration, audio, batch, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  );
  const insertItem = db.prepare(`INSERT INTO items (id, generation_id, hf_request_id, seed, status) VALUES (?, ?, ?, ?, 'pending')`);
  const insertRef = db.prepare(`INSERT INTO generation_refs (generation_id, url, kind, name, tag, upload_id) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertFts = db.prepare(`INSERT INTO generations_fts (id, prompt) VALUES (?, ?)`);
  db.transaction(() => {
    insertGen.run(id, meta.project || null, meta.type, meta.model, meta.prompt, meta.negative || null, meta.ratio, meta.res || null, meta.fmt || null, meta.duration || null, meta.audio ? 1 : 0, batch, now);
    results.forEach((r, i) => insertItem.run(id + "-" + i, id, (r as { requestId: string }).requestId, id + "x" + i));
    resolvedRefs.forEach((r) => insertRef.run(id, r.url, r.kind, r.name, r.tag, r.uploadId));
    insertFts.run(id, meta.prompt);
  })();

  res.json({ id });
});

generationsRouter.get("/:id", async (req, res) => {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(req.params.id) as GenRow | undefined;
  if (!row) return res.status(404).json({ error: { title: "Not found", detail: "This generation doesn't exist." } });

  if (row.status === "pending") {
    const cred = readStoredKey();
    const items = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(row.id) as ItemRow[];
    if (cred) {
      for (const it of items) {
        if (it.status !== "pending" || !it.hf_request_id) continue;
        const s = await getStatus(cred, it.hf_request_id);
        if (s.status === "pending") continue;
        if (s.status === "completed") {
          const localUrl = await saveOutput(row.id, it.id, s.url);
          db.prepare("UPDATE items SET status = 'completed', url = ? WHERE id = ?").run(localUrl, it.id);
        } else {
          db.prepare("UPDATE items SET status = 'failed' WHERE id = ?").run(it.id);
          db.prepare("UPDATE generations SET status = 'failed', error_title = ?, error_detail = ? WHERE id = ?").run(s.error.title, s.error.detail, row.id);
        }
      }
    }
    const refreshed = db.prepare("SELECT * FROM generations WHERE id = ?").get(row.id) as GenRow;
    const liveItems = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(row.id) as ItemRow[];
    if (refreshed.status === "pending" && liveItems.length && liveItems.every((it) => it.status === "completed")) {
      db.prepare("UPDATE generations SET status = 'completed' WHERE id = ?").run(row.id);
    }
    return res.json(fullGen(db.prepare("SELECT * FROM generations WHERE id = ?").get(row.id) as GenRow));
  }
  res.json(fullGen(row));
});

// Path is /items/fav, not /:id/fav, since a favorite is per-item, not per-generation, and a bulk
// toggle (Assets/Favorites multi-select) hits several items across different generations at once.
generationsRouter.patch("/items/fav", (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const fav = !!req.body?.fav;
  const stmt = db.prepare("UPDATE items SET fav = ? WHERE id = ?");
  db.transaction(() => ids.forEach((id) => stmt.run(fav ? 1 : 0, id)))();
  res.status(204).end();
});

generationsRouter.delete("/:id", async (req, res) => {
  const cred = readStoredKey();
  const items = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(req.params.id) as ItemRow[];
  if (cred) await Promise.all(items.filter((it) => it.hf_request_id).map((it) => cancelRequest(cred, it.hf_request_id!)));
  db.transaction(() => {
    db.prepare("DELETE FROM items WHERE generation_id = ?").run(req.params.id);
    db.prepare("DELETE FROM generation_refs WHERE generation_id = ?").run(req.params.id);
    db.prepare("DELETE FROM generations_fts WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM generations WHERE id = ?").run(req.params.id);
  })();
  res.status(204).end();
});

async function saveOutput(genId: string, itemId: string, remoteUrl: string): Promise<string> {
  const r = await fetch(remoteUrl);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = (r.headers.get("content-type") || "application/octet-stream").split("/")[1]?.split(";")[0] || "bin";
  const path = `${MEDIA_DIR}${genId}/${itemId}.${ext}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return `/media/${genId}/${itemId}.${ext}`;
}
