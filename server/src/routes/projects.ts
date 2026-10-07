import { Router } from "express";
import { db } from "../db.js";

export const projectsRouter = Router();

type ProjectRow = { id: string; name: string; emoji: string | null; sort: number };

projectsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT id, name, emoji FROM projects ORDER BY sort ASC").all() as ProjectRow[];
  res.json(rows);
});

// Client sends the whole reordered/renamed/added/removed list after every project mutation — simplest
// way to persist create/rename/delete/reorder without turning four existing client methods into
// individual REST calls with optimistic-rollback handling (see TODO.md's "Persistence" item).
projectsRouter.put("/", (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  db.transaction(() => {
    db.prepare("DELETE FROM projects").run();
    const insert = db.prepare("INSERT INTO projects (id, name, emoji, sort) VALUES (?, ?, ?, ?)");
    list.forEach((p: any, i: number) => insert.run(String(p.id), String(p.name || ""), p.emoji || null, i));
  })();
  res.json(list);
});
