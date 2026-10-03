// Phased beep timer. Beeps are scheduled on the AudioContext clock, which plays on time even when the page is busy;
// the display follows performance.now(). Each phase ends at an absolute instant counted from the start, so delays
// do not accumulate. Idea from EonTimer's timer (reimplemented: N spaced beeps, the last at the end of the phase).

export interface Phase {
  label: string;
  ms: number;
}

export interface TimerOptions {
  beeps: number;
  interval: number;
  sound: boolean;
  flash: boolean;
}

export interface TimerFrame {
  index: number;
  remaining: number;
  fraction: number;
  flashing: boolean;
}

// Instants (ms since start) at which each phase ends and the beeps play.
export function schedule(phases: Phase[], beeps: number, interval: number) {
  const ends: number[] = [];
  let total = 0;
  for (const phase of phases) {
    total += Math.max(0, phase.ms);
    ends.push(total);
  }
  const beepTimes: Array<{ at: number; last: boolean }> = [];
  for (const end of ends) {
    for (let i = 0; i < beeps; i++) {
      const at = end - i * interval;
      if (at >= 0) beepTimes.push({ at, last: i === 0 });
    }
  }
  return { ends, total, beepTimes };
}

export class Timer {
  running = false;
  /** Sound was on, but the browser did not unlock audio: this run has no beeps. */
  muted = false;
  private ctx: AudioContext | null = null;
  private nodes: OscillatorNode[] = [];
  private raf = 0;
  private run = 0;

  constructor(private onFrame: (frame: TimerFrame) => void, private onEnd: (completed: boolean) => void) {}

  async start(phases: Phase[], options: TimerOptions) {
    this.stop();
    // Zero is the click instant, read before any wait: the player presses A together with the click, and the seed
    // table counts from that moment. The time audio takes to wake up is taken out of the beeps.
    const perf0 = performance.now();
    // Already counts as running: stopping works while audio wakes up.
    this.running = true;
    const run = ++this.run;
    if (options.sound) {
      this.ctx ??= new AudioContext();
      // Safari and Firefox may be slow (or never wake without an audio output): wait at most 300 ms.
      await Promise.race([this.ctx.resume(), new Promise((resolve) => setTimeout(resolve, 300))]);
      if (run !== this.run || !this.running) return;
    }
    const { ends, beepTimes } = schedule(phases, options.beeps, options.interval);
    // Audio that did not wake gets no beeps: playing late would make the player press at the wrong time. The display continues.
    if (options.sound && this.ctx && this.ctx.state === "running") {
      // Audio clock at the click instant, moved earlier by the output latency (sound leaves the speaker after it is
      // scheduled; on Bluetooth headphones this exceeds 100 ms).
      const latency = this.ctx.outputLatency || this.ctx.baseLatency || 0;
      const audio0 = this.ctx.currentTime - (performance.now() - perf0) / 1000 - latency;
      const soonest = this.ctx.currentTime + 0.02;
      this.nodes = beepTimes.filter((b) => audio0 + b.at / 1000 >= soonest).map((b) => this.beep(audio0 + b.at / 1000, b.last));
    }
    this.muted = options.sound && this.ctx?.state !== "running";
    const loop = () => {
      if (!this.running) return;
      const now = performance.now() - perf0;
      const index = ends.findIndex((end) => now < end);
      if (index === -1) {
        this.running = false;
        this.onEnd(true);
        return;
      }
      const start = index ? ends[index - 1] : 0;
      this.onFrame({
        index,
        remaining: ends[index] - now,
        fraction: Math.max(0, now - start) / (ends[index] - start || 1),
        flashing: options.flash && beepTimes.some((b) => now >= b.at && now - b.at < 90),
      });
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private beep(when: number, last: boolean): OscillatorNode {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = last ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.25, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (last ? 0.12 : 0.06));
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.15);
    return osc;
  }

  stop() {
    const wasRunning = this.running;
    this.running = false;
    cancelAnimationFrame(this.raf);
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // already played
      }
    }
    this.nodes = [];
    if (wasRunning) this.onEnd(false);
  }
}
