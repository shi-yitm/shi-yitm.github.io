const SQRT_TWO = Math.SQRT2;

const QUICK_CALIBRATION_PLAN = {
  stageRounds: { practice: 4, coarse: 8, refine: 6, validate: 6 },
  totalRounds: 24,
};

const COMPLETE_CALIBRATION_PLAN = {
  stageRounds: { practice: 4, coarse: 20, refine: 12, validate: 12 },
  totalRounds: 48,
};

export function calibrationPlan(mode) {
  const plan = mode === 'complete' ? COMPLETE_CALIBRATION_PLAN : QUICK_CALIBRATION_PLAN;
  return {
    stageRounds: { ...plan.stageRounds },
    totalRounds: plan.totalRounds,
  };
}

export function expandIfEdge(candidates, winnerIndex) {
  if (winnerIndex === 0) {
    return [Math.round(candidates[0] / SQRT_TWO), ...candidates];
  }
  if (winnerIndex === candidates.length - 1) {
    return [...candidates, Math.round(candidates.at(-1) * SQRT_TWO)];
  }
  return [...candidates];
}

export function refineAround(candidates, winnerIndex) {
  const center = candidates[winnerIndex];
  const lower = Math.sqrt(candidates[winnerIndex - 1] * center);
  const upper = Math.sqrt(center * candidates[winnerIndex + 1]);
  return [Math.round(lower), center, Math.round(upper)];
}

export function validationCandidates(center) {
  return [Math.round(center * 0.92), center, Math.round(center * 1.08)];
}

export function balancedOrder(candidates, repetitions = 1, random = Math.random) {
  const remaining = new Map(candidates.map((value) => [value, repetitions]));
  const result = [];
  while (result.length < candidates.length * repetitions) {
    const available = candidates.filter((value) => remaining.get(value) > 0 && value !== result.at(-1));
    const pool = available.length ? available : candidates.filter((value) => remaining.get(value) > 0);
    const maxRemaining = Math.max(...pool.map((value) => remaining.get(value)));
    const tied = pool.filter((value) => remaining.get(value) === maxRemaining);
    const selected = tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
    result.push(selected);
    remaining.set(selected, remaining.get(selected) - 1);
  }
  return result;
}
