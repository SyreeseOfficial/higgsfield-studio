/** Drops EXIF/XMP/IPTC (GPS, camera, timestamps) from JPEG and text/EXIF chunks from PNG before a
    reference leaves the browser. Other types pass through untouched.
    A JPEG whose EXIF rotates it is re-encoded instead, so stripping cannot flip the picture. */
export async function stripMetadata(file: File): Promise<File> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") return file
  const bytes = new Uint8Array(await file.arrayBuffer())
  const clean = file.type === "image/png" ? stripPng(bytes) : stripJpeg(bytes)
  if (clean === "rotated") return reencode(file)
  if (!clean) return file
  return new File([clean], file.name, { type: file.type })
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
