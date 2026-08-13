export const MachineState = Object.freeze({
  IDLE: "idle",
  READY: "ready",
  RUNNING: "running",
  PAUSED: "paused",
  EMERGENCY: "emergency",
  COMPLETE: "complete",
});

export class SimulatedCutter {
  constructor({ speed = 80 } = {}) {
    this.speed = speed;
    this.state = MachineState.IDLE;
    this.segments = [];
    this.segmentIndex = 0;
    this.segmentProgress = 0;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => listener(this.snapshot()));
  }

  snapshot() {
    return {
      state: this.state,
      segmentIndex: this.segmentIndex,
      segmentProgress: this.segmentProgress,
      segmentCount: this.segments.length,
    };
  }

  load(segments) {
    if (this.state === MachineState.RUNNING) throw new Error("Pause a maquina antes de carregar outro trabalho.");
    this.segments = [...segments];
    this.segmentIndex = 0;
    this.segmentProgress = 0;
    this.state = segments.length ? MachineState.READY : MachineState.IDLE;
    this.emit();
  }

  start() {
    if (![MachineState.READY, MachineState.PAUSED].includes(this.state)) return false;
    this.state = MachineState.RUNNING;
    this.emit();
    return true;
  }

  pause() {
    if (this.state !== MachineState.RUNNING) return false;
    this.state = MachineState.PAUSED;
    this.emit();
    return true;
  }

  emergencyStop() {
    this.state = MachineState.EMERGENCY;
    this.emit();
  }

  resetEmergency() {
    if (this.state !== MachineState.EMERGENCY) return false;
    this.state = this.segments.length ? MachineState.PAUSED : MachineState.IDLE;
    this.emit();
    return true;
  }

  tick(deltaSeconds) {
    if (this.state !== MachineState.RUNNING || !this.segments.length) return;
    let remaining = Math.max(0, deltaSeconds) * this.speed;
    while (remaining > 0 && this.segmentIndex < this.segments.length) {
      const segment = this.segments[this.segmentIndex];
      const available = segment.length * (1 - this.segmentProgress);
      if (remaining < available) {
        this.segmentProgress += remaining / segment.length;
        remaining = 0;
      } else {
        remaining -= available;
        this.segmentIndex += 1;
        this.segmentProgress = 0;
      }
    }
    if (this.segmentIndex >= this.segments.length) this.state = MachineState.COMPLETE;
    this.emit();
  }
}
