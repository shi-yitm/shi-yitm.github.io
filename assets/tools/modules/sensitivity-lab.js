import { createSensitivityScene } from '../sensitivity/scene.js';
import { createInputEngine } from '../sensitivity/input-engine.js';
import { createMachine } from '../sensitivity/state-machine.js';
import { cmPer360, coarseCandidates, edpi, sensitivityForEdpi } from '../sensitivity/math.js';
import { balancedOrder, calibrationPlan, expandIfEdge, refineAround, validationCandidates } from '../sensitivity/scheduler.js';
import { confidenceLevel, objectiveScore, roleAdjustedScore, scoreTaskMetrics } from '../sensitivity/scoring.js';
import { createStore } from '../sensitivity/storage.js';
import { createTaskRunner } from '../sensitivity/task-runner.js';
import { leaveImmersiveTest } from '../sensitivity/session-cleanup.js';
import { taskBriefing } from '../sensitivity/briefings.js';

const TASKS = ['tracking', 'flick', 'micro', 'turn'];
const TASK_NAMES = { tracking: '跟枪', flick: '甩枪', micro: '微调', turn: '转身' };
const TASK_HINTS = {
  tracking: '保持准星贴住移动目标',
  flick: '点击后快速寻找下一个目标',
  micro: '用小幅修正完成近距离目标',
  turn: '转向大角度目标后稳定准星',
};
const ROUND_MS = 14_000;
let initialized = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function downloadJson(text) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = `cs2-sensitivity-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function init() {
  if (initialized) return;
  initialized = true;
  const root = document.querySelector('#tool-sensitivity-lab');
  const views = new Map([...root.querySelectorAll('[data-view]')].map((element) => [element.dataset.view, element]));
  const get = (selector) => root.querySelector(selector);
  const dpiInput = get('#mouseDpi');
  const sensitivityInput = get('#currentSensitivity');
  const roleInput = get('#playerRole');
  const padInput = get('#mousepadWidth');
  const modeInput = get('#calibrationMode');
  const store = createStore();
  const machine = createMachine();
  const scene = createSensitivityScene(get('#sensitivityCanvas'));
  let inputEngine;
  let roundTimer;
  let taskRunner;
  let roundStartedAt = 0;
  let session;
  let frames = [];
  let frameHandle;

  function showView(name) {
    for (const [key, element] of views) element.hidden = key !== name;
    if (name === 'arena') scene.start(); else scene.pause();
  }

  function updateConversions() {
    const dpi = Number(dpiInput.value);
    const sensitivity = Number(sensitivityInput.value);
    get('#currentEdpi').textContent = Number.isFinite(dpi * sensitivity) ? Math.round(edpi(dpi, sensitivity)) : '-';
    get('#currentCm360').textContent = dpi > 0 && sensitivity > 0 ? cmPer360(dpi, sensitivity).toFixed(2) : '-';
  }

  function validateSetup() {
    const config = {
      dpi: Number(dpiInput.value),
      sensitivity: Number(sensitivityInput.value),
      role: roleInput.value,
      mousepadWidth: Number(padInput.value),
    };
    if (config.dpi < 100 || config.dpi > 32_000) throw new Error('DPI 需在 100–32000 之间');
    if (config.sensitivity < 0.05 || config.sensitivity > 10) throw new Error('CS2 灵敏度需在 0.05–10 之间');
    if (config.mousepadWidth < 10 || config.mousepadWidth > 150) throw new Error('鼠标垫宽度需在 10–150 cm 之间');
    return config;
  }

  function setCheck(name, ok, text) {
    const element = get(`[data-check="${name}"]`);
    element.dataset.status = ok ? 'ok' : 'warn';
    element.textContent = `${ok ? '通过' : '注意'} · ${text}`;
  }

  function updateEnvironment() {
    setCheck('browser', /Chrome|Edg/.test(navigator.userAgent), '桌面 Chrome / Edge');
    setCheck('pointer', 'requestPointerLock' in HTMLElement.prototype, '原始鼠标输入');
    setCheck('fullscreen', Boolean(document.fullscreenEnabled), '全屏模式');
    setCheck('fps', true, '等待测试');
  }

  function monitorFrames(now) {
    frames.push(now);
    frames = frames.filter((value) => now - value <= 1000);
    const fps = frames.length;
    if (session) {
      session.minFps = Math.min(session.minFps, fps || 60);
      setCheck('fps', fps >= 50, `${fps} FPS`);
      if (fps < 30 && frames.length > 20) pause('FPS_CRITICAL', '帧率低于 30，当前轮已作废。');
      if (session.round && session.running) {
        const elapsed = now - roundStartedAt;
        taskRunner?.update(elapsed);
        if (session.round.task === 'tracking' || session.round.task === 'turn') taskRunner?.sample({ timeMs: elapsed, ...scene.aimState() });
        get('#testCountdown').textContent = `${Math.max(0, Math.ceil((ROUND_MS - elapsed) / 1000))} 秒`;
      }
    }
    frameHandle = requestAnimationFrame(monitorFrames);
  }

  function makeStage(stage, candidates) {
    const occurrences = new Map(candidates.map((candidate) => [candidate, 0]));
    return balancedOrder(candidates, TASKS.length).map((candidate) => {
      const task = TASKS[occurrences.get(candidate)];
      occurrences.set(candidate, occurrences.get(candidate) + 1);
      return { stage, candidate, task };
    });
  }

  function stageQueue(stage, candidates) {
    const queue = makeStage(stage, candidates);
    return queue.slice(0, session.plan.stageRounds[stage] ?? queue.length);
  }

  function scoreRound(round) {
    const movement = round.distance / Math.max(1, round.moves);
    const activity = clamp(round.moves / 180, 0, 1);
    const precision = round.clicks ? round.hits / round.clicks : 0.5;
    const boundaryPenalty = round.boundaries * 4;
    const taskScore = {
      tracking: activity * 70 + clamp(30 - Math.abs(movement - 2.5) * 6, 0, 30),
      flick: precision * 70 + clamp(round.clicks / 10, 0, 1) * 30,
      micro: precision * 75 + clamp(25 - Math.abs(movement - 1.5) * 8, 0, 25),
      turn: activity * 55 + clamp(round.distance / 600, 0, 1) * 45,
    }[round.task];
    return clamp(Math.round(taskScore - boundaryPenalty), 0, 100);
  }

  function finishRound() {
    if (!session?.round) return;
    const taskResult = taskRunner?.finish();
    const result = { ...session.round, metrics: taskResult?.metrics ?? {}, score: taskResult ? scoreTaskMetrics(session.round.task, taskResult.metrics) : scoreRound(session.round) };
    delete result.distance;
    delete result.moves;
    delete result.clicks;
    delete result.hits;
    delete result.boundaries;
    machine.send('ROUND_DONE', result);
    session.results.push(result);
    session.round = null;
    session.running = false;
    session.index += 1;
    nextRound();
  }

  function bestCandidate(stage) {
    const grouped = new Map();
    for (const result of session.results.filter((item) => item.stage === stage)) {
      if (!grouped.has(result.candidate)) grouped.set(result.candidate, []);
      grouped.get(result.candidate).push(result.score);
    }
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    return [...grouped].sort((a, b) => average(b[1]) - average(a[1]))[0]?.[0];
  }

  function advanceStage() {
    if (session.stage === 'practice') {
      machine.send('PRACTICE_DONE');
      session.stage = 'coarse';
      const candidates = session.mode === 'quick' ? [566, 1131] : coarseCandidates();
      session.queue = stageQueue('coarse', candidates);
    } else if (session.stage === 'coarse') {
      const winner = bestCandidate('coarse') ?? 800;
      const candidates = session.mode === 'quick' ? [566, 1131] : coarseCandidates();
      const winnerIndex = candidates.indexOf(winner);
      if (session.mode === 'complete' && (winnerIndex === 0 || winnerIndex === candidates.length - 1)) {
        const expanded = expandIfEdge(candidates, winnerIndex);
        session.edgeCandidates = expanded;
        session.edgeWinner = winner;
        session.stage = 'coarse-edge';
        session.queue = stageQueue('coarse-edge', [expanded[winnerIndex === 0 ? 0 : expanded.length - 1]]);
      } else {
        machine.send('TEST_DONE');
        session.stage = 'refine';
        session.queue = stageQueue('refine', refineAround(candidates, winnerIndex));
      }
    } else if (session.stage === 'coarse-edge') {
      const edgeCandidate = bestCandidate('coarse-edge');
      const edgeScore = session.results.filter((item) => item.stage === 'coarse-edge').reduce((sum, item) => sum + item.score, 0) / TASKS.length;
      const prior = session.results.filter((item) => item.stage === 'coarse' && item.candidate === session.edgeWinner);
      const priorScore = prior.reduce((sum, item) => sum + item.score, 0) / prior.length;
      const winner = edgeScore > priorScore ? edgeCandidate : session.edgeWinner;
      const winnerIndex = session.edgeCandidates.indexOf(winner);
      const refined = winnerIndex === 0 || winnerIndex === session.edgeCandidates.length - 1
        ? [Math.round(winner / Math.pow(2, 0.25)), winner, Math.round(winner * Math.pow(2, 0.25))]
        : refineAround(session.edgeCandidates, winnerIndex);
      machine.send('TEST_DONE');
      session.stage = 'refine';
      session.queue = stageQueue('refine', refined);
    } else if (session.stage === 'refine') {
      const winner = bestCandidate('refine') ?? 800;
      machine.send('TEST_DONE');
      session.stage = 'validate';
      session.queue = stageQueue('validate', validationCandidates(winner));
    } else {
      machine.send('TEST_DONE');
      void renderReport(buildReport());
      return false;
    }
    session.index = 0;
    return true;
  }

  function nextRound() {
    clearTimeout(roundTimer);
    if (session.index >= session.queue.length && !advanceStage()) return;
    const descriptor = session.queue[session.index];
    session.round = { ...descriptor, distance: 0, moves: 0, clicks: 0, hits: 0, boundaries: 0 };
    machine.send('ROUND_START', session.round);
    scene.setSensitivity(sensitivityForEdpi(descriptor.candidate, session.config.dpi));
    get('#testStage').textContent = { practice: '练习', coarse: '粗筛', 'coarse-edge': '边缘扩展', refine: '精测', validate: '验证' }[descriptor.stage];
    get('#testTask').textContent = TASK_NAMES[descriptor.task];
    get('#testProgress').textContent = `${session.index + 1} / ${session.queue.length}`;
    const briefing = taskBriefing(descriptor.task);
    get('#briefingTask').textContent = briefing.title;
    get('#briefingAction').textContent = briefing.action;
    get('#briefingProgress').textContent = `${get('#testStage').textContent} · ${get('#testProgress').textContent}`;
    showView('briefing');
  }

  async function beginRound() {
    if (!session?.round || session.running) return;
    try {
      showView('arena');
      if (!window.__SENSITIVITY_TEST_MODE__) {
        await get('#sensitivityArena').requestFullscreen();
        await inputEngine.lock();
      }
      taskRunner = createTaskRunner(session.round.task, { scene, turnIndex: session.index });
      roundStartedAt = performance.now();
      taskRunner.start(roundStartedAt);
      session.running = true;
      get('#testHint').textContent = TASK_HINTS[session.round.task];
      get('#testCountdown').textContent = `${Math.ceil(ROUND_MS / 1000)} 秒`;
      roundTimer = setTimeout(finishRound, ROUND_MS);
    } catch (error) { get('#setupError').textContent = error.message; showView('setup'); }
  }

  function buildReport(forcedCenter) {
    const center = forcedCenter ?? bestCandidate('validate') ?? bestCandidate('refine') ?? 800;
    const taskScores = Object.fromEntries(TASKS.map((task) => {
      const values = session.results.filter((result) => result.task === task && result.stage !== 'practice').map((result) => result.score);
      return [task, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0];
    }));
    const objective = objectiveScore(taskScores);
    const adjustedScore = roleAdjustedScore(taskScores, session.config.role);
    const roleCenter = Math.round(clamp(center * (1 + (adjustedScore - objective) / 100), center * 0.9, center * 1.1));
    const low = Math.round(center * 0.95);
    const high = Math.round(center * 1.05);
    return {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      createdAt: new Date().toISOString(),
      config: session.config,
      mode: session.mode,
      recommendation: { center, low, high, roleCenter },
      taskScores,
      objective,
      adjustedScore,
      confidence: confidenceLevel({ rounds: session.results.length, fps: session.minFps, agreement: forcedCenter ? 0.96 : 0.84 }),
      lowFps: session.minFps < 50,
      results: session.results.map(({ stage, candidate, task, score, metrics }) => ({ stage, candidate, task, score, metrics })),
    };
  }

  function renderHistory() {
    const records = store.list();
    get('#historyPanel').innerHTML = `<div class="history-heading"><h3>本地历史</h3><span>${records.length} / 20</span></div>${records.length ? records.slice(0, 5).map((record) => `<button type="button" class="history-row" data-history-id="${record.id}"><span>${new Date(record.createdAt).toLocaleDateString()} · ${record.mode === 'quick' ? '快速' : '完整'}</span><strong>${sensitivityForEdpi(record.recommendation.center, record.config.dpi).toFixed(2)}</strong><small>${record.confidence === 'high' ? '高' : record.confidence === 'medium' ? '中' : '低'}可信度 · ${record.recommendation.center} eDPI</small></button>`).join('') : '<p class="empty-history">还没有历史测试。</p>'}`;
  }

  async function renderReport(report) {
    clearTimeout(roundTimer);
    session.report = report;
    store.save(report);
    const sensitivity = sensitivityForEdpi(report.recommendation.center, report.config.dpi);
    get('#recommendedSensitivity').textContent = sensitivity.toFixed(2);
    get('#recommendedRange').textContent = `${sensitivityForEdpi(report.recommendation.low, report.config.dpi).toFixed(2)} – ${sensitivityForEdpi(report.recommendation.high, report.config.dpi).toFixed(2)}`;
    get('#reportSummary').innerHTML = `<span><small>eDPI</small><strong>${report.recommendation.center}</strong></span><span><small>cm/360</small><strong>${cmPer360(report.config.dpi, sensitivity).toFixed(1)}</strong></span><span><small>可信度</small><strong>${{ high: '高', medium: '中', low: '低' }[report.confidence]}</strong></span><span><small>定位修正</small><strong>${report.recommendation.roleCenter}</strong></span>`;
    get('#taskBreakdown').innerHTML = TASKS.map((task) => `<article><span>${TASK_NAMES[task]}</span><strong>${report.taskScores[task]}</strong><div><i style="width:${report.taskScores[task]}%"></i></div></article>`).join('');
    get('#reportDiagnosis').textContent = report.lowFps ? '检测到低帧率，本次区间已降低可信度。建议关闭后台程序后复测。' : '验证轮次结果一致。建议先使用中心值，在死亡竞赛中复核 2–3 天。';
    renderHistory();
    await leaveImmersiveTest({
      exitPointerLock: () => document.exitPointerLock?.(),
      exitFullscreen: document.fullscreenElement ? () => document.exitFullscreen() : undefined,
    });
    showView('report');
  }

  function pause(event, reason) {
    if (!session?.round) return;
    clearTimeout(roundTimer);
    machine.send(event);
    session.round = null;
    get('#pauseReason').textContent = reason;
    showView('paused');
  }

  async function startSession() {
    try {
      const config = validateSetup();
      const currentEdpi = Math.round(edpi(config.dpi, config.sensitivity));
      const mode = modeInput.value;
      session = { config, mode, plan: calibrationPlan(mode), stage: 'practice', queue: [], index: 0, results: [], round: null, running: false, minFps: 120 };
      session.queue = stageQueue('practice', [currentEdpi]);
      machine.send('ENVIRONMENT_OK');
      nextRound();
    } catch (error) {
      get('#setupError').textContent = error.message;
    }
  }

  function runDeterministicSession() {
    const config = validateSetup();
    session = {
      config,
      stage: 'validate',
      queue: [],
      index: 0,
      minFps: 90,
      results: TASKS.flatMap((task, taskIndex) => [692, 752, 812].map((candidate, index) => ({ stage: 'validate', candidate, task, score: 72 + taskIndex * 4 + (index === 1 ? 12 : 0) }))),
    };
    renderReport(buildReport(752));
    return session.report;
  }

  inputEngine = createInputEngine({
    canvas: get('#sensitivityCanvas'),
    onEvent(event, payload) {
      if (event === 'MOVE' && session?.round) {
        session.round.moves += 1;
        session.round.distance += Math.hypot(payload.x, payload.y);
        scene.applyMouseDelta(payload);
      } else if (event !== 'MOVE') {
        pause(event, '测试环境发生变化，当前轮已作废。重新进入全屏后继续。');
      }
    },
  });
  inputEngine.start();
  get('#sensitivityCanvas').addEventListener('mousedown', () => {
    if (!session?.round) return;
    session.round.clicks += 1;
    const aim = scene.aimState();
    if (aim.onTarget) session.round.hits += 1;
    taskRunner?.click({ timeMs: performance.now() - roundStartedAt, hit: aim.onTarget, ...aim });
  });
  get('#reportMouseBoundary').addEventListener('click', () => { if (session?.round) session.round.boundaries += 1; });
  window.addEventListener('keydown', (event) => { if (event.code === 'Space' && session?.round) session.round.boundaries += 1; });
  get('#startSensitivityTest').addEventListener('click', startSession);
  get('#beginSensitivityRound').addEventListener('click', beginRound);
  get('#resumeSensitivityTest').addEventListener('click', async () => {
    try {
      if (!window.__SENSITIVITY_TEST_MODE__) {
        await get('#sensitivityArena').requestFullscreen();
        await inputEngine.lock();
      }
      machine.send('RESUME');
      showView('arena');
      nextRound();
    } catch (error) {
      get('#pauseReason').textContent = error.message;
    }
  });
  get('#exportSensitivityHistory').addEventListener('click', () => downloadJson(store.export()));
  get('#importSensitivityHistory').addEventListener('change', async (event) => {
    try {
      store.import(await event.target.files[0].text());
      renderHistory();
    } catch (error) {
      get('#reportDiagnosis').textContent = error.message;
    }
  });
  get('#restartSensitivityTest').addEventListener('click', () => showView('setup'));
  [dpiInput, sensitivityInput].forEach((input) => input.addEventListener('input', updateConversions));
  updateConversions();
  updateEnvironment();
  renderHistory();
  showView('setup');
  frameHandle = requestAnimationFrame(monitorFrames);
  window.sensitivityLab = {
    showView,
    sceneHasPixels: () => scene.sceneHasPixels(),
    startScene: () => scene.start(),
    pauseScene: () => scene.pause(),
    runDeterministicSession,
    simulateCriticalFps: () => pause('FPS_CRITICAL', '帧率低于 30，当前轮已作废。'),
    simulateMouseMove: (x, y) => { scene.applyMouseDelta({ x, y }); scene.spawnTarget(); },
    historyCount: () => store.list().length,
    dispose: () => { cancelAnimationFrame(frameHandle); inputEngine.dispose(); scene.dispose(); },
  };
}
