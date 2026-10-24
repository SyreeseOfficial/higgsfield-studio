/** Store-only zip writer: images and video are already compressed, so deflate would only cost CPU. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Classic zip stores sizes and offsets in 32 bits; past this the archive would be corrupt. */
export const ZIP_MAX_BYTES = 0xffffffff - 1_048_576

export class ZipTooLargeError extends Error {
  constructor() {
    super("Too large for one zip file")
    this.name = "ZipTooLargeError"
  }
}

/** MS-DOS date and time words (local time; zip has no time zone). */
function dosDateTime(now = new Date()): { time: number; date: number } {
  return {
    time:
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      (now.getSeconds() >> 1),
    date:
      (Math.max(0, now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  }
}

export async function zipFiles(
  files: { name: string; blob: Blob }[]
): Promise<Blob> {
  if (
    files.length > 0xffff ||
    files.reduce((n, f) => n + f.blob.size, 0) > ZIP_MAX_BYTES
  )
    throw new ZipTooLargeError()
  const { time, date } = dosDateTime()
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  for (const { name, blob } of files) {
    const data = new Uint8Array(await blob.arrayBuffer())
    const nameBytes = enc.encode(name)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(local.buffer, nameBytes, blob) // the Blob itself: the browser may keep it off the heap

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint16(12, time, true)
    entry.setUint16(14, date, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, nameBytes.length, true)
    entry.setUint32(42, offset, true)
    central.push(new Uint8Array(entry.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end.buffer], {
    type: "application/zip",
  })
}
