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

export function polygonArea(points) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area / 2);
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = currentPoint.y > point.y !== previousPoint.y > point.y
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y))
        / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function closeContour(points) {
  if (points.length < 2) return points;
  return distance(points[0], points.at(-1)) < 0.0001 ? points : [...points, { ...points[0] }];
}
