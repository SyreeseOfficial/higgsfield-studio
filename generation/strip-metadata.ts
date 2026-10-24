/** Drops EXIF/XMP/IPTC (GPS, camera, timestamps) from JPEG, text/EXIF chunks from PNG, EXIF/XMP
    from WebP, comments/XMP from GIF and udta/meta/uuid boxes from MP4 before a reference leaves the
    browser. Other types (WAV) pass through untouched.
    A JPEG whose EXIF rotates it is re-encoded instead, so stripping cannot flip the picture. */
export async function stripMetadata(file: File): Promise<File> {
  const strip = STRIPPERS[file.type]
  if (!strip) return file
  const bytes = new Uint8Array(await file.arrayBuffer())
  const clean = strip(bytes)
  if (clean === "rotated") return reencode(file)
  if (!clean) return file
  return new File([clean], file.name, { type: file.type })
}

const STRIPPERS: Record<
  string,
  (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> | "rotated" | null
> = {
  "image/jpeg": stripJpeg,
  "image/png": stripPng,
  "image/webp": stripWebp,
  "image/gif": stripGif,
  "video/mp4": stripMp4,
}

const TEXT_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"])

export function stripPng(
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> | null {
  const view = new DataView(bytes.buffer)
  if (bytes.length < 8 || view.getUint32(0) !== 0x89504e47) return null
  const kept: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 8)]
  let pos = 8
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    const end = pos + 12 + length
    if (end > bytes.length) return null
    if (!TEXT_CHUNKS.has(type)) kept.push(bytes.subarray(pos, end))
    pos = end
  }
  return concat(kept)
}

export function stripJpeg(
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> | "rotated" | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const view = new DataView(bytes.buffer)
  const kept: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 2)]
  let pos = 2
  while (pos + 4 <= bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1]!
    if (marker === 0xda) break // start of scan: the rest is image data
    const end = pos + 2 + view.getUint16(pos + 2)
    if (end > bytes.length) return null
    // APP1 (EXIF/XMP), APP13 (IPTC) and comments carry the metadata.
    if (marker === 0xe1 && exifOrientation(bytes, pos + 4, end) > 1)
      return "rotated"
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe)
      kept.push(bytes.subarray(pos, end))
    pos = end
  }
  kept.push(bytes.subarray(pos))
  return concat(kept)
}

/** EXIF orientation (1 when absent or not EXIF). */
function exifOrientation(
  bytes: Uint8Array,
  start: number,
  end: number
): number {
  if (String.fromCharCode(...bytes.subarray(start, start + 4)) !== "Exif")
    return 1
  const tiff = start + 6
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  const little = view.getUint16(tiff) === 0x4949
  const ifd = tiff + view.getUint32(tiff + 4, little)
  if (ifd + 2 > end) return 1
  const count = view.getUint16(ifd, little)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > end) break
    if (view.getUint16(entry, little) === 0x0112)
      return view.getUint16(entry + 8, little)
  }
  return 1
}

async function reencode(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file) // applies EXIF orientation
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95)
    )
    return blob ? new File([blob], file.name, { type: "image/jpeg" }) : file
  } catch {
    return file
  }
}

function concat(parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))

/** RIFF/WebP: drops the EXIF and XMP chunks and clears their flags in VP8X. */
export function stripWebp(
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> | null {
  if (
    bytes.length < 12 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  )
    return null
  const view = new DataView(bytes.buffer)
  const kept: Uint8Array<ArrayBuffer>[] = [bytes.slice(0, 12)]
  let pos = 12
  while (pos + 8 <= bytes.length) {
    const type = ascii(bytes, pos, 4)
    const end =
      pos +
      8 +
      view.getUint32(pos + 4, true) +
      (view.getUint32(pos + 4, true) & 1)
    if (end > bytes.length) return null
    if (type === "VP8X") {
      const chunk = bytes.slice(pos, end)
      chunk[8]! &= ~(0x08 | 0x04) // EXIF and XMP present flags
      kept.push(chunk)
    } else if (type !== "EXIF" && type !== "XMP ")
      kept.push(bytes.subarray(pos, end))
    pos = end
  }
  const out = concat(kept)
  new DataView(out.buffer).setUint32(4, out.length - 8, true)
  return out
}

/** GIF: drops comment extensions and XMP application extensions; loop info stays. */
export function stripGif(
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> | null {
  const head = ascii(bytes, 0, 6)
  if (head !== "GIF87a" && head !== "GIF89a") return null
  const skipBlocks = (from: number) => {
    let p = from
    while (p < bytes.length && bytes[p] !== 0) p += bytes[p]! + 1
    return p + 1 // past the 0 terminator
  }
  let pos = 13
  if (bytes[10]! & 0x80) pos += 3 * (2 << (bytes[10]! & 7))
  const kept: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, pos)]
  while (pos < bytes.length) {
    const marker = bytes[pos]
    if (marker === 0x3b) {
      kept.push(bytes.subarray(pos, pos + 1))
      return concat(kept)
    }
    let end: number
    let drop = false
    if (marker === 0x21) {
      const label = bytes[pos + 1]
      end = skipBlocks(pos + 2)
      drop =
        label === 0xfe ||
        (label === 0xff && ascii(bytes, pos + 3, 11) === "XMP DataXMP")
    } else if (marker === 0x2c) {
      const packed = bytes[pos + 9]!
      const table = packed & 0x80 ? 3 * (2 << (packed & 7)) : 0
      end = skipBlocks(pos + 10 + table + 1)
    } else return null
    if (end > bytes.length) return null
    if (!drop) kept.push(bytes.subarray(pos, end))
    pos = end
  }
  return null
}

const MP4_CONTAINERS = new Set(["moov", "trak"])
const MP4_METADATA = new Set(["udta", "meta", "uuid"])

/** MP4: overwrites udta/meta/uuid boxes (GPS, device, XMP) with zeros and renames
    them "free". Same size, so every sample offset stays valid. */
export function stripMp4(
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return null
  const out = bytes.slice()
  const view = new DataView(out.buffer)
  const walk = (from: number, to: number): boolean => {
    let pos = from
    while (pos + 8 <= to) {
      let size = view.getUint32(pos)
      let header = 8
      if (size === 1) {
        if (pos + 16 > to) return false
        size = Number(view.getBigUint64(pos + 8))
        header = 16
      } else if (size === 0) size = to - pos
      if (size < header || pos + size > to) return false
      const type = ascii(out, pos + 4, 4)
      if (MP4_METADATA.has(type)) {
        out.fill(0, pos + header, pos + size)
        out.set([0x66, 0x72, 0x65, 0x65], pos + 4) // "free"
      } else if (MP4_CONTAINERS.has(type) && !walk(pos + header, pos + size))
        return false
      pos += size
    }
    return true
  }
  return walk(0, out.length) ? out : null
}
