import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = new URL("../data/studio.db", import.meta.url).pathname;
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS api_key (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    iv BLOB NOT NULL,
    tag BLOB NOT NULL,
    data BLOB NOT NULL,
    last4 TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    sort INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    project TEXT,
    type TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    negative TEXT,
    ratio TEXT NOT NULL,
    res TEXT,
    fmt TEXT,
    duration INTEGER,
    audio INTEGER NOT NULL DEFAULT 0,
    batch INTEGER NOT NULL,
    status TEXT NOT NULL, -- pending | completed | failed
    error_title TEXT,
    error_detail TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id),
    hf_request_id TEXT,
    seed TEXT NOT NULL,
    status TEXT NOT NULL, -- pending | completed | failed
    url TEXT,
    fav INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS generation_refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT NOT NULL REFERENCES generations(id),
    url TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT,
    tag TEXT,
    upload_id TEXT
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    w INTEGER,
    h INTEGER,
    dur INTEGER,
    created_at INTEGER NOT NULL,
    path TEXT NOT NULL
  );

  -- Standalone (not external-content) FTS5 index: no sync triggers to maintain, just insert
  -- alongside each generation and delete alongside each delete. Good enough for prompt search
  -- on a single-user local app.
  CREATE VIRTUAL TABLE IF NOT EXISTS generations_fts USING fts5(id UNINDEXED, prompt);
`);

// Backfill rows inserted before this table existed (e.g. from earlier testing in dev).
db.exec(`
  INSERT INTO generations_fts (id, prompt)
  SELECT id, prompt FROM generations WHERE id NOT IN (SELECT id FROM generations_fts)
`);

// generation_refs predates the upload_id column (added once uploads got their own table) —
// CREATE TABLE IF NOT EXISTS won't retrofit it onto an already-existing table.
try { db.exec(`ALTER TABLE generation_refs ADD COLUMN upload_id TEXT`); } catch { /* already there */ }

// uploads predates content-hash dedupe — same retrofit as above.
try { db.exec(`ALTER TABLE uploads ADD COLUMN hash TEXT`); } catch { /* already there */ }
