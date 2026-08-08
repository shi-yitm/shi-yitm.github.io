const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function flickTargets(count = 12, random = Math.random) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.35;
    const radius = 8 + random() * 27;
    return { yawDeg: Math.cos(angle) * radius, pitchDeg: Math.sin(angle) * radius * 0.55 };
  });
}

export function runFlick(samples) {
  if (!samples.length) return { hits: 0, accuracy: 0, latencyMs: 0, overshootDeg: 0, clickErrorDeg: 0 };
  const hits = samples.filter((sample) => sample.hit).length;
  return {
    hits,
    accuracy: hits / samples.length * 100,
    latencyMs: mean(samples.map((sample) => sample.latencyMs)),
    overshootDeg: mean(samples.map((sample) => Math.abs(sample.overshootDeg))),
    clickErrorDeg: mean(samples.map((sample) => Math.abs(sample.clickErrorDeg))),
  };
}
