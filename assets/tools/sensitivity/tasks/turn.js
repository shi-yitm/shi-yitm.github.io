export function runTurn(samples) {
  if (!samples.length) return { arrivalMs: 0, overshootDeg: 0, settleMs: 0, boundaries: 0 };
  const startTime = samples[0].timeMs;
  const arrivalIndex = samples.findIndex((sample) => Math.abs(sample.errorDeg) <= 5);
  const arrival = arrivalIndex >= 0 ? samples[arrivalIndex] : samples.at(-1);
  const afterArrival = samples.slice(Math.max(0, arrivalIndex));
  const overshootDeg = Math.max(0, ...afterArrival.filter((sample) => sample.errorDeg < 0).map((sample) => Math.abs(sample.errorDeg)));
  const settled = afterArrival.find((sample) => Math.abs(sample.errorDeg) <= 1) ?? samples.at(-1);
  return {
    arrivalMs: arrival.timeMs - startTime,
    overshootDeg,
    settleMs: settled.timeMs - arrival.timeMs,
    boundaries: samples.filter((sample) => sample.boundary).length,
  };
}
