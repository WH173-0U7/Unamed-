/**
 * Little sounds, made on the spot (no audio files): a dry click for a button,
 * a softer tick for a tab, a breath of air for a drawer, static when the
 * signal cuts out to lurk, a couple of rising
 * notes when a stat goes up, coins when money changes hands. Muted from
 * Settings → Sound. The audio only starts after the first touch (browsers
 * require it).
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

export function setMuted(m: boolean) {
  muted = m;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (!noiseBuf) {
      // A second of white noise, reused for every noisy sound.
      try {
        const rate = ctx.sampleRate || 44100;
        noiseBuf = ctx.createBuffer(1, Math.round(rate), rate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        noiseBuf = null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A burst of filtered noise. */
function noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', delay = 0) {
  const c = ac();
  if (!c || !noiseBuf || !master) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true; // (it starts at a random point: loop so it never runs out early)
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.006, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** A short tone, optionally sliding to another pitch. */
function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sound = {
  /** A button: a dry, plasticky click. */
  click() {
    noise(0.035, 3200, 1.2, 0.35);
    tone(1900, 0.025, 0.06, 'square', 1200);
  },
  /** A tab: softer and higher. */
  tab() {
    noise(0.025, 5200, 2, 0.18);
  },
  /** A button that can't be pressed: a dull knock. */
  deny() {
    tone(160, 0.08, 0.12, 'triangle', 110);
  },
  /** A drawer or sheet sliding: a breath of air. */
  whoosh() {
    noise(0.28, 900, 0.6, 0.12, 'lowpass');
  },
  /** The signal cutting out to lurk: a crackle of static. */
  static(dur = 0.7) {
    noise(dur, 2400, 0.4, 0.08, 'highpass');
    for (let i = 0; i < 5; i++) noise(0.02, 1500 + Math.random() * 3000, 3, 0.14, 'bandpass', Math.random() * dur);
  },
  /** A stat going up: two rising notes. */
  levelUp() {
    tone(660, 0.14, 0.12, 'triangle');
    tone(990, 0.22, 0.12, 'triangle', undefined, 0.11);
  },
  /** Something good for you (medicine, a drink, a smoke, warmth): a soft, low chime. */
  good() {
    tone(520, 0.22, 0.07, 'sine');
    tone(780, 0.3, 0.05, 'sine', undefined, 0.06);
  },
  /** A blow landing: a low, dull thud (harder ones louder); a bone going, a sharp crack on top. */
  hit(power: number, severe: boolean) {
    noise(0.12, 160, 0.7, 0.12 + power * 0.18, 'lowpass');
    tone(90, 0.14, 0.08 + power * 0.1, 'sine', 45);
    if (severe) noise(0.05, 2200, 1.2, 0.12, 'bandpass', 0.03);
  },
  /** The set going off: a deep thunk. */
  thunk() {
    tone(70, 0.35, 0.2, 'sine', 30);
    noise(0.08, 120, 0.6, 0.15, 'lowpass');
  },
  /** Money changing hands: a couple of little metallic ticks. */
  coin() {
    tone(2600, 0.05, 0.07, 'square');
    tone(3400, 0.07, 0.06, 'square', undefined, 0.06);
  },
};
