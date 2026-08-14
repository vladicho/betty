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

function curveSteps(...points) {
  let estimate = 0;
  for (let index = 1; index < points.length; index += 1) {
    estimate += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return Math.max(4, Math.min(64, Math.ceil(estimate / 4)));
}

function arcPoints(from, to, rxValue, ryValue, rotation, largeArc, sweep) {
  let rx = Math.abs(rxValue);
  let ry = Math.abs(ryValue);
  if (!rx || !ry || (from.x === to.x && from.y === to.y)) return [to];
  const angle = rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const scale = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2;
  if (scale > 1) {
    const factor = Math.sqrt(scale);
    rx *= factor;
    ry *= factor;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const numerator = Math.max(0, rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2);
  const denominator = rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2;
  const coefficient = denominator ? sign * Math.sqrt(numerator / denominator) : 0;
  const cx1 = coefficient * (rx * y1 / ry);
  const cy1 = coefficient * (-ry * x1 / rx);
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const vectorAngle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1 - cx1) / rx;
  const uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx;
  const vy = (-y1 - cy1) / ry;
  const startAngle = vectorAngle(1, 0, ux, uy);
  let delta = vectorAngle(ux, uy, vx, vy);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(4, Math.min(96, Math.ceil(Math.abs(delta) * Math.max(rx, ry) / 4)));
  return Array.from({ length: steps }, (_unused, index) => {
    const theta = startAngle + delta * ((index + 1) / steps);
    return {
      x: cx + cos * rx * Math.cos(theta) - sin * ry * Math.sin(theta),
      y: cy + sin * rx * Math.cos(theta) + cos * ry * Math.sin(theta),
    };
  });
}

function pathData(data) {
  const tokens = data.match(new RegExp(`[a-zA-Z]|${numberPattern}`, "g")) || [];
  const contours = [];
  let points = [];
  let command = null;
  let cursor = { x: 0, y: 0 };
  let start = null;
  let previousControl = null;
  let previousCommand = null;
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
  const addCurve = (values) => {
    points.push(...values);
    cursor = values.at(-1);
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error("Path SVG sem comando inicial.");
    const lower = command.toLowerCase();
    const relative = command === lower;
    if (lower === "z") {
      if (start) points.push({ ...start });
      cursor = start || cursor;
      finish();
      previousControl = null;
      previousCommand = lower;
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
      previousControl = null;
      previousCommand = lower;
      continue;
    }
    if (lower === "h") {
      cursor = { x: relative ? cursor.x + number() : number(), y: cursor.y };
      points.push({ ...cursor });
      previousControl = null;
      previousCommand = lower;
      continue;
    }
    if (lower === "v") {
      cursor = { x: cursor.x, y: relative ? cursor.y + number() : number() };
      points.push({ ...cursor });
      previousControl = null;
      previousCommand = lower;
      continue;
    }
    if (lower === "c") {
      const from = { ...cursor };
      const control1 = point(relative);
      const control2 = point(relative);
      const to = point(relative);
      const steps = curveSteps(from, control1, control2, to);
      addCurve(Array.from({ length: steps }, (_unused, step) => {
        const t = (step + 1) / steps;
        const u = 1 - t;
        return {
          x: u ** 3 * from.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * to.x,
          y: u ** 3 * from.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * to.y,
        };
      }));
      previousControl = control2;
      previousCommand = lower;
      continue;
    }
    if (lower === "s") {
      const from = { ...cursor };
      const control1 = ["c", "s"].includes(previousCommand) && previousControl
        ? { x: 2 * cursor.x - previousControl.x, y: 2 * cursor.y - previousControl.y }
        : { ...cursor };
      const control2 = point(relative);
      const to = point(relative);
      const steps = curveSteps(from, control1, control2, to);
      addCurve(Array.from({ length: steps }, (_unused, step) => {
        const t = (step + 1) / steps;
        const u = 1 - t;
        return {
          x: u ** 3 * from.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * to.x,
          y: u ** 3 * from.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * to.y,
        };
      }));
      previousControl = control2;
      previousCommand = lower;
      continue;
    }
    if (lower === "q" || lower === "t") {
      const from = { ...cursor };
      const control = lower === "q"
        ? point(relative)
        : (["q", "t"].includes(previousCommand) && previousControl
          ? { x: 2 * cursor.x - previousControl.x, y: 2 * cursor.y - previousControl.y }
          : { ...cursor });
      const to = point(relative);
      const steps = curveSteps(from, control, to);
      addCurve(Array.from({ length: steps }, (_unused, step) => {
        const t = (step + 1) / steps;
        const u = 1 - t;
        return {
          x: u ** 2 * from.x + 2 * u * t * control.x + t ** 2 * to.x,
          y: u ** 2 * from.y + 2 * u * t * control.y + t ** 2 * to.y,
        };
      }));
      previousControl = control;
      previousCommand = lower;
      continue;
    }
    if (lower === "a") {
      const rx = number();
      const ry = number();
      const rotation = number();
      const largeArc = Boolean(number());
      const sweep = Boolean(number());
      const to = point(relative);
      addCurve(arcPoints(cursor, to, rx, ry, rotation, largeArc, sweep));
      previousControl = null;
      previousCommand = lower;
      continue;
    }
    throw new Error(`Comando SVG ${command} nao suportado.`);
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
    if (data) pathData(data).forEach((points) => add(points, false));
  });
  source.match(/<line\b[^>]*>/gi)?.forEach((tag) => {
    const attrs = attributes(tag);
    add([{ x: Number(attrs.x1 || 0), y: Number(attrs.y1 || 0) }, { x: Number(attrs.x2 || 0), y: Number(attrs.y2 || 0) }], false);
  });
  source.match(/<(?:circle|ellipse)\b[^>]*>/gi)?.forEach((tag) => {
    const attrs = attributes(tag);
    const cx = Number(attrs.cx || 0); const cy = Number(attrs.cy || 0);
    const rx = Number(attrs.rx ?? attrs.r); const ry = Number(attrs.ry ?? attrs.r);
    if (!(rx > 0 && ry > 0)) return;
    const steps = Math.max(24, Math.min(128, Math.ceil(Math.PI * Math.max(rx, ry) / 2)));
    add(Array.from({ length: steps }, (_unused, index) => {
      const angle = Math.PI * 2 * index / steps;
      return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
    }));
  });
  if (!contours.length) throw new Error("O SVG nao possui trajetorias geometricas validas.");
  const warnings = isMoldeLabMarker
    ? ["SVG de risco do MoldeLab detectado: fundo, cabecalho, linha final e margem tracejada foram excluidos; piques e fio nao viram cortes nesta fase."]
    : [];
  return { format: "svg", units: "mm", contours, warnings };
}
