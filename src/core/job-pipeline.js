import { bounds, distance, pointInPolygon, polygonArea } from "./geometry.js";
import { planCutPath } from "./path-planner.js";
import { parseHpgl } from "../importers/hpgl.js";
import { parseSvg } from "../importers/svg.js";

function isClosed(points) {
  return points.length > 2 && distance(points[0], points.at(-1)) < 0.0001;
}

function classifyContours(contours) {
  return contours.map((contour) => {
    if (!isClosed(contour.points)) return { ...contour, kind: "open" };
    const nestingDepth = contours.filter((other) => {
      if (other === contour || !isClosed(other.points) || polygonArea(other.points) <= polygonArea(contour.points)) return false;
      return pointInPolygon(contour.points[0], other.points);
    }).length;
    return { ...contour, kind: nestingDepth % 2 ? "internal" : "external" };
  });
}

export function detectFormat(filename, source) {
  const extension = filename.toLowerCase().split(".").at(-1);
  if (extension === "svg" || /<svg[\s>]/i.test(source)) return "svg";
  if (["plt", "hpgl", "hpg"].includes(extension) || /(?:^|;)\s*(?:IN|PU|PD|PA|PR)/i.test(source)) return "hpgl";
  throw new Error("Formato nao reconhecido. Use SVG, PLT ou HPGL.");
}

export function importCutFile(filename, source, options = {}) {
  const format = detectFormat(filename, source);
  const imported = format === "svg" ? parseSvg(source) : parseHpgl(source, options);
  return { ...imported, name: filename, contours: classifyContours(imported.contours) };
}

export function validateJob(job, machine = { width: 1600, height: 1000 }) {
  const points = job.contours.flatMap((contour) => contour.points);
  const box = bounds(points);
  const errors = [];
  const warnings = [...(job.warnings || [])];
  if (!box) errors.push("O trabalho nao possui pontos de corte.");
  if (box && (box.minX < 0 || box.minY < 0)) errors.push("Existem coordenadas negativas fora da origem da mesa.");
  if (box && (box.maxX > machine.width || box.maxY > machine.height)) {
    errors.push(`O trabalho excede a mesa de ${machine.width} × ${machine.height} mm.`);
  }
  const openContours = job.contours.filter((contour) => contour.kind === "open").length;
  if (openContours) warnings.push(`${openContours} trajetoria(s) aberta(s); confirme se sao piques ou marcacoes.`);
  return { valid: errors.length === 0, errors, warnings, bounds: box };
}

export function buildSegments(cutPlan, origin = { x: 0, y: 0 }) {
  const segments = [];
  let cursor = origin;
  cutPlan.contours.forEach((contour) => {
    const start = contour.points[0];
    if (distance(cursor, start) > 0) segments.push({ from: cursor, to: start, cutting: false, length: distance(cursor, start) });
    for (let index = 1; index < contour.points.length; index += 1) {
      const from = contour.points[index - 1];
      const to = contour.points[index];
      segments.push({ from, to, cutting: true, length: distance(from, to), contourId: contour.id });
    }
    cursor = contour.points.at(-1);
  });
  return segments;
}

export function prepareCutJob(job, machine) {
  const validation = validateJob(job, machine);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const plan = planCutPath(job.contours);
  return { job, validation, plan, segments: buildSegments(plan) };
}
