export class AimTask {
  constructor({ durationMs = 0 } = {}) {
    this.durationMs = durationMs;
    this.active = false;
    this.events = [];
  }

  start(context) {
    this.context = context;
    this.events = [];
    this.active = true;
  }

  update() {}

  pointer() {}

  sample(event) {
    if (!this.active) throw new Error('任务尚未开始');
    this.events.push(event);
  }

  click(event) {
    this.sample(event);
  }

  aggregate(events) {
    return { samples: events.length };
  }

  stop() {
    if (!this.active) throw new Error('任务尚未开始');
    this.active = false;
    return { events: [...this.events], metrics: this.aggregate(this.events) };
  }
}
