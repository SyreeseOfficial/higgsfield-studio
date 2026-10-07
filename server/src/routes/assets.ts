import { Router } from "express";
import { db } from "../db.js";

export const assetsRouter = Router();
export const countsRouter = Router();

type Filters = { view: string; fType: string; fModel: string; fProject: string; fFav: string; fRatio: string; q: string };

function parseFilters(q: any): Filters {
  return {
    view: String(q.view || "assets"),
    fType: String(q.fType || "all"),
    fModel: String(q.fModel || "all"),
    fProject: String(q.fProject || "all"),
    fFav: String(q.fFav || "all"),
    fRatio: String(q.fRatio || "all"),
    q: String(q.q || ""),
  };
}

// ponytail: FTS5 is a tokenized prefix index, not the client's substring .includes() scan —
// AND-ing a "*"-suffixed prefix match per word is the standard, good-enough translation.
function ftsQuery(q: string): string {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean).map((w) => `"${w.replace(/"/g, '""')}"*`);
  return terms.length ? terms.join(" AND ") : '""';
}

// Mirrors the client's assetMatch()/queryAssets() exactly: Favorites ignores every other filter
// and always sorts newest-first. Matching this precisely matters because the client re-filters
// whatever ids we return (gridList in App.tsx) against its own copy of assetMatch() — any
// mismatch would silently drop an item from the grid instead of erroring.
function buildQuery(f: Filters, sort: string): { sql: string; params: any[] } {
  const where: string[] = ["generations.status = 'completed'"];
  const params: any[] = [];

  if (f.view === "favorites") {
    where.push("items.fav = 1");
    return {
      sql: `SELECT items.id AS item_id FROM items JOIN generations ON generations.id = items.generation_id WHERE ${where.join(" AND ")} ORDER BY generations.created_at DESC`,
      params,
    };
  }

  if (f.fType !== "all") { where.push("generations.type = ?"); params.push(f.fType); }
  if (f.fModel !== "all") { where.push("generations.model = ?"); params.push(f.fModel); }
  if (f.fProject !== "all") { where.push("generations.project = ?"); params.push(f.fProject); }
  if (f.fFav === "fav") where.push("items.fav = 1");
  else if (f.fFav === "unfav") where.push("items.fav = 0");
  if (f.fRatio !== "all") { where.push("generations.ratio = ?"); params.push(f.fRatio); }
  if (f.q.trim()) {
    where.push("generations.id IN (SELECT id FROM generations_fts WHERE generations_fts MATCH ?)");
    params.push(ftsQuery(f.q));
  }

  // "model"/"type" sort by the raw id string (no server-side display-name catalog to sort by —
  // see TODO.md's separate "Models and pricing" section); "project" has a real name to join on.
  const orderBy =
    sort === "old" ? "generations.created_at ASC" :
    sort === "fav" ? "items.fav DESC, generations.created_at DESC" :
    sort === "model" ? "generations.model ASC, generations.created_at DESC" :
    sort === "project" ? "COALESCE(projects.name, '') ASC, generations.created_at DESC" :
    sort === "type" ? "generations.type ASC, generations.created_at DESC" :
    "generations.created_at DESC";

  return {
    sql: `SELECT items.id AS item_id FROM items
          JOIN generations ON generations.id = items.generation_id
          LEFT JOIN projects ON projects.id = generations.project
          WHERE ${where.join(" AND ")} ORDER BY ${orderBy}`,
    params,
  };
}

assetsRouter.get("/ids", (req, res) => {
  const { sql, params } = buildQuery(parseFilters(req.query), String(req.query.sort || "new"));
  const rows = db.prepare(sql).all(...params) as { item_id: string }[];
  res.json(rows.map((r) => r.item_id));
});

assetsRouter.get("/", (req, res) => {
  const { sql, params } = buildQuery(parseFilters(req.query), String(req.query.sort || "new"));
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params) as { n: number }).n;
  const offset = req.query.cursor ? Number(req.query.cursor) : 0;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 24));
  const rows = db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...params, limit, offset) as { item_id: string }[];
  const nextCursor = offset + rows.length < total ? String(offset + rows.length) : null;
  res.json({ ids: rows.map((r) => r.item_id), nextCursor, total });
});

countsRouter.get("/", (_req, res) => {
  const assets = (db.prepare(
    `SELECT COUNT(*) AS n FROM items JOIN generations ON generations.id = items.generation_id WHERE generations.status = 'completed'`
  ).get() as { n: number }).n;
  const favorites = (db.prepare(
    `SELECT COUNT(*) AS n FROM items JOIN generations ON generations.id = items.generation_id WHERE generations.status = 'completed' AND items.fav = 1`
  ).get() as { n: number }).n;
  const uploads = (db.prepare(`SELECT COUNT(*) AS n FROM uploads`).get() as { n: number }).n;
  const uploadBytes = (db.prepare(`SELECT COALESCE(SUM(size), 0) AS n FROM uploads`).get() as { n: number }).n;
  const projectRows = db.prepare(
    `SELECT generations.project AS pid, COUNT(*) AS n FROM items JOIN generations ON generations.id = items.generation_id
     WHERE generations.status = 'completed' AND generations.project IS NOT NULL GROUP BY generations.project`
  ).all() as { pid: string; n: number }[];
  const projects: Record<string, number> = {};
  projectRows.forEach((r) => { projects[r.pid] = r.n; });
  res.json({ assets, favorites, uploads, uploadBytes, projects });
});
