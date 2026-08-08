const BRIEFINGS = {
  tracking: { title: '跟枪', action: '让准星持续覆盖移动目标，不需要点击。', requiresClick: false },
  flick: { title: '甩枪', action: '快速对准出现的目标，命中后左键点击确认。', requiresClick: true },
  micro: { title: '微调', action: '用小幅移动对准近距离目标，命中后左键点击确认。', requiresClick: true },
  turn: { title: '转身', action: '转向大角度目标，稳定对准后左键点击确认。', requiresClick: true },
};

export function taskBriefing(task) {
  return BRIEFINGS[task] ?? BRIEFINGS.tracking;
}
