import { flickTargets, runFlick } from './tasks/flick.js';
import { runMicro } from './tasks/micro.js';
import { runTracking, trackingPath } from './tasks/tracking.js';
import { runTurn } from './tasks/turn.js';

const TURN_ANGLES = [-180, -90, 90, 180];
const aggregators = { tracking: runTracking, flick: runFlick, micro: runMicro, turn: runTurn };

export function createTaskRunner(task, { scene, random = Math.random, turnIndex = 0 } = {}) {
  let path = [];
  let targets = [];
  let targetIndex = 0;
  let lastPathIndex = -1;
  let samples = [];
  let targetStartedAt = 0;

  const spawn = (target) => scene.spawnTarget(target);
  const nextTarget = () => {
    if (!targets.length) return;
    spawn(targets[targetIndex % targets.length]);
    targetIndex += 1;
  };
  const aimSample = (sample = {}) => {
    const aim = scene.aimState?.() ?? { errorDeg: 0, onTarget: scene.hitTest?.() ?? false };
    return {
      ...aim,
      ...sample,
      errorDeg: sample.errorDeg ?? aim.errorDeg,
      onTarget: sample.onTarget ?? aim.onTarget,
    };
  };
  const record = (sample) => {
    const event = aimSample(sample);
    samples.push(event);
    return event;
  };

  return {
    start(startTime = 0) {
      samples = [];
      targetIndex = 0;
      targetStartedAt = startTime;
      if (task === 'tracking') {
        path = trackingPath(20, random);
        spawn(path[0]);
        lastPathIndex = 0;
      } else if (task === 'flick') {
        targets = flickTargets(18, random);
        nextTarget();
      } else if (task === 'micro') {
        targets = Array.from({ length: 18 }, (_, index) => ({
          yawDeg: (index % 2 ? -1 : 1) * (1.5 + random() * 2.5),
          pitchDeg: (random() - 0.5) * 2,
        }));
        nextTarget();
      } else if (task === 'turn') {
        targets = Array.from({ length: 18 }, () => ({ yawDeg: TURN_ANGLES[turnIndex % TURN_ANGLES.length], pitchDeg: 0 }));
        nextTarget();
      }
    },
    update(elapsedMs) {
      if (task !== 'tracking') return;
      const index = Math.min(path.length - 1, Math.floor(elapsedMs / 750));
      if (index !== lastPathIndex) {
        spawn(path[index]);
        lastPathIndex = index;
      }
    },
    sample(sample) {
      return record(sample);
    },
    click(sample = {}) {
      if (task === 'tracking') return null;
      const event = record({
        ...sample,
        hit: sample.hit ?? (sample.onTarget ?? scene.aimState?.().onTarget ?? scene.hitTest?.() ?? false),
        latencyMs: sample.latencyMs ?? ((sample.timeMs ?? targetStartedAt) - targetStartedAt),
        clickErrorDeg: sample.clickErrorDeg ?? sample.errorDeg ?? scene.aimState?.().errorDeg ?? 0,
      });
      if (event.hit) {
        targetStartedAt = event.timeMs ?? targetStartedAt;
        nextTarget();
      }
      return event;
    },
    finish() {
      return { samples: [...samples], metrics: aggregators[task]?.(samples) ?? { samples: samples.length } };
    },
    targetCount() {
      return targetIndex;
    },
  };
}
