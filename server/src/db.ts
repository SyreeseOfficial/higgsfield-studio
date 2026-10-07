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
    tag TEXT
  );
`);
