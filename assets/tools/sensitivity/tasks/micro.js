export function runMicro(samples) {
  if (!samples.length) return { initialErrorDeg: 0, corrections: 0, correctionMs: 0, reversals: 0 };
  let reversals = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (Math.sign(samples[index].direction) !== Math.sign(samples[index - 1].direction)) reversals += 1;
  }
  return {
    initialErrorDeg: Math.abs(samples[0].errorDeg),
    corrections: Math.max(0, samples.length - 1),
    correctionMs: samples.at(-1).timeMs - samples[0].timeMs,
    reversals,
  };
}
