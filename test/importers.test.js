import test from "node:test";
import assert from "node:assert/strict";
import { parseHpgl } from "../src/importers/hpgl.js";
import { parseSvg } from "../src/importers/svg.js";

test("converte PLT/HPGL para milimetros sem inventar fechamento", () => {
  const closed = parseHpgl("IN;PA0,0;PD400,0,400,400,0,400,0,0;PU;");
  assert.equal(closed.contours.length, 1);
  assert.deepEqual(closed.contours[0].points[1], { x: 10, y: 0 });
  assert.deepEqual(closed.contours[0].points.at(-1), { x: 0, y: 0 });

  const open = parseHpgl("PA0,0;PD400,0;PU;");
  assert.equal(open.contours[0].points.length, 2);
});

test("le elementos lineares de SVG", () => {
  const svg = `<svg><polygon points="0,0 100,0 100,50 0,50"/><path d="M 10 10 L 20 10 L 20 20 Z"/></svg>`;
  const result = parseSvg(svg);
  assert.equal(result.contours.length, 2);
  assert.deepEqual(result.contours[0].points.at(-1), { x: 0, y: 0 });
  assert.deepEqual(result.contours[1].points.at(-1), { x: 10, y: 10 });
});

test("converte SVG do MoldeLab de centimetros para milimetros e remove auxiliares", () => {
  const svg = `<svg width="20cm" height="10cm" viewBox="0 0 20 10">
    <rect x="0" y="0" width="20" height="10"/>
    <text>FIM 20 cm</text>
    <g><path d="M 1 1 L 10 1 L 10 5 Z"/><path d="M 2 2 L 3 2 Z" stroke-dasharray="1 1"/></g>
  </svg>`;
  const result = parseSvg(svg);
  assert.equal(result.contours.length, 1);
  assert.deepEqual(result.contours[0].points[1], { x: 100, y: 10 });
  assert.equal(result.warnings.length, 1);
});

test("recusa curvas SVG ainda nao achatadas", () => {
  assert.throws(() => parseSvg(`<svg><path d="M0 0 C 1 2 3 4 5 6"/></svg>`), /nao suportado/);
});
