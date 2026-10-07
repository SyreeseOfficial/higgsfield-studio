import { Router } from "express";
import { db } from "../db.js";
import { encrypt, decrypt } from "../crypto.js";
import { validateKey } from "../higgsfield.js";

export const keyRouter = Router();

type KeyRow = {
  iv: Buffer;
  tag: Buffer;
  data: Buffer;
  last4: string;
  status: string;
};

function getRow(): KeyRow | undefined {
  return db.prepare("SELECT iv, tag, data, last4, status FROM api_key WHERE id = 1").get() as
    | KeyRow
    | undefined;
}

// ponytail: TODO.md asks for a `credits` field here, but Higgsfield's public API
// has no balance/credits endpoint — checked their OpenAPI spec and billing docs.
// The only places that number exists are the web dashboard, the `hf` CLI, and an
// unrelated MCP server, none of which a plain API key can call. Not faking a
// number — if Higgsfield ever ships one, add it here.
keyRouter.get("/", (_req, res) => {
  const row = getRow();
  if (!row) return res.json({ connected: false, last4: null, status: null });
  res.json({ connected: true, last4: row.last4, status: row.status });
});

keyRouter.post("/", async (req, res) => {
  const raw = String(req.body?.key ?? "").trim();
  const sep = raw.indexOf(":");
  if (sep <= 0 || sep === raw.length - 1) {
    return res.status(400).json({ error: "Expected \"key_id:key_secret\"" });
  }
  const keyId = raw.slice(0, sep);
  const keySecret = raw.slice(sep + 1);

  const valid = await validateKey(keyId, keySecret);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const { iv, tag, data } = encrypt(raw);
  const last4 = raw.slice(-4);
  db.prepare(
    `INSERT INTO api_key (id, iv, tag, data, last4, status, created_at)
     VALUES (1, ?, ?, ?, ?, 'valid', ?)
     ON CONFLICT(id) DO UPDATE SET iv=excluded.iv, tag=excluded.tag, data=excluded.data,
       last4=excluded.last4, status=excluded.status, created_at=excluded.created_at`
  ).run(iv, tag, data, last4, Date.now());

  res.json({ connected: true, last4, status: "valid" });
});

keyRouter.delete("/", (_req, res) => {
  db.prepare("DELETE FROM api_key WHERE id = 1").run();
  res.json({ connected: false });
});

/** For other routes that need to call Higgsfield: decrypt the stored credential. */
export function readStoredKey(): { keyId: string; keySecret: string } | null {
  const row = getRow();
  if (!row) return null;
  const raw = decrypt(row.iv, row.tag, row.data);
  const sep = raw.indexOf(":");
  return { keyId: raw.slice(0, sep), keySecret: raw.slice(sep + 1) };
}
