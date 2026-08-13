export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points, closed = false) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return closed ? total + distance(points.at(-1), points[0]) : total;
}

export function bounds(points) {
  if (!points.length) return null;
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function interpolate(a, b, progress) {
  const t = Math.max(0, Math.min(1, progress));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
