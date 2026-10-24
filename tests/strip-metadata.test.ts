import { describe, expect, it } from "vitest"

import { stripJpeg, stripPng } from "@/generation/strip-metadata"

const u8 = (...n: number[]) => new Uint8Array(n)
const join = (...parts: Uint8Array<ArrayBuffer>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) (out.set(p, o), (o += p.length))
  return out
}

describe("stripJpeg", () => {
  // SOI, APP0 (kept), APP1 "Exif" with no orientation tag, COM, SOS + data.
  const exif = (orientation?: number) => {
    const tiff = orientation
      ? [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]
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
      join(u8(0xff, 0xd8), u8(0xff, 0xe0, 0, 4, 1, 2), u8(0xff, 0xda, 0, 2, 7, 7, 7))
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
      join(sig, chunk("IHDR", [1]), chunk("tEXt", [2, 3]), chunk("eXIf", [4]), chunk("IDAT", [5]))
    )
    expect(out).toEqual(join(sig, chunk("IHDR", [1]), chunk("IDAT", [5])))
  })
})
