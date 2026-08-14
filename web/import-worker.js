import { importCutFile, prepareCutJob } from "/src/core/job-pipeline.js";

self.addEventListener("message", ({ data }) => {
  const { id, filename, source, machineEnvelope } = data;
  try {
    const job = importCutFile(filename, source);
    const prepared = prepareCutJob(job, machineEnvelope);
    self.postMessage({ id, job, prepared });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
