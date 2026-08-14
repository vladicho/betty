import test from "node:test";
import assert from "node:assert/strict";
import { planCutPath } from "../src/core/path-planner.js";

test("prioriza contornos internos", () => {
  const contours = [
    { id: "outside", kind: "external", points: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
    { id: "inside", kind: "internal", points: [{ x: 10, y: 0 }, { x: 11, y: 0 }] },
  ];
  const plan = planCutPath(contours);
  assert.deepEqual(plan.contours.map(({ id }) => id), ["inside", "outside"]);
  assert.equal(plan.cutDistance, 2);
});

test("inverte trajetoria aberta e gira contorno fechado para reduzir deslocamento", () => {
  const open = { id: "open", kind: "internal", points: [{ x: 100, y: 0 }, { x: 10, y: 0 }] };
  const closed = { id: "closed", kind: "external", points: [{ x: 100, y: 100 }, { x: 20, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
  const plan = planCutPath([open, closed]);
  assert.deepEqual(plan.contours[0].points[0], { x: 10, y: 0 });
  assert.deepEqual(plan.contours[1].points[0], { x: 100, y: 0 });
});
