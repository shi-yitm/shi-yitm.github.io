export const CS2_YAW = 0.022;

export function edpi(dpi, sensitivity) {
  return dpi * sensitivity;
}

export function sensitivityForEdpi(value, dpi) {
  return value / dpi;
}

export function cmPer360(dpi, sensitivity) {
  return 360 * 2.54 / (edpi(dpi, sensitivity) * CS2_YAW);
}

export function degreesForCounts(counts, sensitivity) {
  return counts * sensitivity * CS2_YAW;
}

export function coarseCandidates() {
  return [400, 566, 800, 1131, 1600];
}
