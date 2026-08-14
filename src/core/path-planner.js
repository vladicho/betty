import { distance, polylineLength } from "./geometry.js";

function contourStart(contour) {
  return contour.points[0];
}

function orientContour(contour, cursor) {
  const points = contour.points;
  const closed = points.length > 2 && distance(points[0], points.at(-1)) < 0.0001;
  if (!closed) {
    const startDistance = distance(cursor, points[0]);
    const endDistance = distance(cursor, points.at(-1));
    return endDistance < startDistance ? { ...contour, points: [...points].reverse() } : contour;
  }
  const ring = points.slice(0, -1);
  let nearest = 0;
  ring.forEach((point, index) => {
    if (distance(cursor, point) < distance(cursor, ring[nearest])) nearest = index;
  });
  if (!nearest) return contour;
  const rotated = [...ring.slice(nearest), ...ring.slice(0, nearest)];
  return { ...contour, points: [...rotated, { ...rotated[0] }] };
}

function contourPriority(contour) {
  return contour.kind === "external" ? 1 : 0;
}

function nearestOrder(contours, origin) {
  const pending = [...contours];
  const ordered = [];
  let cursor = origin;

  while (pending.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    pending.forEach((contour, index) => {
      const oriented = orientContour(contour, cursor);
      const travel = distance(cursor, contourStart(oriented));
      if (travel < bestDistance) {
        bestDistance = travel;
        bestIndex = index;
      }
    });
    const [raw] = pending.splice(bestIndex, 1);
    const next = orientContour(raw, cursor);
    ordered.push(next);
    cursor = next.points.at(-1);
  }
  return ordered;
}

export function planCutPath(contours, origin = { x: 0, y: 0 }) {
  const valid = contours.filter((contour) => contour.points?.length >= 2);
  const groups = new Map([[0, []], [1, []]]);
  valid.forEach((contour) => groups.get(contourPriority(contour)).push(contour));

  const ordered = [];
  let cursor = origin;
  for (const priority of [0, 1]) {
    const group = nearestOrder(groups.get(priority), cursor);
    ordered.push(...group);
    if (group.length) cursor = group.at(-1).points.at(-1);
  }

  let travelDistance = 0;
  let cutDistance = 0;
  cursor = origin;
  ordered.forEach((contour) => {
    travelDistance += distance(cursor, contourStart(contour));
    cutDistance += polylineLength(contour.points);
    cursor = contour.points.at(-1);
  });

  return { contours: ordered, travelDistance, cutDistance };
}
