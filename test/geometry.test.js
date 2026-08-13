import test from "node:test";
import assert from "node:assert/strict";
import { bounds, distance, interpolate, polylineLength } from "../src/core/geometry.js";

test("calcula distancia e comprimento", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }]), 8);
});

test("calcula limites e interpolacao", () => {
  assert.deepEqual(bounds([{ x: 8, y: -2 }, { x: 1, y: 7 }]), { minX: 1, minY: -2, maxX: 8, maxY: 7 });
  assert.deepEqual(interpolate({ x: 0, y: 0 }, { x: 10, y: 20 }, .25), { x: 2.5, y: 5 });
});
