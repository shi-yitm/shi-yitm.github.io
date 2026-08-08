export const STATES = ['setup', 'practice', 'coarse', 'refine', 'validate', 'paused', 'report'];

const TRANSITIONS = {
  setup: { ENVIRONMENT_OK: 'practice' },
  practice: { PRACTICE_DONE: 'coarse' },
  coarse: { TEST_DONE: 'refine' },
  refine: { TEST_DONE: 'validate' },
  validate: { TEST_DONE: 'report' },
};

const INVALIDATING_EVENTS = new Set(['POINTER_LOCK_LOST', 'FOCUS_LOST', 'FPS_CRITICAL']);

export function createMachine(initial = {}) {
  let state = 'setup';
  const context = { results: [], currentRound: null, resumeState: null, ...initial };

  return {
    get state() {
      return state;
    },
    context,
    send(event, payload) {
      if (INVALIDATING_EVENTS.has(event) && state !== 'paused' && state !== 'report') {
        context.currentRound = null;
        context.resumeState = state;
        context.pauseReason = event;
        state = 'paused';
        return;
      }
      if (event === 'RESUME' && state === 'paused') {
        state = context.resumeState ?? 'setup';
        context.resumeState = null;
        return;
      }
      if (event === 'ROUND_START') context.currentRound = payload;
      if (event === 'ROUND_DONE' && context.currentRound) {
        context.results.push(payload);
        context.currentRound = null;
      }
      state = TRANSITIONS[state]?.[event] ?? state;
    },
  };
}
