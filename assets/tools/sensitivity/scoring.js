const ROLE_WEIGHTS = {
  allround: { tracking: 0.25, flick: 0.25, micro: 0.25, turn: 0.25 },
  rifle: { tracking: 0.3, flick: 0.2, micro: 0.35, turn: 0.15 },
  awp: { tracking: 0.15, flick: 0.35, micro: 0.35, turn: 0.15 },
  entry: { tracking: 0.2, flick: 0.25, micro: 0.15, turn: 0.4 },
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const inverse = (value, ceiling) => clamp(100 * (1 - Math.max(0, value) / ceiling));

export function scoreTaskMetrics(task, metrics) {
  const score = {
    tracking: (metrics.coverage ?? 0) * 0.6
      + inverse(metrics.meanErrorDeg ?? 8, 8) * 0.2
      + inverse(metrics.jitter ?? 6, 6) * 0.1
      + inverse(metrics.reacquireMs ?? 800, 800) * 0.1,
    flick: (metrics.accuracy ?? 0) * 0.6
      + inverse(metrics.latencyMs ?? 900, 900) * 0.25
      + inverse(metrics.overshootDeg ?? 15, 15) * 0.15,
    micro: inverse(metrics.initialErrorDeg ?? 6, 6) * 0.35
      + inverse(metrics.corrections ?? 8, 8) * 0.35
      + inverse(metrics.correctionMs ?? 900, 900) * 0.3,
    turn: inverse(metrics.arrivalMs ?? 1200, 1200) * 0.45
      + inverse(metrics.overshootDeg ?? 25, 25) * 0.3
      + inverse(metrics.settleMs ?? 800, 800) * 0.25,
  }[task];
  return Number.isFinite(score) ? Math.round(clamp(score)) : 0;
}

export function trimmedMean(values, trimRatio = 0.1) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimRatio);
  const kept = sorted.slice(trim, sorted.length - trim || sorted.length);
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function objectiveScore(tasks) {
  return Object.values(tasks).reduce((sum, value) => sum + value, 0) / Object.keys(tasks).length;
}

export function roleAdjustedScore(tasks, role = 'allround') {
  const objective = objectiveScore(tasks);
  const weights = ROLE_WEIGHTS[role] ?? ROLE_WEIGHTS.allround;
  const adjusted = Object.entries(weights).reduce((sum, [task, weight]) => sum + tasks[task] * weight, 0);
  return Math.max(objective - 10, Math.min(objective + 10, adjusted));
}

export function confidenceLevel({ rounds, fps, agreement }) {
  if (fps < 50 || rounds < 10 || agreement < 0.7) return 'low';
  if (rounds >= 18 && fps >= 60 && agreement >= 0.9) return 'high';
  return 'medium';
}

export { ROLE_WEIGHTS };
