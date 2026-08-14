import test from "node:test";
import assert from "node:assert/strict";
import { simplifyPreviewSegments } from "../src/core/preview.js";

function line(count, contourId = "shape") {
  return Array.from({ length: count }, (_unused, index) => ({
    from: { x: index, y: index % 2 },
    to: { x: index + 1, y: (index + 1) % 2 },
    cutting: true,
    contourId,
    length: 1,
  }));
}

test("mantem segmentos pequenos sem alterar os dados exatos", () => {
  const segments = line(4);
  assert.equal(simplifyPreviewSegments(segments), segments);
});

test("reduz apenas a representacao visual e preserva as extremidades", () => {
  const segments = line(100);
  const preview = simplifyPreviewSegments(segments, { maxSegments: 10 });
  assert.ok(preview.length <= 10);
  assert.deepEqual(preview[0].from, segments[0].from);
  assert.deepEqual(preview.at(-1).to, segments.at(-1).to);
  assert.equal(segments.length, 100);
});

test("nao conecta trajetorias diferentes durante a simplificacao", () => {
  const segments = [...line(20, "a"), ...line(20, "b")];
  segments[20] = { ...segments[20], from: { x: 100, y: 100 }, to: { x: 101, y: 100 } };
  const preview = simplifyPreviewSegments(segments, { maxSegments: 8 });
  assert.ok(preview.some((segment) => segment.contourId === "a"));
  assert.ok(preview.some((segment) => segment.contourId === "b"));
  assert.equal(preview.some((segment) => segment.from.x < 20 && segment.to.x >= 100), false);
});
