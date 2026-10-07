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
  )
`);
