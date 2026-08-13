import { closeContour } from "../core/geometry.js";

const numberPattern = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?";

function parsePoints(value) {
  const values = value.match(new RegExp(numberPattern, "g"))?.map(Number) || [];
  if (values.length < 4 || values.length % 2) return [];
  const points = [];
  for (let index = 0; index < values.length; index += 2) points.push({ x: values[index], y: values[index + 1] });
  return points;
}

function attributes(tag) {
  const result = {};
  tag.replace(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g, (_match, name, _quote, value) => {
    result[name.toLowerCase()] = value;
    return "";
  });
  return result;
}

function lengthInMm(value) {
  const match = String(value || "").trim().match(new RegExp(`^(${numberPattern})\\s*(mm|cm|in|px)?$`, "i"));
  if (!match) return null;
  const factors = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96 };
  return Number(match[1]) * factors[(match[2] || "mm").toLowerCase()];
}

function svgTransform(source) {
  const root = source.match(/<svg\b[^>]*>/i)?.[0];
  const attrs = attributes(root || "");
  const values = (attrs.viewbox || "").match(new RegExp(numberPattern, "g"))?.map(Number) || [];
  if (values.length !== 4 || values[2] <= 0 || values[3] <= 0) return (point) => point;
  const widthMm = lengthInMm(attrs.width);
  const heightMm = lengthInMm(attrs.height);
  const scaleX = widthMm ? widthMm / values[2] : 1;
  const scaleY = heightMm ? heightMm / values[3] : scaleX;
  return (point) => ({ x: (point.x - values[0]) * scaleX, y: (point.y - values[1]) * scaleY });
}

function linePathData(data) {
  const tokens = data.match(new RegExp(`[a-zA-Z]|${numberPattern}`, "g")) || [];
  const contours = [];
  let points = [];
  let command = null;
  let cursor = { x: 0, y: 0 };
  let start = null;
  let index = 0;
  const finish = () => {
    if (points.length >= 2) contours.push(points);
    points = [];
    start = null;
  };
  const number = () => Number(tokens[index++]);
  const point = (relative) => {
    const raw = { x: number(), y: number() };
    return relative ? { x: cursor.x + raw.x, y: cursor.y + raw.y } : raw;
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error("Path SVG sem comando inicial.");
    const lower = command.toLowerCase();
    const relative = command === lower;
    if (lower === "z") {
      if (start) points.push({ ...start });
      finish();
      command = null;
      continue;
    }
    if (lower === "m" || lower === "l") {
      const next = point(relative);
      if (lower === "m") {
        finish();
        start = next;
        command = relative ? "l" : "L";
      }
      points.push(next);
      cursor = next;
      continue;
    }
    if (lower === "h") {
      cursor = { x: relative ? cursor.x + number() : number(), y: cursor.y };
      points.push({ ...cursor });
      continue;
    }
    if (lower === "v") {
      cursor = { x: cursor.x, y: relative ? cursor.y + number() : number() };
      points.push({ ...cursor });
      continue;
    }
    throw new Error(`Comando SVG ${command} ainda nao suportado. Exporte o molde como polilinhas.`);
  }
  finish();
  return contours;
}

export function parseSvg(source) {
  if (!/<svg[\s>]/i.test(source)) throw new Error("Arquivo SVG invalido.");
  const contours = [];
  const transform = svgTransform(source);
  const isMoldeLabMarker = /<text\b[^>]*>\s*FIM\s/i.test(source) && /stroke-dasharray/i.test(source);
  const add = (points, closed = true) => {
    if (points.length < 2) return;
    const normalized = points.map(transform);
    contours.push({ id: `svg-${contours.length + 1}`, kind: "external", points: closed ? closeContour(normalized) : normalized });
  };

  source.match(/<(?:polygon|polyline)\b[^>]*>/gi)?.forEach((tag) => {
    const attrs = attributes(tag);
    add(parsePoints(attrs.points || ""), /^<polygon/i.test(tag));
  });
  if (!isMoldeLabMarker) source.match(/<rect\b[^>]*>/gi)?.forEach((tag) => {
    const attrs = attributes(tag);
    const x = Number(attrs.x || 0); const y = Number(attrs.y || 0);
    const width = Number(attrs.width); const height = Number(attrs.height);
    if (width > 0 && height > 0) add([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]);
  });
  source.match(/<path\b[^>]*>/gi)?.forEach((tag) => {
    const attrs = attributes(tag);
    if (isMoldeLabMarker && attrs["stroke-dasharray"]) return;
    const data = attrs.d;
    if (data) linePathData(data).forEach((points) => add(points, false));
  });
  if (!contours.length) throw new Error("O SVG nao possui poligonos, polilinhas, retangulos ou paths lineares validos.");
  const warnings = isMoldeLabMarker
    ? ["SVG de risco do MoldeLab detectado: fundo, cabecalho, linha final e margem tracejada foram excluidos; piques e fio nao viram cortes nesta fase."]
    : [];
  return { format: "svg", units: "mm", contours, warnings };
}
