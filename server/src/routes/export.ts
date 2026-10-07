import { Router } from "express";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { db } from "../db.js";

export const exportRouter = Router();

const DB_PATH = new URL("../../data/studio.db", import.meta.url).pathname;
const MEDIA_DIR = new URL("../../data/media/", import.meta.url).pathname;

// ponytail: no zip-writing dependency in this project (see TODO.md's "Export or back up" item) —
// this is the same minimal store-only zip writer web/src/App.tsx already uses for download .zip,
// ported to Buffer instead of Blob. Good enough for a local backup file; not worth a dependency.
function crc32(data: Buffer): number {
  const T = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = T[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipBuffer(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const cen: Buffer[] = [];
  let off = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const sz = f.data.length;
    const L = Buffer.alloc(30);
    L.writeUInt32LE(0x04034b50, 0);
    L.writeUInt16LE(20, 4);
    L.writeUInt16LE(0, 6);
    L.writeUInt16LE(0, 8);
    L.writeUInt16LE(0, 10);
    L.writeUInt16LE(0, 12);
    L.writeUInt32LE(crc, 14);
    L.writeUInt32LE(sz, 18);
    L.writeUInt32LE(sz, 22);
    L.writeUInt16LE(nameBuf.length, 26);
    L.writeUInt16LE(0, 28);
    const C = Buffer.alloc(46);
    C.writeUInt32LE(0x02014b50, 0);
    C.writeUInt16LE(20, 4);
    C.writeUInt16LE(20, 6);
    C.writeUInt32LE(crc, 16);
    C.writeUInt32LE(sz, 20);
    C.writeUInt32LE(sz, 24);
    C.writeUInt16LE(nameBuf.length, 28);
    C.writeUInt32LE(off, 42);
    parts.push(L, nameBuf, f.data);
    cen.push(C, nameBuf);
    off += 30 + nameBuf.length + sz;
  }
  const centralSize = cen.reduce((n, b) => n + b.length, 0);
  const E = Buffer.alloc(22);
  E.writeUInt32LE(0x06054b50, 0);
  E.writeUInt16LE(files.length, 8);
  E.writeUInt16LE(files.length, 10);
  E.writeUInt32LE(centralSize, 12);
  E.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, ...cen, E]);
}

function walk(dir: string, base: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

exportRouter.get("/", async (_req, res) => {
  const tmpPath = join(tmpdir(), `studio-backup-${Date.now()}.db`);
  try {
    await db.backup(tmpPath);
    const files: { name: string; data: Buffer }[] = [{ name: "studio.db", data: readFileSync(tmpPath) }];
    for (const path of walk(MEDIA_DIR, MEDIA_DIR)) {
      files.push({ name: `media/${relative(MEDIA_DIR, path)}`, data: readFileSync(path) });
    }
    const zip = zipBuffer(files);
    const date = new Date().toISOString().slice(0, 10);
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="studio-backup-${date}.zip"`);
    res.send(zip);
  } catch {
    res.status(500).json({ error: { title: "Backup failed", detail: "Couldn't put together the backup file." } });
  } finally {
    try { rmSync(tmpPath); } catch { /* best effort */ }
  }
});
