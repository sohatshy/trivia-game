// ============================================================
//  Sound effects, generated with the Web Audio API (no audio files to license).
// ============================================================

const KEY = 'maydan.muted';
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  /* ignore */
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, start = 0, dur = 0.15, type = 'sine', gain = 0.2, slideTo = null }) {
  if (muted) return;
  const c = ac();
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sound = {
  isMuted: () => muted,
  setMuted(v) {
    muted = v;
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  },
  /** Call on the first user click so browsers allow audio. */
  unlock() {
    try {
      ac();
    } catch {
      /* no audio support */
    }
  },
  open() {
    tone({ freq: 420, dur: 0.18, type: 'triangle', gain: 0.18, slideTo: 840 });
  },
  /** The host passes the question to the other team */
  steal() {
    tone({ freq: 660, dur: 0.22, type: 'triangle', gain: 0.16, slideTo: 330 });
    tone({ freq: 440, start: 0.16, dur: 0.22, type: 'triangle', gain: 0.16, slideTo: 880 });
  },
  correct() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, start: i * 0.08, dur: 0.2, type: 'triangle', gain: 0.2 }));
  },
  wrong() {
    tone({ freq: 200, dur: 0.35, type: 'square', gain: 0.1 });
    tone({ freq: 150, start: 0.18, dur: 0.4, type: 'square', gain: 0.1 });
  },
  helper() {
    [880, 1175].forEach((f, i) => tone({ freq: f, start: i * 0.07, dur: 0.15, type: 'sine', gain: 0.18 }));
  },
  win() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone({ freq: f, start: i * 0.13, dur: 0.3, type: 'triangle', gain: 0.22 }));
    tone({ freq: 262, start: 0, dur: 1.2, type: 'sine', gain: 0.15 });
  },
};
