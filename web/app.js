import { distance, interpolate } from "/src/core/geometry.js";
import { planCutPath } from "/src/core/path-planner.js";
import { MachineState, SimulatedCutter } from "/src/core/machine.js";

const canvas = document.querySelector("#cutCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  load: document.querySelector("#loadJob"),
  start: document.querySelector("#startJob"),
  pause: document.querySelector("#pauseJob"),
  emergency: document.querySelector("#emergencyStop"),
  reset: document.querySelector("#resetEmergency"),
  speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speedValue"),
  stateLabel: document.querySelector("#stateLabel"),
  stateLight: document.querySelector("#stateLight"),
  progress: document.querySelector("#progress"),
  cutDistance: document.querySelector("#cutDistance"),
  travelDistance: document.querySelector("#travelDistance"),
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
let segments = [];
let lastFrame = performance.now();

function sampleContours() {
  const closed = (points) => [...points, points[0]];
  return [
    { id: "neck", kind: "internal", points: closed([{ x: 360, y: 210 }, { x: 400, y: 190 }, { x: 440, y: 210 }, { x: 420, y: 242 }, { x: 380, y: 242 }]) },
    { id: "front", kind: "external", points: closed([{ x: 270, y: 120 }, { x: 350, y: 105 }, { x: 380, y: 155 }, { x: 420, y: 155 }, { x: 450, y: 105 }, { x: 530, y: 120 }, { x: 585, y: 270 }, { x: 515, y: 295 }, { x: 490, y: 520 }, { x: 310, y: 520 }, { x: 285, y: 295 }, { x: 215, y: 270 }]) },
    { id: "pocket", kind: "external", points: closed([{ x: 650, y: 150 }, { x: 780, y: 150 }, { x: 770, y: 280 }, { x: 715, y: 310 }, { x: 660, y: 280 }]) },
    { id: "collar", kind: "external", points: closed([{ x: 625, y: 395 }, { x: 820, y: 365 }, { x: 845, y: 430 }, { x: 645, y: 465 }]) },
  ];
}

function buildSegments(cutPlan) {
  const result = [];
  let cursor = { x: 0, y: 0 };
  cutPlan.contours.forEach((contour) => {
    const start = contour.points[0];
    if (distance(cursor, start) > 0) result.push({ from: cursor, to: start, cutting: false, length: distance(cursor, start) });
    for (let index = 1; index < contour.points.length; index += 1) {
      const from = contour.points[index - 1];
      const to = contour.points[index];
      result.push({ from, to, cutting: true, length: distance(from, to), contourId: contour.id });
    }
    cursor = contour.points.at(-1);
  });
  return result;
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
  const scaleX = (canvas.width - padding * 2) / 900;
  const scaleY = (canvas.height - padding * 2) / 600;
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
  draw(snapshot);
}

machine.subscribe(updateUi);
ui.load.addEventListener("click", () => {
  plan = planCutPath(sampleContours());
  segments = buildSegments(plan);
  machine.load(segments);
  ui.cutDistance.textContent = `${plan.cutDistance.toFixed(0)} mm`;
  ui.travelDistance.textContent = `${plan.travelDistance.toFixed(0)} mm`;
  ui.empty.hidden = true;
});
ui.start.addEventListener("click", () => machine.start());
ui.pause.addEventListener("click", () => machine.pause());
ui.emergency.addEventListener("click", () => machine.emergencyStop());
ui.reset.addEventListener("click", () => machine.resetEmergency());
ui.speed.addEventListener("input", () => {
  machine.speed = Number(ui.speed.value);
  ui.speedValue.textContent = `${machine.speed} mm/s`;
});
window.addEventListener("resize", () => draw());

function animate(now) {
  const delta = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  machine.tick(delta);
  requestAnimationFrame(animate);
}

updateUi(machine.snapshot());
requestAnimationFrame(animate);
