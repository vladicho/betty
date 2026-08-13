function finitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

export function createCommandProgram(preparedJob, settings = {}) {
  const speed = Math.max(1, Number(settings.speed || 80));
  const commands = [{ type: "JOB_BEGIN", name: preparedJob.job.name, units: "mm" }];
  let toolDown = false;

  preparedJob.segments.forEach((segment) => {
    if (!finitePoint(segment.from) || !finitePoint(segment.to)) throw new Error("Trajetoria contem coordenadas invalidas.");
    if (segment.cutting && !toolDown) {
      commands.push({ type: "TOOL_DOWN" });
      toolDown = true;
    }
    if (!segment.cutting && toolDown) {
      commands.push({ type: "TOOL_UP" });
      toolDown = false;
    }
    commands.push({
      type: segment.cutting ? "CUT_MOVE" : "RAPID_MOVE",
      x: Number(segment.to.x.toFixed(3)),
      y: Number(segment.to.y.toFixed(3)),
      speed,
    });
  });
  if (toolDown) commands.push({ type: "TOOL_UP" });
  commands.push({ type: "JOB_END" });
  return { protocol: "betty-cut/1", commands };
}
