export type Rect = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }

/** The crop rectangle (all values 0..1 of the image) spanned by a fixed corner and a dragged
    point. `lock` is a width/height ratio in pixels; `dims` is the image size in pixels. */
export function rectFromCorners(
  fixed: Point,
  dragged: Point,
  dims: { w: number; h: number },
  lock?: number
): Rect {
  let dx = dragged.x - fixed.x
  let dy = dragged.y - fixed.y
  if (lock) {
    let wPx = Math.abs(dx) * dims.w
    let hPx = Math.abs(dy) * dims.h
    if (wPx / lock > hPx) hPx = wPx / lock
    else wPx = hPx * lock
    dx = (Math.sign(dx) || 1) * (wPx / dims.w)
    dy = (Math.sign(dy) || 1) * (hPx / dims.h)
  }
  // Pull the dragged corner back inside the image, keeping the shape.
  const room = (from: number, d: number) => (d >= 0 ? 1 - from : from)
  const shrink = Math.min(
    1,
    room(fixed.x, dx) / (Math.abs(dx) || 1),
    room(fixed.y, dy) / (Math.abs(dy) || 1)
  )
  dx *= shrink
  dy *= shrink
  return {
    x: Math.min(fixed.x, fixed.x + dx),
    y: Math.min(fixed.y, fixed.y + dy),
    w: Math.abs(dx),
    h: Math.abs(dy),
  }
}

/** A rectangle of the given pixel ratio, as large as fits and centred. */
export function centeredRect(
  dims: { w: number; h: number },
  ratio: number
): Rect {
  const imageRatio = dims.w / dims.h
  const w = imageRatio > ratio ? ratio / imageRatio : 1
  const h = imageRatio > ratio ? 1 : imageRatio / ratio
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** Moves a rectangle by (dx, dy) without leaving the image. */
export function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return {
    ...rect,
    x: Math.min(1 - rect.w, Math.max(0, rect.x + dx)),
    y: Math.min(1 - rect.h, Math.max(0, rect.y + dy)),
  }
}
