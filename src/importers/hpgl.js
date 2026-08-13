function coordinatePairs(values) {
  const numbers = values.split(/[\s,]+/).filter(Boolean).map(Number);
  if (numbers.some((value) => !Number.isFinite(value)) || numbers.length % 2) {
    throw new Error("Coordenadas HPGL invalidas.");
  }
  const pairs = [];
  for (let index = 0; index < numbers.length; index += 2) pairs.push({ x: numbers[index], y: numbers[index + 1] });
  return pairs;
}

export function parseHpgl(source, { unitsPerMm = 40 } = {}) {
  if (!(unitsPerMm > 0)) throw new Error("A escala HPGL deve ser maior que zero.");
  const contours = [];
  let position = { x: 0, y: 0 };
  let absolute = true;
  let penDown = false;
  let active = null;

  const finishContour = () => {
    if (active?.length >= 2) contours.push({ id: `hpgl-${contours.length + 1}`, kind: "external", points: active });
    active = null;
  };

  source.replace(/[\r\n]/g, "").split(";").forEach((raw) => {
    const command = raw.trim();
    if (!command) return;
    const opcode = command.slice(0, 2).toUpperCase();
    const payload = command.slice(2).trim();
    if (opcode === "IN") {
      finishContour();
      position = { x: 0, y: 0 };
      absolute = true;
      penDown = false;
      return;
    }
    if (opcode === "PA" || opcode === "PR") {
      absolute = opcode === "PA";
      if (!payload) return;
    } else if (opcode === "PU" || opcode === "PD") {
      const nextPenDown = opcode === "PD";
      if (!nextPenDown) finishContour();
      penDown = nextPenDown;
    } else {
      return;
    }

    if (!payload) return;
    coordinatePairs(payload).forEach((rawPoint) => {
      const next = absolute ? rawPoint : { x: position.x + rawPoint.x, y: position.y + rawPoint.y };
      if (penDown) {
        if (!active) active = [{ x: position.x / unitsPerMm, y: position.y / unitsPerMm }];
        active.push({ x: next.x / unitsPerMm, y: next.y / unitsPerMm });
      }
      position = next;
    });
  });
  finishContour();
  if (!contours.length) throw new Error("O PLT/HPGL nao possui trajetorias de corte PD validas.");
  return {
    format: "hpgl",
    units: "mm",
    contours,
    warnings: ["PLT/HPGL nao identifica semanticamente molde, fio, pique ou cabecalho; revise todas as trajetorias no simulador."],
  };
}
