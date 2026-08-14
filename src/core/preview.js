function samePoint(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function sameRun(a, b) {
  return a.cutting === b.cutting
    && a.contourId === b.contourId
    && samePoint(a.to, b.from);
}

function segmentRun(run, stride) {
  if (run.length <= 1 || stride <= 1) return run;
  const points = [run[0].from];
  for (let index = stride - 1; index < run.length - 1; index += stride) {
    points.push(run[index].to);
  }
  points.push(run.at(-1).to);
  return points.slice(1).map((to, index) => ({
    from: points[index],
    to,
    cutting: run[0].cutting,
    contourId: run[0].contourId,
  }));
}

export function simplifyPreviewSegments(segments, { maxSegments = 4000 } = {}) {
  if (segments.length <= maxSegments || maxSegments < 1) return segments;
  const stride = Math.ceil(segments.length / maxSegments);
  const simplified = [];
  let run = [];

  const flush = () => {
    simplified.push(...segmentRun(run, stride));
    run = [];
  };

  segments.forEach((segment) => {
    if (run.length && !sameRun(run.at(-1), segment)) flush();
    run.push(segment);
  });
  if (run.length) flush();
  return simplified;
}
