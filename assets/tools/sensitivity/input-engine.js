const RAW_INPUT_ERROR = '原始鼠标输入不可用，请使用最新版 Chrome 或 Edge';

export function createInputEngine(options = {}) {
  const documentTarget = options.documentTarget ?? globalThis.document;
  const windowTarget = options.windowTarget ?? globalThis.window;
  const canvas = options.canvas;
  const request = options.request ?? ((lockOptions) => canvas.requestPointerLock(lockOptions));
  const onEvent = options.onEvent ?? (() => {});
  const bindings = [];

  const listen = (target, name, handler) => {
    target.addEventListener(name, handler);
    bindings.push(() => target.removeEventListener(name, handler));
  };

  return {
    async lock() {
      try {
        await request({ unadjustedMovement: true });
      } catch (error) {
        if (error?.name === 'NotSupportedError') throw new Error(RAW_INPUT_ERROR, { cause: error });
        throw error;
      }
    },
    start() {
      listen(documentTarget, 'mousemove', (event) => onEvent('MOVE', { x: event.movementX, y: event.movementY }));
      listen(documentTarget, 'pointerlockchange', () => {
        if (canvas && documentTarget.pointerLockElement !== canvas) onEvent('POINTER_LOCK_LOST');
      });
      listen(documentTarget, 'fullscreenchange', () => {
        if (!documentTarget.fullscreenElement) onEvent('FOCUS_LOST');
      });
      listen(documentTarget, 'visibilitychange', () => onEvent('FOCUS_LOST'));
      listen(windowTarget, 'blur', () => onEvent('FOCUS_LOST'));
    },
    dispose() {
      bindings.splice(0).forEach((remove) => remove());
    },
  };
}

export { RAW_INPUT_ERROR };
