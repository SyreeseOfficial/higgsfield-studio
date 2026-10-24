import { describe, expect, it } from "vitest"

import {
  stripGif,
  stripJpeg,
  stripMp4,
  stripPng,
  stripWebp,
} from "@/generation/strip-metadata"

const u8 = (...n: number[]) => new Uint8Array(n)
const join = (...parts: Uint8Array<ArrayBuffer>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

describe("stripJpeg", () => {
  // SOI, APP0 (kept), APP1 "Exif" with no orientation tag, COM, SOS + data.
  const exif = (orientation?: number) => {
    const tiff = orientation
      ? [
          0x4d,
          0x4d,
          0,
          0x2a,
          0,
          0,
          0,
          8,
          0,
          1,
          0x01,
          0x12,
          0,
          3,
          0,
          0,
          0,
          1,
          0,
          orientation,
          0,
          0,
          0,
          0,
          0,
          0,
        ]
      : [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0]
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
    return u8(0xff, 0xe1, 0, body.length + 2, ...body)
  }
  const jpeg = (app1: Uint8Array<ArrayBuffer>) =>
    join(
      u8(0xff, 0xd8),
      u8(0xff, 0xe0, 0, 4, 1, 2),
      app1,
      u8(0xff, 0xfe, 0, 4, 9, 9),
      u8(0xff, 0xda, 0, 2, 7, 7, 7)
    )

  it("removes EXIF and comments but keeps APP0 and image data", () => {
    const out = stripJpeg(jpeg(exif()))
    expect(out).toEqual(
      join(
        u8(0xff, 0xd8),
        u8(0xff, 0xe0, 0, 4, 1, 2),
        u8(0xff, 0xda, 0, 2, 7, 7, 7)
      )
    )
  })

  it("asks for a re-encode when EXIF rotates the picture", () => {
    expect(stripJpeg(jpeg(exif(6)))).toBe("rotated")
  })

  it("leaves non-JPEG bytes alone", () => {
    expect(stripJpeg(u8(1, 2, 3, 4))).toBeNull()
  })
})

describe("stripPng", () => {
  const chunk = (type: string, data: number[]) =>
    join(
      u8(0, 0, 0, data.length),
      new TextEncoder().encode(type),
      u8(...data),
      u8(0, 0, 0, 0)
    )
  const sig = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

  it("drops text and EXIF chunks only", () => {
    const out = stripPng(
      join(
        sig,
        chunk("IHDR", [1]),
        chunk("tEXt", [2, 3]),
        chunk("eXIf", [4]),
        chunk("IDAT", [5])
      )
    )
    expect(out).toEqual(join(sig, chunk("IHDR", [1]), chunk("IDAT", [5])))
  })
})

const text = (value: string) => Uint8Array.from(value, (c) => c.charCodeAt(0))
const be32 = (n: number) => u8(n >>> 24, n >>> 16, n >>> 8, n)
const le32 = (n: number) => u8(n, n >>> 8, n >>> 16, n >>> 24)

describe("stripWebp", () => {
  const chunk = (type: string, body: number[]) =>
    join(
      text(type),
      le32(body.length),
      u8(...body),
      u8(...(body.length & 1 ? [0] : []))
    )
  it("drops EXIF/XMP chunks, clears VP8X flags and fixes the RIFF size", () => {
    const body = join(
      text("WEBP"),
      chunk("VP8X", [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      chunk("EXIF", [1, 2, 3]),
      chunk("XMP ", [4, 5]),
      chunk("VP8 ", [9, 9])
    )
    const out = stripWebp(join(text("RIFF"), le32(body.length), body))!
    const s = String.fromCharCode(...out)
    expect(s).not.toContain("EXIF")
    expect(s).not.toContain("XMP ")
    expect(s).toContain("VP8 ")
    expect(out[20]! & 0x0c).toBe(0)
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8)
  })
  it("returns null for broken input", () => {
    expect(stripWebp(text("RIFF....WEBPEXIF\xff\xff\xff\x7f"))).toBeNull()
  })
})

describe("stripGif", () => {
  it("drops comments and XMP but keeps the loop extension and frames", () => {
    const gif = join(
      text("GIF89a"),
      u8(1, 0, 1, 0, 0, 0, 0), // 1x1, no color table
      u8(0x21, 0xfe, 3, 65, 66, 67, 0), // comment
      u8(0x21, 0xff, 11, ...text("NETSCAPE2.0"), 3, 1, 0, 0, 0),
      u8(0x21, 0xff, 11, ...text("XMP DataXMP"), 2, 1, 1, 0),
      u8(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0x44, 0),
      u8(0x3b)
    )
    const out = String.fromCharCode(...stripGif(gif)!)
    expect(out).toContain("NETSCAPE2.0")
    expect(out).not.toContain("ABC")
    expect(out).not.toContain("XMP Data")
    expect(out.endsWith(";")).toBe(true)
  })
  it("returns null for broken input", () => {
    expect(
      stripGif(join(text("GIF89a"), u8(1, 0, 1, 0, 0, 0, 0, 0x99)))
    ).toBeNull()
  })
})

describe("stripMp4", () => {
  const box = (type: string, ...body: Uint8Array<ArrayBuffer>[]) => {
    const inner = join(...body)
    return join(be32(8 + inner.length), text(type), inner)
  }
  it("zeroes udta/meta boxes in place and keeps the size", () => {
    const file = join(
      box("ftyp", text("isom")),
      box(
        "moov",
        box("udta", text("©xyz+12.3-045.6/")),
        box("trak", box("tkhd", u8(1, 2)))
      ),
      box("mdat", u8(7, 7, 7))
    )
    const out = stripMp4(file)!
    const s = String.fromCharCode(...out)
    expect(out.length).toBe(file.length)
    expect(s).not.toContain("xyz")
    expect(s).toContain("free")
    expect(s).toContain("tkhd")
  })
  it("returns null when a box overruns the file", () => {
    expect(
      stripMp4(join(box("ftyp", text("isom")), be32(999), text("moov")))
    ).toBeNull()
  })
})

describe("stripping never throws on broken files", () => {
  // One small valid file per format, then every truncation and random corruption of it.
  const valid: Record<string, Uint8Array<ArrayBuffer>> = {
    jpeg: join(
      u8(0xff, 0xd8),
      u8(0xff, 0xe1, 0, 8, 69, 120, 105, 102, 0, 0),
      u8(0xff, 0xda, 0, 4, 1, 2, 9, 9)
    ),
    png: join(
      u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      be32(2),
      text("tEXt"),
      u8(1, 2),
      be32(0),
      be32(0),
      text("IDAT"),
      be32(0)
    ),
    webp: join(
      text("RIFF"),
      le32(22),
      text("WEBP"),
      text("VP8X"),
      le32(10),
      u8(0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    ),
    gif: join(
      text("GIF89a"),
      u8(1, 0, 1, 0, 0, 0, 0),
      u8(0x21, 0xfe, 1, 65, 0),
      u8(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0x44, 0),
      u8(0x3b)
    ),
    mp4: join(
      be32(12),
      text("ftyp"),
      text("isom"),
      be32(16),
      text("moov"),
      be32(8),
      text("udta")
    ),
  }
  const fns = {
    jpeg: stripJpeg,
    png: stripPng,
    webp: stripWebp,
    gif: stripGif,
    mp4: stripMp4,
  }
  let seed = 99
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32

  it.each(Object.keys(valid))("%s: truncations and bit flips", (name) => {
    const fn = fns[name as keyof typeof fns]
    const bytes = valid[name]!
    for (let cut = 0; cut <= bytes.length; cut++)
      expect(() => fn(bytes.slice(0, cut))).not.toThrow()
    for (let i = 0; i < 300; i++) {
      const copy = bytes.slice()
      for (let k = 0; k < 3; k++)
        copy[Math.floor(rand() * copy.length)] = Math.floor(rand() * 256)
      expect(() => fn(copy)).not.toThrow()
    }
    expect(fn(bytes)).not.toBeNull() // the untouched sample is accepted
  })
})
