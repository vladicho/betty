import test from "node:test";
import assert from "node:assert/strict";
import { importCutFile, prepareCutJob, validateJob } from "../src/core/job-pipeline.js";
import { createCommandProgram } from "../src/core/machine-protocol.js";

test("classifica furo interno e prepara comandos", () => {
  const source = `<svg>
    <polygon points="0,0 100,0 100,100 0,100"/>
    <polygon points="25,25 75,25 75,75 25,75"/>
  </svg>`;
  const job = importCutFile("molde.svg", source);
  assert.equal(job.contours[0].kind, "external");
  assert.equal(job.contours[1].kind, "internal");

  const prepared = prepareCutJob(job, { width: 1600, height: 1000 });
  assert.equal(prepared.plan.contours[0].kind, "internal");
  const program = createCommandProgram(prepared, { speed: 120 });
  assert.equal(program.protocol, "betty-cut/1");
  assert.equal(program.commands[0].type, "JOB_BEGIN");
  assert.equal(program.commands.at(-1).type, "JOB_END");
  assert.ok(program.commands.some((command) => command.type === "TOOL_DOWN"));
});

test("bloqueia trabalho maior que a mesa", () => {
  const job = importCutFile("grande.plt", "PA0,0;PD80000,0;PU;");
  const validation = validateJob(job, { width: 1600, height: 1000 });
  assert.equal(validation.valid, false);
  assert.match(validation.errors[0], /excede a mesa/);
});
