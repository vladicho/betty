import { interpolate } from "/src/core/geometry.js";
import { MachineState, SimulatedCutter } from "/src/core/machine.js";
import { importCutFile, prepareCutJob } from "/src/core/job-pipeline.js";
import { createCommandProgram } from "/src/core/machine-protocol.js";

const canvas = document.querySelector("#cutCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  load: document.querySelector("#loadJob"),
  file: document.querySelector("#cutFile"),
  start: document.querySelector("#startJob"),
  pause: document.querySelector("#pauseJob"),
  emergency: document.querySelector("#emergencyStop"),
  reset: document.querySelector("#resetEmergency"),
  exportProgram: document.querySelector("#exportProgram"),
  speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speedValue"),
  stateLabel: document.querySelector("#stateLabel"),
  stateLight: document.querySelector("#stateLight"),
  progress: document.querySelector("#progress"),
  cutDistance: document.querySelector("#cutDistance"),
  travelDistance: document.querySelector("#travelDistance"),
  jobName: document.querySelector("#jobName"),
  importStatus: document.querySelector("#importStatus"),
  bedLength: document.querySelector("#bedLength"),
  bedWidth: document.querySelector("#bedWidth"),
  bedSize: document.querySelector("#bedSize"),
  toolPosition: document.querySelector("#toolPosition"),
  empty: document.querySelector("#emptyState"),
};

const labels = {
  [MachineState.IDLE]: "Sem trabalho",
  [MachineState.READY]: "Pronta",
  [MachineState.RUNNING]: "Cortando",
  [MachineState.PAUSED]: "Pausada",
  [MachineState.EMERGENCY]: "Emergência acionada",
  [MachineState.COMPLETE]: "Corte concluído",
};

const machine = new SimulatedCutter({ speed: Number(ui.speed.value) });
let plan = null;
let prepared = null;
let currentJob = null;
let segments = [];
let lastFrame = performance.now();
let viewSize = { width: 900, height: 600 };

function sampleContours() {
  const closed = (points) => [...points, points[0]];
  return [
    { id: "neck", kind: "internal", points: closed([{ x: 360, y: 210 }, { x: 400, y: 190 }, { x: 440, y: 210 }, { x: 420, y: 242 }, { x: 380, y: 242 }]) },
    { id: "front", kind: "external", points: closed([{ x: 270, y: 120 }, { x: 350, y: 105 }, { x: 380, y: 155 }, { x: 420, y: 155 }, { x: 450, y: 105 }, { x: 530, y: 120 }, { x: 585, y: 270 }, { x: 515, y: 295 }, { x: 490, y: 520 }, { x: 310, y: 520 }, { x: 285, y: 295 }, { x: 215, y: 270 }]) },
    { id: "pocket", kind: "external", points: closed([{ x: 650, y: 150 }, { x: 780, y: 150 }, { x: 770, y: 280 }, { x: 715, y: 310 }, { x: 660, y: 280 }]) },
    { id: "collar", kind: "external", points: closed([{ x: 625, y: 395 }, { x: 820, y: 365 }, { x: 845, y: 430 }, { x: 645, y: 465 }]) },
  ];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function screenPoint(point) {
  const padding = 35;
  const scaleX = (canvas.width - padding * 2) / viewSize.width;
  const scaleY = (canvas.height - padding * 2) / viewSize.height;
  const scale = Math.min(scaleX, scaleY);
  return { x: padding + point.x * scale, y: padding + point.y * scale };
}

function strokeSegment(segment, color, dashed = false, width = 2) {
  const from = screenPoint(segment.from);
  const to = screenPoint(segment.to);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width * Math.min(window.devicePixelRatio || 1, 2);
  ctx.setLineDash(dashed ? [7, 7] : []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw(snapshot = machine.snapshot()) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!segments.length) return;

  segments.forEach((segment, index) => {
    if (!segment.cutting) strokeSegment(segment, "#56615b", true, 1);
    else strokeSegment(segment, index < snapshot.segmentIndex ? "#b9f531" : "#d3dcd6", false, index < snapshot.segmentIndex ? 3 : 1.5);
  });

  const active = segments[Math.min(snapshot.segmentIndex, segments.length - 1)];
  if (!active) return;
  if (snapshot.segmentProgress > 0) {
    strokeSegment({ ...active, to: interpolate(active.from, active.to, snapshot.segmentProgress) }, active.cutting ? "#b9f531" : "#77827c", !active.cutting, 3);
  }
  const tool = snapshot.segmentIndex >= segments.length ? segments.at(-1).to : interpolate(active.from, active.to, snapshot.segmentProgress);
  const screen = screenPoint(tool);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 7 * Math.min(window.devicePixelRatio || 1, 2), 0, Math.PI * 2);
  ctx.fillStyle = snapshot.state === MachineState.EMERGENCY ? "#ff5d52" : "#b9f531";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ui.toolPosition.textContent = `X ${tool.x.toFixed(0)} · Y ${tool.y.toFixed(0)}`;
}

function updateUi(snapshot) {
  ui.stateLabel.textContent = labels[snapshot.state];
  ui.stateLight.className = snapshot.state === MachineState.RUNNING ? "running" : snapshot.state === MachineState.EMERGENCY ? "emergency" : "";
  const progress = snapshot.segmentCount ? ((snapshot.segmentIndex + snapshot.segmentProgress) / snapshot.segmentCount) * 100 : 0;
  ui.progress.textContent = `${Math.min(100, progress).toFixed(0)}%`;
  ui.start.disabled = ![MachineState.READY, MachineState.PAUSED].includes(snapshot.state);
  ui.pause.disabled = snapshot.state !== MachineState.RUNNING;
  ui.reset.disabled = snapshot.state !== MachineState.EMERGENCY;
  ui.load.disabled = snapshot.state === MachineState.RUNNING;
  ui.file.disabled = snapshot.state === MachineState.RUNNING;
  ui.exportProgram.disabled = !prepared || snapshot.state === MachineState.RUNNING || snapshot.state === MachineState.EMERGENCY;
  draw(snapshot);
}

machine.subscribe(updateUi);
function loadJob(job) {
  const machineEnvelope = { width: Number(ui.bedLength.value), height: Number(ui.bedWidth.value) };
  prepared = prepareCutJob(job, machineEnvelope);
  currentJob = job;
  plan = prepared.plan;
  segments = prepared.segments;
  const box = prepared.validation.bounds;
  viewSize = {
    width: Math.max(900, box.maxX * 1.06),
    height: Math.max(600, box.maxY * 1.06),
  };
  machine.load(segments);
  ui.cutDistance.textContent = `${plan.cutDistance.toFixed(0)} mm`;
  ui.travelDistance.textContent = `${plan.travelDistance.toFixed(0)} mm`;
  ui.jobName.textContent = job.name;
  ui.empty.hidden = true;
  const warning = prepared.validation.warnings.join(" ");
  ui.importStatus.textContent = warning || `${job.contours.length} trajetoria(s) validadas e prontas para simular.`;
  ui.importStatus.className = `import-status ${warning ? "warning" : "ok"}`;
}

ui.load.addEventListener("click", () => {
  try {
    loadJob({ name: "molde-teste.svg", format: "svg", units: "mm", contours: sampleContours() });
  } catch (error) {
    ui.importStatus.textContent = error.message;
    ui.importStatus.className = "import-status error";
  }
});
ui.file.addEventListener("change", async () => {
  const file = ui.file.files[0];
  if (!file) return;
  try {
    const source = await file.text();
    loadJob(importCutFile(file.name, source));
  } catch (error) {
    prepared = null;
    currentJob = null;
    plan = null;
    segments = [];
    machine.load([]);
    ui.importStatus.textContent = error.message;
    ui.importStatus.className = "import-status error";
  }
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
});
[ui.bedLength, ui.bedWidth].forEach((input) => input.addEventListener("change", () => {
  ui.bedSize.textContent = `MESA ${ui.bedLength.value} × ${ui.bedWidth.value} MM`;
  if (!currentJob) return;
  try {
    loadJob(currentJob);
  } catch (error) {
    prepared = null;
    plan = null;
    segments = [];
    machine.load([]);
    ui.importStatus.textContent = error.message;
    ui.importStatus.className = "import-status error";
  }
}));
window.addEventListener("resize", () => draw());

function animate(now) {
  const delta = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  machine.tick(delta);
  requestAnimationFrame(animate);
}

updateUi(machine.snapshot());
requestAnimationFrame(animate);
