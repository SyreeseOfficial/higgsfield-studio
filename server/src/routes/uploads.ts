import { Router } from "express";
import multer from "multer";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { db } from "../db.js";

export const uploadsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const UPLOADS_DIR = new URL("../../data/media/uploads/", import.meta.url).pathname;
mkdirSync(UPLOADS_DIR, { recursive: true });

type UploadRow = {
  id: string; kind: string; name: string; size: number; w: number | null; h: number | null;
  dur: number | null; created_at: number; path: string; hash: string | null;
};

function toJson(row: UploadRow, usage: number) {
  return {
    id: row.id, kind: row.kind, name: row.name, size: row.size, w: row.w, h: row.h, dur: row.dur,
    t: row.created_at, url: `/media/uploads/${row.path.split("/").pop()}`, usage, hash: row.hash,
  };
}

uploadsRouter.post("/", upload.single("file"), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: { title: "No file", detail: "No file was attached." } });
  const kind = f.mimetype.startsWith("video") ? "video" : f.mimetype.startsWith("audio") ? "audio" : "image";
  const id = "up" + Date.now() + Math.random().toString(36).slice(2, 7);
  const ext = (f.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${UPLOADS_DIR}${id}.${ext}`;
  writeFileSync(path, f.buffer);
  const hash = createHash("sha256").update(f.buffer).digest("hex");

  // Dimensions/duration come from the client, which already computes them (imgDims()/mediaMeta())
  // before upload — no image/video processing library needed server-side just to re-derive them.
  const w = req.body.w ? Number(req.body.w) : null;
  const h = req.body.h ? Number(req.body.h) : null;
  const dur = req.body.dur ? Number(req.body.dur) : null;
  const created_at = Date.now();

  db.prepare(`INSERT INTO uploads (id, kind, name, size, w, h, dur, created_at, path, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, kind, f.originalname, f.size, w, h, dur, created_at, path, hash);

  res.json(toJson({ id, kind, name: f.originalname, size: f.size, w, h, dur, created_at, path, hash }, 0));
});

// ponytail: filters all in one query, then paginate in JS. The usage filter needs a HAVING clause
// on a GROUP BY count, which doesn't compose cleanly with a SQL-level LIMIT/OFFSET — and a single
// user's upload library is small enough that slicing an already-fetched array is simpler and still
// correct, not a real performance concern.
uploadsRouter.get("/", (req, res) => {
  const type = String(req.query.type || "all");
  const usage = String(req.query.usage || "all");
  const q = String(req.query.q || "").trim().toLowerCase();
  const sort = String(req.query.sort || "new");

  const where: string[] = [];
  const params: any[] = [];
  if (type !== "all") { where.push("uploads.kind = ?"); params.push(type); }
  if (q) { where.push("LOWER(uploads.name) LIKE ?"); params.push(`%${q}%`); }
  const having = usage === "used" ? "HAVING usage_count > 0" : usage === "unused" ? "HAVING usage_count = 0" : "";
  const orderBy =
    sort === "old" ? "uploads.created_at ASC" :
    sort === "large" ? "uploads.size DESC" :
    sort === "name" ? "uploads.name ASC" :
    "uploads.created_at DESC";

  const rows = db.prepare(`
    SELECT uploads.*, COUNT(generation_refs.id) AS usage_count
    FROM uploads
    LEFT JOIN generation_refs ON generation_refs.upload_id = uploads.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY uploads.id
    ${having}
    ORDER BY ${orderBy}
  `).all(...params) as (UploadRow & { usage_count: number })[];

  const offset = req.query.cursor ? Number(req.query.cursor) : 0;
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
  const page = rows.slice(offset, offset + limit);
  const nextCursor = offset + page.length < rows.length ? String(offset + page.length) : null;
  res.json({ items: page.map((r) => toJson(r, r.usage_count)), nextCursor, total: rows.length });
});

uploadsRouter.delete("/", (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(204).end();
  const placeholders = ids.map(() => "?").join(",");
  // Safe to hard-delete: generation_refs.url is always the persistent local url (see generations.ts),
  // never this upload's row — a generation that used this file keeps working after it's gone from the
  // library. No "soft delete to protect past generations" problem to solve.
  const rows = db.prepare(`SELECT path FROM uploads WHERE id IN (${placeholders})`).all(...ids) as { path: string }[];
  db.prepare(`DELETE FROM uploads WHERE id IN (${placeholders})`).run(...ids);
  rows.forEach((r) => { try { unlinkSync(r.path); } catch { /* already gone */ } });
  res.status(204).end();
});
