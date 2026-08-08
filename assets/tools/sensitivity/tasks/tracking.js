const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function trackingPath(segments = 8, random = Math.random) {
  let yawDeg = 0;
  let pitchDeg = 0;
  return Array.from({ length: segments }, (_, index) => {
    yawDeg += (random() - 0.5) * 18;
    pitchDeg = Math.max(-12, Math.min(12, pitchDeg + (random() - 0.5) * 8));
    return { timeMs: index * 750, yawDeg, pitchDeg, speed: 0.75 + random() * 0.5 };
  });
}

export function runTracking(samples) {
  if (!samples.length) return { coverage: 0, meanErrorDeg: 0, jitter: 0, reacquireMs: 0 };
  const errors = samples.map((sample) => Math.abs(sample.errorDeg));
  const jitter = errors.slice(1).map((error, index) => Math.abs(error - errors[index]));
  const reacquire = [];
  let lostAt = null;
  for (const sample of samples) {
    if (!sample.onTarget && lostAt === null) lostAt = sample.timeMs;
    if (sample.onTarget && lostAt !== null) {
      reacquire.push(sample.timeMs - lostAt);
      lostAt = null;
    }
  }
  return {
    coverage: samples.filter((sample) => sample.onTarget).length / samples.length * 100,
    meanErrorDeg: mean(errors),
    jitter: mean(jitter),
    reacquireMs: mean(reacquire),
  };
}
