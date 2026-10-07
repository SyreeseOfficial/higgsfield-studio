import { Router } from "express";
import multer from "multer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { db } from "../db.js";
import { readStoredKey } from "./key.js";
import { createMany, getStatus, cancelRequest, uploadFile, ERR_CONCURRENCY, type RefInput, type ErrShape } from "../higgsfield.js";

export const generationsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const MEDIA_DIR = new URL("../../data/media/", import.meta.url).pathname;

type GenRow = {
  id: string; project: string | null; type: string; model: string; prompt: string; negative: string | null;
  ratio: string; res: string | null; fmt: string | null; duration: number | null; audio: number; batch: number;
  status: string; error_title: string | null; error_detail: string | null; created_at: number;
};
type ItemRow = { id: string; generation_id: string; hf_request_id: string | null; seed: string; status: string; url: string | null; fav: number };
type RefRow = { generation_id: string; url: string; kind: string; name: string | null; tag: string | null };

function fullGen(row: GenRow) {
  const items = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(row.id) as ItemRow[];
  const refs = db.prepare("SELECT url, kind, name, tag FROM generation_refs WHERE generation_id = ?").all(row.id) as RefRow[];
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

generationsRouter.post("/", upload.array("files"), async (req, res) => {
  const cred = readStoredKey();
  if (!cred) return res.status(401).json({ error: { title: "Connect your API key", detail: "Connect a Higgsfield API key in Settings before generating." } });

  let meta: any, refMeta: { kind: string; name: string; tag?: string }[];
  try {
    meta = JSON.parse(String(req.body?.meta ?? "{}"));
    refMeta = JSON.parse(String(req.body?.refMeta ?? "[]"));
  } catch {
    return res.status(400).json({ error: { title: "Bad request", detail: "Malformed generation payload." } });
  }
  const batch = Math.max(1, Math.min(10, Number(meta.batch) || 1));
  const files = (req.files as Express.Multer.File[] | undefined) || [];

  // Upload any attached references to Higgsfield first — their endpoints need a URL they can fetch,
  // and nothing here is reachable from outside this machine.
  let refs: RefInput[] = [];
  try {
    refs = await Promise.all(
      files.map(async (f, i) => ({ url: await uploadFile(cred, f.buffer, f.mimetype), kind: refMeta[i]?.kind || "image", tag: refMeta[i]?.tag }))
    );
  } catch {
    return res.status(502).json({ error: { title: "Couldn't upload reference", detail: "Higgsfield didn't accept one of the attached files. Try again." } });
  }

  const job = { type: meta.type, model: meta.model, prompt: meta.prompt, negative: meta.negative, ratio: meta.ratio, res: meta.res, duration: meta.duration, audio: meta.audio, refs };
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
  const insertRef = db.prepare(`INSERT INTO generation_refs (generation_id, url, kind, name, tag) VALUES (?, ?, ?, ?, ?)`);
  db.transaction(() => {
    insertGen.run(id, meta.project || null, meta.type, meta.model, meta.prompt, meta.negative || null, meta.ratio, meta.res || null, meta.fmt || null, meta.duration || null, meta.audio ? 1 : 0, batch, now);
    results.forEach((r, i) => insertItem.run(id + "-" + i, id, (r as { requestId: string }).requestId, id + "x" + i));
    refs.forEach((r) => insertRef.run(id, r.url, r.kind, (r as any).name || null, r.tag || null));
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

generationsRouter.delete("/:id", async (req, res) => {
  const cred = readStoredKey();
  const items = db.prepare("SELECT * FROM items WHERE generation_id = ?").all(req.params.id) as ItemRow[];
  if (cred) await Promise.all(items.filter((it) => it.hf_request_id).map((it) => cancelRequest(cred, it.hf_request_id!)));
  db.transaction(() => {
    db.prepare("DELETE FROM items WHERE generation_id = ?").run(req.params.id);
    db.prepare("DELETE FROM generation_refs WHERE generation_id = ?").run(req.params.id);
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
