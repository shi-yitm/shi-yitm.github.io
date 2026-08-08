export async function leaveImmersiveTest({ exitPointerLock, exitFullscreen } = {}) {
  exitPointerLock?.();
  try {
    await exitFullscreen?.();
  } catch {
    // The report remains usable if the browser has already left fullscreen.
  }
}
