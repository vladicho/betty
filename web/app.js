import { interpolate } from "/src/core/geometry.js";
import { MachineState, SimulatedCutter } from "/src/core/machine.js";
import { importCutFile, prepareCutJob } from "/src/core/job-pipeline.js";
import { createCommandProgram } from "/src/core/machine-protocol.js";
import { simplifyPreviewSegments } from "/src/core/preview.js";

const canvas = document.querySelector("#cutCanvas");
const ctx = canvas.getContext("2d");
const baseCanvas = document.createElement("canvas");
const baseCtx = baseCanvas.getContext("2d");
const completedCanvas = document.createElement("canvas");
const completedCtx = completedCanvas.getContext("2d");
const ui = {
  load: document.querySelector("#loadJob"), file: document.querySelector("#cutFile"),
  start: document.querySelector("#startJob"), pause: document.querySelector("#pauseJob"),
  emergency: document.querySelector("#emergencyStop"), reset: document.querySelector("#resetEmergency"),
  exportProgram: document.querySelector("#exportProgram"), speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speedValue"), stateLabel: document.querySelector("#stateLabel"),
  stateLight: document.querySelector("#stateLight"), progress: document.querySelector("#progress"),
  cutDistance: document.querySelector("#cutDistance"), travelDistance: document.querySelector("#travelDistance"),
  estimatedTime: document.querySelector("#estimatedTime"), cutOrder: document.querySelector("#cutOrder"),
  jobName: document.querySelector("#jobName"), importStatus: document.querySelector("#importStatus"),
  bedLength: document.querySelector("#bedLength"), bedWidth: document.querySelector("#bedWidth"),
  bedSize: document.querySelector("#bedSize"), toolPosition: document.querySelector("#toolPosition"),
  empty: document.querySelector("#emptyState"),
};

const labels = {
  [MachineState.IDLE]: "Sem trabalho", [MachineState.READY]: "Pronta",
  [MachineState.RUNNING]: "Cortando", [MachineState.PAUSED]: "Pausada",
  [MachineState.EMERGENCY]: "Emergência acionada", [MachineState.COMPLETE]: "Corte concluído",
};

const machine = new SimulatedCutter({ speed: Number(ui.speed.value) });
let plan = null;
let prepared = null;
let currentJob = null;
let segments = [];
let previewSegments = [];
let paintedSegmentCount = 0;
let viewSize = { width: 900, height: 600 };
let latestSnapshot = machine.snapshot();
let previousState = null;
let lastUiUpdate = 0;
let animationFrame = null;
let lastFrame = performance.now();
let resizeFrame = null;
let renderRatio = 1;
let worker = null;
let workerSequence = 0;
const workerRequests = new Map();

function sampleContours() {
  const closed = (points) => [...points, points[0]];
  return [
    { id: "neck", kind: "internal", points: closed([{ x: 360, y: 210 }, { x: 400, y: 190 }, { x: 440, y: 210 }, { x: 420, y: 242 }, { x: 380, y: 242 }]) },
    { id: "front", kind: "external", points: closed([{ x: 270, y: 120 }, { x: 350, y: 105 }, { x: 380, y: 155 }, { x: 420, y: 155 }, { x: 450, y: 105 }, { x: 530, y: 120 }, { x: 585, y: 270 }, { x: 515, y: 295 }, { x: 490, y: 520 }, { x: 310, y: 520 }, { x: 285, y: 295 }, { x: 215, y: 270 }]) },
    { id: "pocket", kind: "external", points: closed([{ x: 650, y: 150 }, { x: 780, y: 150 }, { x: 770, y: 280 }, { x: 715, y: 310 }, { x: 660, y: 280 }]) },
    { id: "collar", kind: "external", points: closed([{ x: 625, y: 395 }, { x: 820, y: 365 }, { x: 845, y: 430 }, { x: 645, y: 465 }]) },
  ];
}

function mobileCanvas() {
  return window.matchMedia("(max-width: 850px)").matches;
}

function desiredCanvasRatio() {
  return Math.min(window.devicePixelRatio || 1, mobileCanvas() ? 1.25 : 2);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = desiredCanvasRatio();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width === width && canvas.height === height) return false;
  renderRatio = ratio;
  [canvas, baseCanvas, completedCanvas].forEach((layer) => { layer.width = width; layer.height = height; });
  return true;
}

function screenPoint(point) {
  const padding = 35;
  const scaleX = (canvas.width - padding * 2) / viewSize.width;
  const scaleY = (canvas.height - padding * 2) / viewSize.height;
  const scale = Math.min(scaleX, scaleY);
  return { x: padding + point.x * scale, y: padding + point.y * scale };
}

function strokeSegment(target, segment, color, dashed = false, width = 2) {
  const from = screenPoint(segment.from);
  const to = screenPoint(segment.to);
  target.beginPath();
  target.moveTo(from.x, from.y);
  target.lineTo(to.x, to.y);
  target.strokeStyle = color;
  target.lineWidth = width * renderRatio;
  target.setLineDash(dashed ? [7, 7] : []);
  target.stroke();
  target.setLineDash([]);
}

function paintCompletedSegments(segmentIndex) {
  const end = Math.min(segmentIndex, segments.length);
  for (let index = paintedSegmentCount; index < end; index += 1) {
    const segment = segments[index];
    if (segment.cutting) strokeSegment(completedCtx, segment, "#b9f531", false, 3);
  }
  paintedSegmentCount = Math.max(paintedSegmentCount, end);
}

function rebuildBaseLayer(snapshot = latestSnapshot) {
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  previewSegments.forEach((segment) => {
    strokeSegment(baseCtx, segment, segment.cutting ? "#d3dcd6" : "#56615b", !segment.cutting, segment.cutting ? 1.5 : 1);
  });
  completedCtx.clearRect(0, 0, completedCanvas.width, completedCanvas.height);
  paintedSegmentCount = 0;
  paintCompletedSegments(snapshot.segmentIndex);
}

function activeTool(snapshot) {
  if (!segments.length) return null;
  if (snapshot.segmentIndex >= segments.length) return segments.at(-1).to;
  const active = segments[snapshot.segmentIndex];
  return interpolate(active.from, active.to, snapshot.segmentProgress);
}

function draw(snapshot = latestSnapshot) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!segments.length) return;
  paintCompletedSegments(snapshot.segmentIndex);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(completedCanvas, 0, 0);
  const active = segments[Math.min(snapshot.segmentIndex, segments.length - 1)];
  if (active && snapshot.segmentProgress > 0 && snapshot.segmentIndex < segments.length) {
    strokeSegment(ctx, { ...active, to: interpolate(active.from, active.to, snapshot.segmentProgress) }, active.cutting ? "#b9f531" : "#77827c", !active.cutting, 3);
  }
  const tool = activeTool(snapshot);
  if (!tool) return;
  const screen = screenPoint(tool);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 7 * renderRatio, 0, Math.PI * 2);
  ctx.fillStyle = snapshot.state === MachineState.EMERGENCY ? "#ff5d52" : "#b9f531";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = mobileCanvas() ? 7 : 14;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function updateControls(snapshot) {
  ui.stateLabel.textContent = labels[snapshot.state];
  ui.stateLight.className = snapshot.state === MachineState.RUNNING ? "running" : snapshot.state === MachineState.EMERGENCY ? "emergency" : "";
  ui.start.disabled = ![MachineState.READY, MachineState.PAUSED].includes(snapshot.state);
  ui.pause.disabled = snapshot.state !== MachineState.RUNNING;
  ui.reset.disabled = snapshot.state !== MachineState.EMERGENCY;
  ui.load.disabled = snapshot.state === MachineState.RUNNING;
  ui.file.disabled = snapshot.state === MachineState.RUNNING;
  ui.exportProgram.disabled = !prepared || snapshot.state === MachineState.RUNNING || snapshot.state === MachineState.EMERGENCY;
}

function updateLiveText(snapshot) {
  const progress = snapshot.segmentCount ? ((snapshot.segmentIndex + snapshot.segmentProgress) / snapshot.segmentCount) * 100 : 0;
  ui.progress.textContent = `${Math.min(100, progress).toFixed(0)}%`;
  const tool = activeTool(snapshot);
  ui.toolPosition.textContent = tool ? `X ${tool.x.toFixed(0)} · Y ${tool.y.toFixed(0)}` : "X 0 · Y 0";
}

function ensureAnimation() {
  if (animationFrame !== null) return;
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(animate);
}

function handleSnapshot(snapshot, force = false) {
  latestSnapshot = snapshot;
  const stateChanged = snapshot.state !== previousState;
  const now = performance.now();
  if (force || stateChanged) updateControls(snapshot);
  if (force || stateChanged || now - lastUiUpdate >= 100) {
    updateLiveText(snapshot);
    lastUiUpdate = now;
  }
  draw(snapshot);
  previousState = snapshot.state;
  if (snapshot.state === MachineState.RUNNING) ensureAnimation();
}

function animate(now) {
  animationFrame = null;
  const delta = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  machine.tick(delta);
}

function updateEstimate() {
  if (!plan) { ui.estimatedTime.textContent = "—"; return; }
  const seconds = (plan.cutDistance + plan.travelDistance) / machine.speed;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  ui.estimatedTime.textContent = minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}

function machineEnvelope() {
  return { width: Number(ui.bedLength.value), height: Number(ui.bedWidth.value) };
}

function previewLimit() {
  return mobileCanvas() ? 1500 : 4000;
}

function applyPreparedJob(job, nextPrepared) {
  prepared = nextPrepared;
  currentJob = job;
  plan = prepared.plan;
  segments = prepared.segments;
  previewSegments = simplifyPreviewSegments(segments, { maxSegments: previewLimit() });
  const box = prepared.validation.bounds;
  viewSize = { width: Math.max(900, box.maxX * 1.06), height: Math.max(600, box.maxY * 1.06) };
  rebuildBaseLayer({ state: MachineState.READY, segmentIndex: 0, segmentProgress: 0, segmentCount: segments.length });
  machine.load(segments);
  ui.cutDistance.textContent = `${plan.cutDistance.toFixed(0)} mm`;
  ui.travelDistance.textContent = `${plan.travelDistance.toFixed(0)} mm`;
  ui.cutOrder.textContent = `${plan.contours.filter(({ kind }) => kind === "internal").length} internas → ${plan.contours.filter(({ kind }) => kind === "external").length} externas`;
  updateEstimate();
  ui.jobName.textContent = job.name;
  ui.empty.hidden = true;
  const warning = prepared.validation.warnings.join(" ");
  const previewNote = previewSegments.length < segments.length ? ` Prévia otimizada: ${previewSegments.length} de ${segments.length} segmentos; o programa mantém todos os pontos.` : "";
  ui.importStatus.textContent = `${warning || `${job.contours.length} trajetoria(s) validadas e prontas para simular.`}${previewNote}`;
  ui.importStatus.className = `import-status ${warning ? "warning" : "ok"}`;
}

function loadJob(job) {
  applyPreparedJob(job, prepareCutJob(job, machineEnvelope()));
}

function createImportWorker() {
  if (!("Worker" in window)) return null;
  try {
    const nextWorker = new Worker("/import-worker.js", { type: "module" });
    nextWorker.addEventListener("message", ({ data }) => {
      const request = workerRequests.get(data.id);
      if (!request) return;
      workerRequests.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data);
    });
    nextWorker.addEventListener("error", () => {
      workerRequests.forEach(({ reject }) => {
        const error = new Error("O processamento em segundo plano foi interrompido.");
        error.workerFailure = true;
        reject(error);
      });
      workerRequests.clear();
      nextWorker.terminate();
      if (worker === nextWorker) worker = null;
    });
    return nextWorker;
  } catch { return null; }
}

async function prepareImportedSource(filename, source) {
  worker ||= createImportWorker();
  if (worker) {
    const id = ++workerSequence;
    try {
      return await new Promise((resolve, reject) => {
        workerRequests.set(id, { resolve, reject });
        worker.postMessage({ id, filename, source, machineEnvelope: machineEnvelope() });
      });
    } catch (error) {
      if (!error.workerFailure) throw error;
    }
  }
  const job = importCutFile(filename, source);
  return { job, prepared: prepareCutJob(job, machineEnvelope()) };
}

function clearJobWithError(error) {
  prepared = null;
  currentJob = null;
  plan = null;
  segments = [];
  previewSegments = [];
  rebuildBaseLayer({ segmentIndex: 0 });
  machine.load([]);
  ui.importStatus.textContent = error.message;
  ui.importStatus.className = "import-status error";
}

machine.subscribe((snapshot) => handleSnapshot(snapshot));

ui.load.addEventListener("click", () => {
  try { loadJob({ name: "molde-teste.svg", format: "svg", units: "mm", contours: sampleContours() }); }
  catch (error) { ui.importStatus.textContent = error.message; ui.importStatus.className = "import-status error"; }
});

ui.file.addEventListener("change", async () => {
  const file = ui.file.files[0];
  if (!file) return;
  ui.importStatus.textContent = "Processando arquivo em segundo plano…";
  ui.importStatus.className = "import-status";
  try {
    const source = await file.text();
    const result = await prepareImportedSource(file.name, source);
    applyPreparedJob(result.job, result.prepared);
  } catch (error) { clearJobWithError(error); }
});

ui.start.addEventListener("click", () => machine.start());
ui.pause.addEventListener("click", () => machine.pause());
ui.emergency.addEventListener("click", () => machine.emergencyStop());
ui.reset.addEventListener("click", () => machine.resetEmergency());
ui.exportProgram.addEventListener("click", () => {
  if (!prepared) return;
  const program = createCommandProgram(prepared, { speed: machine.speed });
  const blob = new Blob([JSON.stringify(program, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${prepared.job.name.replace(/\.[^.]+$/, "")}.betty.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  ui.importStatus.textContent = "Programa neutro gerado. O envio fisico continua bloqueado ate definirmos o controlador.";
  ui.importStatus.className = "import-status warning";
});
ui.speed.addEventListener("input", () => {
  machine.speed = Number(ui.speed.value);
  ui.speedValue.textContent = `${machine.speed} mm/s`;
  updateEstimate();
});
[ui.bedLength, ui.bedWidth].forEach((input) => input.addEventListener("change", () => {
  ui.bedSize.textContent = `MESA ${ui.bedLength.value} × ${ui.bedWidth.value} MM`;
  if (!currentJob) return;
  try { loadJob(currentJob); } catch (error) { clearJobWithError(error); }
}));

function queueResize() {
  if (resizeFrame !== null) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    if (!resizeCanvas()) return;
    previewSegments = simplifyPreviewSegments(segments, { maxSegments: previewLimit() });
    rebuildBaseLayer(latestSnapshot);
    draw(latestSnapshot);
  });
}

window.addEventListener("resize", queueResize, { passive: true });
if ("ResizeObserver" in window) new ResizeObserver(queueResize).observe(canvas);

resizeCanvas();
rebuildBaseLayer(latestSnapshot);
handleSnapshot(latestSnapshot, true);
