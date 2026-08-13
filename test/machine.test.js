import test from "node:test";
import assert from "node:assert/strict";
import { MachineState, SimulatedCutter } from "../src/core/machine.js";

test("executa um trabalho ate o fim", () => {
  const machine = new SimulatedCutter({ speed: 10 });
  machine.load([{ length: 10 }]);
  assert.equal(machine.state, MachineState.READY);
  assert.equal(machine.start(), true);
  machine.tick(1);
  assert.equal(machine.state, MachineState.COMPLETE);
});

test("emergencia interrompe movimento e exige liberacao", () => {
  const machine = new SimulatedCutter({ speed: 10 });
  machine.load([{ length: 100 }]);
  machine.start();
  machine.tick(1);
  const before = machine.segmentProgress;
  machine.emergencyStop();
  machine.tick(5);
  assert.equal(machine.segmentProgress, before);
  assert.equal(machine.state, MachineState.EMERGENCY);
  assert.equal(machine.start(), false);
  assert.equal(machine.resetEmergency(), true);
  assert.equal(machine.state, MachineState.PAUSED);
});
