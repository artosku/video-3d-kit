// Music bed + sound design for short celebration clips. No narration: every sound is cue-driven from assets/cues.js.
// Music and the instruments/effects are synthesized in this file; short impacts, whooshes and pops are CC0 samples from https://videoeditingsfx.com/sfx/
// and a few sounds come from the app itself (assets/streak/audio). Run scripts/prep/fetch-sfx.sh style prep first (samples live in assets/audio/sfx/*.f32).
// PART=music → assets/audio/music.wav, PART=sfx → assets/audio/sfx.wav (mixed in scripts/mix.sh). C major, 120 BPM.
import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const DUR = 18;
const PART = process.env.PART || "music";
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);
const SL = new Float32Array(N); // reverb send
const SRr = new Float32Array(N);
const duck = new Float32Array(N).fill(1);

let seed = 99;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

class Biquad {
  constructor(type, f, q = 0.707) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.q = q;
    const w = (2 * Math.PI * Math.min(Math.max(f, 10), SR * 0.45)) / SR;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (this.type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [a, 0, -a];
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
const put = (i, l, r, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
  SL[i] += l * send;
  SRr[i] += r * send;
};
const pan = (x, p) => [x * Math.cos(((p + 1) * Math.PI) / 4), x * Math.sin(((p + 1) * Math.PI) / 4)];

/* ============================ instruments ============================ */
function pad(t0, dur, notes, g = 1, cutoff = 1800) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((dur + 0.8) * SR);
  const vs = [];
  notes.forEach((m, i) => [-7, 0, 6].forEach((c, j) => vs.push({f: midi(m) * Math.pow(2, c / 1200), ph: ((rnd() + 1) / 2), p: ((i + j) % 3) - 1})));
  const fl = new Biquad('lp', cutoff, 0.5);
  const fr = new Biquad('lp', cutoff, 0.5);
  const att = 0.6 * SR;
  const rel = 0.8 * SR;
  const end = dur * SR;
  for (let i = 0; i < len; i++) {
    const env = Math.min(1, i / att) * (i < end ? 1 : Math.max(0, 1 - (i - end) / rel));
    if (env <= 0) continue;
    let l = 0;
    let r = 0;
    const vib = 1 + 0.0015 * Math.sin((i / SR) * 2 * Math.PI * 4.5);
    for (const v of vs) {
      v.ph += (v.f * vib) / SR;
      const x = ((v.ph % 1) * 2 - 1) * 0.6 + Math.sin(v.ph * 2 * Math.PI) * 0.4;
      l += x * (0.5 - v.p * 0.35);
      r += x * (0.5 + v.p * 0.35);
    }
    const k = s0 + i;
    const d = k < N ? 0.55 + 0.45 * duck[k] : 1;
    const a = (0.046 * g * env * d) / Math.sqrt(vs.length / 3);
    put(k, fl.run(l) * a, fr.run(r) * a, 0.55);
  }
}

function piano(t0, m, vel = 0.7, dur = 3.2) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const f = midi(m);
  const p = clamp((m - 60) / 30, -0.6, 0.6);
  const lp = new Biquad('lp', 1500 + vel * 3500, 0.6);
  const parts = Array.from({length: 8}, (_, n) => ({f: (n + 1) * f * Math.sqrt(1 + 0.0004 * (n + 1) * (n + 1)), a: 1 / Math.pow(n + 1, 1.25), d: 0.55 + 0.75 * (n + 1), ph: 0}));
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let x = 0;
    for (const q of parts) {
      if (q.f > 12000) continue;
      q.ph += (2 * Math.PI * q.f) / SR;
      x += Math.sin(q.ph) * q.a * Math.exp(-tt * q.d);
    }
    const ham = i < 0.012 * SR ? rnd() * (1 - i / (0.012 * SR)) * 0.25 : 0;
    const env = Math.min(1, tt * 400) * Math.min(1, (len - i) / (0.08 * SR));
    const y = lp.run((x + ham) * env) * 0.2 * vel;
    const [l, r] = pan(y, p);
    put(s0 + i, l, r, 0.45);
  }
}

function celesta(t0, m, vel = 0.7, dur = 1.6) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const f = midi(m);
  const p = clamp((m - 76) / 20, -0.5, 0.5);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const x =
      Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 2.6) +
      0.35 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt * 5) +
      0.12 * Math.sin(2 * Math.PI * f * 3.93 * tt) * Math.exp(-tt * 9);
    const y = x * Math.min(1, tt * 900) * 0.13 * vel;
    const [l, r] = pan(y, p);
    put(s0 + i, l, r, 0.5);
  }
}

function glock(t0, m, vel = 0.7, dur = 2.0) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const f = midi(m);
  const parts = [
    [1, 1, 1.6],
    [2.76, 0.4, 4.5],
    [5.4, 0.18, 8],
    [8.93, 0.08, 12],
  ];
  const p = clamp((m - 80) / 18, -0.5, 0.5);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let x = 0;
    for (const [mul, a, d] of parts) x += Math.sin(2 * Math.PI * f * mul * tt) * a * Math.exp(-tt * d);
    const y = x * Math.min(1, tt * 1500) * 0.11 * vel;
    const [l, r] = pan(y, p);
    put(s0 + i, l, r, 0.55);
  }
}

function pluck(t0, m, vel = 0.7, dur = 0.9) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const f = midi(m);
  const n = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(n);
  const lp = new Biquad('lp', 2400, 0.6);
  for (let i = 0; i < n; i++) buf[i] = lp.run(rnd());
  let idx = 0;
  const p = clamp((m - 66) / 20, -0.6, 0.6) * (m % 2 ? 1 : -1);
  for (let i = 0; i < len; i++) {
    const a = buf[idx];
    const b = buf[(idx + 1) % n];
    buf[idx] = (a + b) * 0.5 * 0.994;
    idx = (idx + 1) % n;
    const env = Math.min(1, (len - i) / (0.05 * SR));
    const y = a * env * 0.3 * vel;
    const [l, r] = pan(y, p);
    put(s0 + i, l, r, 0.3);
  }
}

function bass(t0, m, dur = 0.4, vel = 1) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const f = midi(m);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, tt * 300) * Math.min(1, (len - i) / (0.03 * SR)) * (0.8 + 0.2 * Math.exp(-tt * 8));
    const x = Math.tanh((Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * 1.2) * env * 0.21 * vel;
    const k = s0 + i;
    const d = k < N ? duck[k] : 1;
    put(k, x * d, x * d);
  }
}

/* ============================== drums =============================== */
function kick(t, g = 1) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.38 * SR; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (50 + 80 * Math.exp(-tt * 28))) / SR;
    const x = Math.tanh(Math.sin(ph) * 1.3) * Math.exp(-tt * 8.5) * 0.5 * g;
    put(s0 + i, x, x);
  }
  for (let i = 0; i < 0.28 * SR; i++) {
    const k = s0 + i;
    if (k < N) duck[k] = Math.min(duck[k], 1 - 0.5 * g * Math.pow(1 - i / (0.28 * SR), 1.6));
  }
}
function clap(t, g = 1) {
  const s0 = Math.floor(t * SR);
  const bp = new Biquad('bp', 1600, 1.0);
  for (let i = 0; i < 0.25 * SR; i++) {
    const tt = i / SR;
    const burst = tt < 0.024 ? (Math.floor(tt / 0.008) % 2 ? 0.35 : 1) : 1;
    const x = bp.run(rnd()) * Math.exp(-tt * 20) * burst * 0.45 * g;
    put(s0 + i, x, x * 0.9, 0.4);
  }
}
function hat(t, g = 1, p = 0.3) {
  const s0 = Math.floor(t * SR);
  const hp = new Biquad('hp', 8000, 0.8);
  for (let i = 0; i < 0.05 * SR; i++) {
    const x = hp.run(rnd()) * Math.exp(-(i / SR) * 70) * 0.12 * g;
    const [l, r] = pan(x, p);
    put(s0 + i, l, r);
  }
}
function shaker(t, g = 1) {
  const s0 = Math.floor(t * SR);
  const bp = new Biquad('bp', 8500, 1.4);
  const len = 0.07 * SR;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const x = bp.run(rnd()) * Math.sin(Math.PI * Math.pow(u, 0.4)) * 0.06 * g;
    const [l, r] = pan(x, -0.35);
    put(s0 + i, l, r);
  }
}
function crash(t, g = 1) {
  const s0 = Math.floor(t * SR);
  const hp = new Biquad('hp', 4200, 0.7);
  for (let i = 0; i < 2.8 * SR; i++) {
    const tt = i / SR;
    const x = hp.run(rnd()) * Math.exp(-tt * 1.4) * 0.16 * g * Math.min(1, tt * 200);
    put(s0 + i, x * (0.9 + 0.1 * Math.sin(tt * 7)), x * (0.9 - 0.1 * Math.sin(tt * 7)), 0.5);
  }
}
function boom(t, g = 1) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 2.2 * SR; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (36 + 60 * Math.exp(-tt * 6))) / SR;
    const x = Math.tanh(Math.sin(ph) * 1.8) * Math.exp(-tt * 1.9) * 0.55 * g;
    put(s0 + i, x, x, 0.2);
  }
}
function riser(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((t1 - t0) * SR);
  const bp = new Biquad('bp', 500, 2);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if (i % 32 === 0) bp.set(300 + 7000 * u * u, 2);
    const x = bp.run(rnd()) * u * u * 0.55 * g;
    const [l, r] = pan(x, Math.sin(u * 20) * 0.4);
    put(s0 + i, l, r, 0.4);
  }
}

/* =============================== sfx ================================ */
function boop(t, g = 1, pitch = 1) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.12 * SR; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (240 + 420 * Math.exp(-tt * 30)) * pitch) / SR;
    const x = Math.sin(ph) * Math.exp(-tt * 28) * 0.3 * g;
    put(s0 + i, x, x, 0.2);
  }
}
function boing(t, g = 1, pitch = 1) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.28 * SR; i++) {
    const tt = i / SR;
    const f = (320 + 380 * Math.sin(Math.min(1, tt / 0.18) * Math.PI * 0.5)) * pitch * (1 + 0.03 * Math.sin(tt * 90));
    ph += (2 * Math.PI * f) / SR;
    const x = Math.sin(ph) * Math.exp(-tt * 11) * 0.2 * g;
    put(s0 + i, x, x, 0.2);
  }
}
function whoosh(t, dur = 0.45, g = 1, up = true, p = 0) {
  const s0 = Math.floor((t - dur * 0.6) * SR);
  const len = Math.floor(dur * SR);
  const bp = new Biquad('bp', 600, 1.1);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if (i % 32 === 0) bp.set(up ? 350 + 3800 * u * u : 4200 - 3600 * u, 1.1);
    const x = bp.run(rnd()) * Math.pow(Math.sin(Math.PI * u), 2) * 0.4 * g;
    const [l, r] = pan(x, p + (u - 0.5) * 0.8);
    put(s0 + i, l, r, 0.3);
  }
}
function zing(t0, dur = 0.6, g = 1, f0 = 600, f1 = 2200) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const f = f0 * Math.pow(f1 / f0, u) * (1 + 0.01 * Math.sin(u * 60));
    ph += (2 * Math.PI * f) / SR;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 1.5;
    const x = (Math.sin(ph) + 0.3 * Math.sin(ph * 2.01)) * env * 0.06 * g;
    const [l, r] = pan(x, -0.5 + u);
    put(s0 + i, l, r, 0.6);
  }
}
function chime(t, notes = [84, 88, 91], g = 1, gap = 0.06) {
  notes.forEach((m, i) => glock(t + i * gap, m, 0.8 * g, 2.2));
}
function sparkle(t, dur = 0.8, g = 1, n = 10) {
  for (let i = 0; i < n; i++) {
    const tt = t + (i / n) * dur + rnd() * 0.02;
    const m = 89 + Math.floor(Math.abs(rnd()) * 12);
    celesta(tt, m, 0.35 * g, 0.7);
  }
}
function cling(t, m = 96, g = 1) {
  glock(t, m, 0.9 * g, 1.2);
  glock(t + 0.05, m + 7, 0.5 * g, 0.9);
}
function rustle(t, dur = 0.8, g = 1) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const bp = new Biquad('bp', 1200, 0.8);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const am = 0.55 + 0.45 * Math.sin(u * 70 + Math.sin(u * 13) * 3);
    const x = bp.run(rnd()) * Math.sin(Math.PI * u) * am * 0.18 * g;
    put(s0 + i, x, x * 0.9, 0.2);
  }
}
function air(t, dur = 0.9, g = 1, up = true) {
  // balloon filling / sagging
  const s0 = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const lp = new Biquad('lp', 400, 0.8);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if (i % 64 === 0) lp.set(up ? 250 + 900 * u : 1100 - 900 * u, 0.9);
    const x = lp.run(rnd()) * Math.sin(Math.PI * u) * 0.55 * g;
    put(s0 + i, x, x, 0.25);
  }
}
function burner(t, dur = 1.4, g = 1) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const lp = new Biquad('lp', 900, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const env = Math.min(1, tt * 18) * Math.exp(-tt * 1.5);
    const x = lp.run(rnd()) * env * 0.9 * g * (0.85 + 0.15 * Math.sin(tt * 43));
    put(s0 + i, x, x * 0.95, 0.3);
  }
}
function sigh(t, g = 1) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor(0.7 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    ph += (2 * Math.PI * (620 - 300 * u)) / SR;
    const x = Math.sin(ph) * Math.sin(Math.PI * u) * 0.06 * g;
    put(s0 + i, x, x, 0.5);
  }
}
function crinkle(t, dur = 0.4, g = 1) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const hp = new Biquad('hp', 2500, 0.7);
  for (let i = 0; i < len; i++) {
    const burst = Math.abs(rnd()) > 0.93 ? 1 : 0.15;
    const x = hp.run(rnd()) * burst * 0.25 * g * Math.sin((Math.PI * i) / len);
    put(s0 + i, x, x, 0.15);
  }
}
function whistle(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((t1 - t0) * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const f = 1300 + 500 * Math.sin(u * Math.PI * 2.2);
    ph += (2 * Math.PI * f) / SR;
    const x = Math.sin(ph) * Math.sin(Math.PI * u) * 0.025 * g;
    const [l, r] = pan(x, -0.4 + u * 0.8);
    put(s0 + i, l, r, 0.5);
  }
}
function stamp(t, g = 1) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  const lp = new Biquad('lp', 1800, 0.7);
  for (let i = 0; i < 0.2 * SR; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (140 - 60 * tt)) / SR;
    const x = (Math.sin(ph) * 0.6 + lp.run(rnd()) * 0.4) * Math.exp(-tt * 22) * 0.45 * g;
    put(s0 + i, x, x, 0.15);
  }
}
function chirps(t0, t1, g = 1, f = 4300) {
  // crickets: short pulse trains
  let t = t0;
  while (t < t1) {
    const p = rnd() * 0.8;
    for (let k = 0; k < 3; k++) {
      const s0 = Math.floor((t + k * 0.045) * SR);
      for (let i = 0; i < 0.03 * SR; i++) {
        const tt = i / SR;
        const x = Math.sin(2 * Math.PI * f * tt) * Math.sin((Math.PI * i) / (0.03 * SR)) * 0.012 * g;
        const [l, r] = pan(x, p);
        put(s0 + i, l, r, 0.4);
      }
    }
    t += 0.55 + Math.abs(rnd()) * 0.6;
  }
}
function wind(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((t1 - t0) * SR);
  const lp = new Biquad('lp', 380, 0.6);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const env = Math.min(1, tt / 1.5) * Math.min(1, (len - i) / (1.5 * SR));
    const x = lp.run(rnd()) * (0.5 + 0.5 * Math.sin(tt * 0.9)) * 0.12 * g * env;
    put(s0 + i, x, x * 0.8);
  }
}
function sea(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((t1 - t0) * SR);
  const lp = new Biquad('lp', 900, 0.6);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const env = Math.min(1, tt / 0.8) * Math.min(1, (len - i) / (0.8 * SR));
    const sw = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(tt * 1.3), 2);
    const x = lp.run(rnd()) * sw * 0.2 * g * env;
    put(s0 + i, x * 0.9, x);
  }
}
function birds(t0, t1, g = 1) {
  let t = t0;
  while (t < t1) {
    const s0 = Math.floor(t * SR);
    const f0 = 2600 + Math.abs(rnd()) * 1500;
    let ph = 0;
    for (let i = 0; i < 0.09 * SR; i++) {
      const u = i / (0.09 * SR);
      ph += (2 * Math.PI * f0 * (1 + 0.5 * u)) / SR;
      const x = Math.sin(ph) * Math.sin(Math.PI * u) * 0.025 * g;
      put(s0 + i, x * 0.7, x, 0.4);
    }
    t += 0.14 + Math.abs(rnd()) * 0.3;
  }
}

/* cues come from the composition itself (assets/cues.js), so sound and picture cannot drift apart */
const CUE = new Function('window', fs.readFileSync('assets/cues.js', 'utf8') + '\nreturn window.CUE;')({});
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SMPS = {};
const load = (n) => { if (!SMPS[n]) { const b = fs.readFileSync(`assets/audio/sfx/${n}.f32`); SMPS[n] = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); } return SMPS[n]; };
function smp(name, t, g = 1, o = {}) {
  const {p = 0, rate = 1, send = 0.08, end = false, max = 99} = o;
  const s = load(name); const len = Math.min(Math.floor(s.length / rate), Math.floor(max * SR));
  const s0 = Math.floor((end ? t - len / SR : t) * SR); const f = Math.floor(0.006 * SR);
  for (let i = 0; i < len; i++) { const x = i * rate; const k = Math.floor(x); const v = s[k] * (1 - (x - k)) + (s[k + 1] ?? 0) * (x - k); const e = Math.min(1, i / f) * Math.min(1, (len - i) / f); const [l, r] = pan(v * g * e, p); put(s0 + i, l, r, send); }
}
function tick(t, f = 1800, g = 0.25) { const s0 = Math.floor(t * SR), len = Math.floor(0.05 * SR); let ph = 0; for (let i = 0; i < len; i++) { const u = i / len; ph += (2 * Math.PI * f * (1 - 0.2 * u)) / SR; const x = Math.sin(ph) * Math.exp(-u * 9) * Math.min(1, i / 10) * g; put(s0 + i, x, x, 0.1); } }
function thud(t, g = 0.7) { const s0 = Math.floor(t * SR), len = Math.floor(0.35 * SR); let ph = 0; for (let i = 0; i < len; i++) { const u = i / len; ph += (110 - 60 * u) / SR; const x = Math.sin(ph * 2 * Math.PI) * Math.exp(-u * 8) * 0.6 * g; put(s0 + i, x, x, 0.1); } }
function sub(t, f = 55, dur = 0.8, g = 0.6) { const s0 = Math.floor(t * SR), len = Math.floor(dur * SR); let ph = 0; for (let i = 0; i < len; i++) { const u = i / len; ph += (f * (1 - 0.25 * u)) / SR; const x = Math.sin(ph * 2 * Math.PI) * Math.min(1, u * 20) * Math.exp(-u * 3.2) * 0.7 * g; put(s0 + i, x, x, 0.02); } }
function glass(t, midi, g = 0.5, dur = 1.2) { const f = 440 * Math.pow(2, (midi - 69) / 12); const s0 = Math.floor(t * SR), len = Math.floor(dur * SR); for (let i = 0; i < len; i++) { const u = i / len; const tt = i / SR; const x = (Math.sin(2 * Math.PI * f * tt) * 0.6 + Math.sin(2 * Math.PI * f * 2.7 * tt) * 0.25 * Math.exp(-u * 8) + Math.sin(2 * Math.PI * f * 4.1 * tt) * 0.12 * Math.exp(-u * 12)) * Math.exp(-u * 4.5) * Math.min(1, i / 30) * 0.4 * g; put(s0 + i, x, x, 0.35); } }
const A = (n, t, g = 1, o = {}) => smp('app_' + n, t, g, o);
const imp = (t, g = 0.6, n = 1) => { smp('impact-hit-' + n, t, g); sub(t, 50, 0.55, g * 0.7); };
const swishIn = (t, g = 0.35, n = 1) => smp('swish-' + n, t, g, {end: true});
const wipe = (t, g = 0.5) => { smp('swoosh-fast-with-thud', t - 0.1, g * 0.8); };
const pop = (t, g = 0.5, rate = 1) => smp('pop-sound', t, g, {rate});
const click = (t, g = 0.5) => { smp('click-button', t, g); A('sfx_click', t, g * 0.5, {rate: 1.2}); };

/* ---------- extra voices for this piece ---------- */
function brass(t0, m, dur = 0.6, vel = 0.7, bright = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((dur + 0.3) * SR), f = midi(m);
  const lp = new Biquad('lp', 900, 0.8);
  let p1 = rnd() * 0.5 + 0.5, p2 = rnd() * 0.5 + 0.5, p3 = rnd() * 0.5 + 0.5;
  for (let i = 0; i < len; i++) {
    const tt = i / SR, u = tt / dur;
    const env = Math.min(1, tt / 0.035) * (tt < dur ? 1 - 0.3 * u : Math.max(0, 1 - (tt - dur) / 0.3) * 0.7);
    if (i % 64 === 0) lp.set((650 + 3000 * bright * Math.min(1, tt / 0.1)) * (0.75 + 0.25 * Math.exp(-tt * 2.5)), 0.8);
    p1 += (f * 0.997) / SR; p2 += f / SR; p3 += (f * 1.004) / SR;
    const saw = (((p1 % 1) + (p2 % 1) + (p3 % 1)) * 2) / 3 - 1;
    const x = lp.run(saw) * env * 0.15 * vel;
    put(s0 + i, x * 0.92, x, 0.28);
  }
}
const brassChord = (t, notes, dur = 0.7, vel = 0.7, bright = 1) => notes.forEach((m) => brass(t, m, dur, vel, bright));
function trombone(t0, m0, m1, dur, g = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  const lp = new Biquad('lp', 700, 0.9);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR, u = tt / dur;
    const m = m0 + (m1 - m0) * Math.pow(Math.max(0, (u - 0.55) / 0.45), 2);
    const f = midi(m) * (1 + 0.012 * Math.sin(tt * 2 * Math.PI * 5.5) * Math.min(1, tt * 4));
    ph += f / SR;
    const saw = (ph % 1) * 2 - 1;
    if (i % 64 === 0) lp.set(500 + 900 * Math.sin(Math.PI * Math.min(1, u * 1.4)), 0.9);
    const env = Math.min(1, tt / 0.04) * Math.min(1, (len - i) / (0.08 * SR));
    const x = lp.run(saw) * env * 0.13 * g;
    put(s0 + i, x, x, 0.18);
  }
}
function flute(t0, dur, m, g = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(dur * SR), f = midi(m);
  const bp = new Biquad('bp', f * 2, 3);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR, env = Math.min(1, tt / 0.12) * Math.min(1, (len - i) / (0.25 * SR));
    ph += (f * (1 + 0.006 * Math.sin(tt * 2 * Math.PI * 4.8) * Math.min(1, tt * 2))) / SR;
    const x = (Math.sin(ph * 2 * Math.PI) * 0.8 + Math.sin(ph * 4 * Math.PI) * 0.1 + bp.run(rnd()) * 0.5) * env * 0.07 * g;
    put(s0 + i, x * 0.9, x, 0.5);
  }
}
function thunder(t, g = 1) {
  const s0 = Math.floor(t * SR), len = Math.floor(2.4 * SR);
  const lp = new Biquad('lp', 260, 0.7), lp2 = new Biquad('lp', 2200, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR, n = rnd();
    const crack = tt < 0.2 ? Math.exp(-tt * 20) : 0;
    const rumble = Math.exp(-tt * 1.5) * (0.65 + 0.35 * Math.sin(tt * 9 + Math.sin(tt * 3) * 2));
    const x = (lp2.run(n) * crack * 0.9 + lp.run(n) * rumble * 1.5) * 0.5 * g * Math.min(1, tt * 500);
    put(s0 + i, x, x * 0.92, 0.35);
  }
}
const heart = (t, g = 1) => { thud(t, 0.55 * g); sub(t, 48, 0.4, 0.5 * g); thud(t + 0.17, 0.34 * g); sub(t + 0.17, 54, 0.3, 0.28 * g); };
function poofSfx(t, g = 1, big = 1) {
  const s0 = Math.floor(t * SR), len = Math.floor(0.6 * SR), lp = new Biquad('lp', 1500, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR; if (i % 32 === 0) lp.set(2400 * Math.exp(-tt * 5) + 240, 0.7);
    const x = lp.run(rnd()) * Math.exp(-tt * 6.5) * Math.min(1, tt * 300) * 0.55 * g;
    put(s0 + i, x, x, 0.25);
  }
  sub(t, 95, 0.28, 0.32 * g * big);
}
function woodThunk(t, g = 1) {
  [[0, 175, 1], [0.1, 150, 0.45], [0.19, 130, 0.22]].forEach(([d, f, a]) => {
    const s0 = Math.floor((t + d) * SR), len = Math.floor(0.2 * SR); let ph = 0; const lp = new Biquad('lp', 2200, 0.7);
    for (let i = 0; i < len; i++) { const tt = i / SR; ph += (2 * Math.PI * f * (1 - 0.18 * tt * 5)) / SR; const x = (Math.sin(ph) * 0.8 + lp.run(rnd()) * (tt < 0.01 ? 0.7 : 0.05)) * Math.exp(-tt * 24) * 0.55 * a * g; put(s0 + i, x, x, 0.12); }
  });
}
function footstep(t, g = 1, p = 0) {
  const s0 = Math.floor(t * SR), len = Math.floor(0.14 * SR), lp = new Biquad('lp', 700, 0.7); let ph = 0;
  for (let i = 0; i < len; i++) { const tt = i / SR; ph += (2 * Math.PI * (130 - 400 * tt)) / SR; const x = (Math.sin(ph) * 0.7 + lp.run(rnd()) * 0.5) * Math.exp(-tt * 38) * 0.4 * g; const [l, r] = pan(x, p); put(s0 + i, l, r, 0.1); }
}
function rip(t, dur = 0.5, g = 1) {
  const s0 = Math.floor(t * SR), len = Math.floor(dur * SR), hp = new Biquad('hp', 1800, 0.7), bp = new Biquad('bp', 3000, 0.9);
  for (let i = 0; i < len; i++) {
    const u = i / len; if (i % 48 === 0) bp.set(3600 - 1800 * u, 0.9);
    const burst = Math.abs(rnd()) > 0.72 ? 1 : 0.25;
    const x = (hp.run(rnd()) * 0.6 + bp.run(rnd()) * 0.8) * burst * Math.sin(Math.PI * Math.pow(u, 0.6)) * 0.34 * g;
    const [l, r] = pan(x, -0.3 + u * 0.6); put(s0 + i, l, r, 0.15);
  }
}
function powerBlast(t, g = 1) {
  const s0 = Math.floor(t * SR), len = Math.floor(1.6 * SR), lp = new Biquad('lp', 2600, 0.8);
  const notes = [36, 43, 48, 55, 60, 67], ph = notes.map(() => 0);
  for (let i = 0; i < len; i++) {
    const tt = i / SR, bend = 1 + 0.07 * Math.sin(Math.PI * Math.min(1, tt / 0.5)) * (tt < 0.5 ? 1 : 0) - 0.02 * Math.min(1, tt / 1.5);
    let x = 0; notes.forEach((m, k) => { ph[k] += (midi(m) * bend * (1 + 0.004 * (k % 2 ? 1 : -1))) / SR; x += ((ph[k] % 1) * 2 - 1) * (k < 2 ? 0.34 : 0.18); });
    if (i % 64 === 0) lp.set(1200 + 3600 * Math.exp(-tt * 2.2), 0.8);
    const env = Math.min(1, tt / 0.012) * Math.exp(-tt * 1.9);
    const y = Math.tanh(lp.run(x) * 2.2) * env * 0.5 * g;
    put(s0 + i, y, y, 0.3);
  }
}
function rocketSweep(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((t1 - t0) * SR), bp = new Biquad('bp', 300, 1.2); let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len, e = Math.pow(u, 1.6);
    if (i % 32 === 0) bp.set(220 * Math.pow(32, e), 1.2);
    ph += (2 * Math.PI * 200 * Math.pow(9, u)) / SR;
    const env = Math.min(1, u * 6) * (0.4 + 0.6 * u) * Math.min(1, (len - i) / (0.12 * SR));
    const x = (bp.run(rnd()) * 0.9 + Math.sin(ph) * 0.18) * env * 0.5 * g;
    const [l, r] = pan(x, Math.sin(u * 9) * 0.5); put(s0 + i, l, r, 0.3);
  }
}
function fallWhistle(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((t1 - t0) * SR), bp = new Biquad('bp', 800, 1); let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len; ph += (2 * Math.PI * 2600 * Math.pow(0.16, u) * (1 + 0.012 * Math.sin(u * 90))) / SR;
    if (i % 32 === 0) bp.set(500 + 2500 * u, 0.9);
    const env = Math.pow(u, 1.3) * Math.min(1, (len - i) / (0.04 * SR));
    const x = (Math.sin(ph) * 0.2 + bp.run(rnd()) * 0.55) * env * 0.55 * g;
    put(s0 + i, x, x, 0.2);
  }
}
function ufo(t0, dur, g = 1, p = -0.6) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(dur * SR); let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR, u = i / len; ph += (2 * Math.PI * (520 + 90 * Math.sin(2 * Math.PI * 6.5 * tt) + 40 * Math.sin(2 * Math.PI * 2.1 * tt))) / SR;
    const x = Math.sin(ph) * Math.sin(Math.PI * u) * 0.07 * g; const [l, r] = pan(x, p); put(s0 + i, l, r, 0.45);
  }
}
function streakSfx(t0, t1, g = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((t1 - t0) * SR), bp = new Biquad('bp', 2500, 1.4); let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len; if (i % 32 === 0) bp.set(3400 * Math.pow(0.22, u), 1.4);
    ph += (2 * Math.PI * 3000 * Math.pow(0.4, u)) / SR;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 1.4);
    const x = (bp.run(rnd()) * 0.8 + Math.sin(ph) * 0.12) * env * 0.5 * g;
    const [l, r] = pan(x, -0.95 + 1.9 * u); put(s0 + i, l, r, 0.4);
  }
}
const countTicks = (t0, t1, n, f0, f1, g = 0.1) => { for (let i = 0; i < n; i++) { const v = (i + 1) / n, u = 1 - Math.sqrt(1 - v * 0.999); tick(t0 + (t1 - t0) * u, f0 + (f1 - f0) * v, g); } };
const tapSfx = (t, g = 0.55) => { click(t, g); };

// ===== SCORE START — everything between SCORE START and SCORE END is this video's own music + sound design (cue-driven, see assets/cues.js).
// ===== The instruments, drums, sfx helpers and the sample player above it, and the reverb/master below it, are the shared engine: leave them alone.
/* ================================= music ================================= */
const C = CUE, B = C.BEAT;                                                 // 120 BPM: 24 beats in 12 s (6 bars of 4)
const BIG = [60, 64, 67, 72];
const fold = (m) => (m > 96 ? m - 12 : m);
const PROG_MAJ = [{n: [60, 64, 67, 71], b: 36}, {n: [55, 59, 62, 65], b: 31}, {n: [57, 60, 64, 67], b: 33}, {n: [53, 57, 60, 64], b: 29}]; // C G Am F
const PROG_MIN = [{n: [57, 60, 64], b: 33}, {n: [53, 57, 60], b: 29}, {n: [55, 59, 62], b: 31}, {n: [52, 56, 59], b: 28}];            // Am F G E
/* a four-on-the-floor groove on the absolute beat grid; chords advance every bar counted from `ref` so cut segments stay in one song */
function jam(t0, t1, mode, lvl = 1, o = {}) {
  const prog = mode === 'min' ? PROG_MIN : PROG_MAJ, ref = o.ref ?? t0;
  for (let kb = Math.round(t0 / B); kb * B < t1 - 1e-6; kb++) {
    const t = kb * B, bt = kb % 4, ci = (((Math.floor((t - ref + 1e-6) / (4 * B))) % 4) + 4) % 4, c = prog[ci];
    const firstOfBar = Math.abs(((t - ref + 1e-6) / (4 * B)) % 1) < 1e-3 || kb === Math.round(t0 / B);
    if (firstOfBar) pad(t, Math.min(4 * B, t1 - t) + 0.25, c.n, mode === 'min' ? 0.5 : 0.62, mode === 'min' ? 1300 : 2200);
    kick(t, 0.36 * lvl);
    if (bt === 1 || bt === 3) clap(t, 0.2 * lvl);
    hat(t + B / 2, 0.7 * lvl, -0.2); shaker(t + B / 4, 0.16 * lvl); shaker(t + 0.75 * B, 0.12 * lvl);
    bass(t, c.b, B * 0.42, 0.8); bass(t + B / 2, c.b + (kb % 2 ? 7 : 12), B * 0.3, 0.55);
    if (!o.noPluck) for (let h = 0; h < 4; h++) pluck(t + h * B / 4, c.n[[0, 2, 1, 3][(kb * 4 + h) % 4] % c.n.length] + 12, (mode === 'min' ? 0.16 : 0.2) * lvl, 0.35);
    if (mode === 'maj' && lvl >= 1.1 && bt % 2 === 0) celesta(t + B / 4, c.n[(kb + 1) % c.n.length] + 24, 0.16, 0.6);
  }
}
const alarm = (t, g = 0.5, m = 100) => { for (let i = 0; i < 2; i++) glass(t + i * 0.085, m, 0.28 * g, 0.35); };
const typing = (t, n, f0 = 2100, g = 0.1, dt = 0.032) => { for (let k = 0; k < n; k++) tick(t + k * dt, f0 + hash(k * 3 + n) * 900, g); };

if (PART === 'music') {
  /* 0-3 s: small and alone. A minor, a few soft piano notes, a pad, then a riser as it looks up */
  jam(0, 3.0, 'min', 0.0, {ref: 0, noPluck: true});
  pad(0, 3.1, [57, 60, 64], 0.55, 1200);
  [[0.2, 69], [0.9, 64], [1.6, 60], [2.2, 62], [2.6, 64]].forEach(([t, m], i) => piano(t, m, 0.4 + i * 0.03, 1.6));
  glock(1.5, 81, 0.18, 1.2);
  riser(1.6, 2.98, 0.55);
  /* 3 s: take-off, the groove drops in and carries the climb */
  crash(3.0, 0.9); boom(3.0, 0.55); kick(3.0, 0.9); brassChord(3.0, BIG, 0.9, 0.8);
  jam(3.02, 6.5, 'maj', 0.95, {ref: 3.0});
  jam(6.5, 12.5, 'maj', 1.15, {ref: 3.0});
  [76, 79, 83, 88].forEach((m, i) => glock(3.1 + i * 0.5, m, 0.3, 0.8));
  /* "12 TESTER" and "300 INSTALL": a bright climb each */
  [72, 76, 79, 84, 88].forEach((m, i) => celesta(6.5 + i * 0.09, m + 12, 0.24, 0.8));
  [76, 79, 84, 88, 91, 96].forEach((m, i) => celesta(9.0 + i * 0.08, m, 0.26, 0.9));
  crash(9.0, 0.5);
  /* into the top island: build */
  riser(11.0, 12.48, 0.5);
  /* 12.5 s: the party */
  crash(12.5, 1.0); boom(12.5, 0.6); kick(12.5, 0.95); brassChord(12.5, BIG, 1.2, 0.95);
  [60, 64, 67, 72, 76].forEach((m, j) => piano(12.5 + j * 0.012, m, 0.6, 2.0));
  [84, 88, 91, 96, 91, 88].forEach((m, i) => celesta(12.56 + i * 0.07, m, 0.3, 1.0));
  jam(12.52, 18, 'maj', 1.3, {ref: 12.5});
  [84, 88, 91, 96].forEach((m, i) => glock(13.0 + i * 0.5, m, 0.3, 0.9));
  /* "200K VIEWS": another lift */
  crash(15.1, 0.6); brassChord(15.0, [65, 69, 72, 77], 0.9, 0.8);
  [88, 91, 96, 100].forEach((m, i) => celesta(15.1 + i * 0.07, m, 0.26, 0.8));
  /* the end: one last chord and a sparkle */
  brassChord(17.0, BIG, 0.9, 0.85); crash(17.0, 0.8); boom(17.0, 0.45);
  pad(17.0, 1.2, [48, 55, 60, 64, 67], 0.9, 2400);
  [84, 88, 91, 96, 91, 88, 84, 79].forEach((m, i) => celesta(17.1 + i * 0.1, m, 0.26, 1.0));
} else {
  /* ================================= sound design ================================= */
  /* 0-3 s: the lonely start */
  wind(0, 2.9, 0.12); sigh(1.0, 0.4); tick(0.45, 1500, 0.12); pop(1.65, 0.3, 0.95); tick(1.9, 2200, 0.1);
  /* crouch, then the jump */
  rustle(2.4, 0.5, 0.3); thud(2.85, 0.25);
  boing(2.95, 0.8, 1.1); imp(3.0, 0.85, 2); smp('app_sfx_whoosh', 3.0, 0.4); rocketSweep(3.0, 4.4, 0.4);
  /* flapping all the way up (2.6 wing beats a second) */
  for (let t = 3.2; t < 11.7; t += 0.385) smp('app_flap', t, 0.13, {rate: 0.95 + hash(t) * 0.1, max: 0.5});
  wind(3.4, 12.2, 0.26);
  /* the cuts */
  [4.5, 6.5, 9.0, 11.0].forEach((t, i) => { smp('swish-1', t - 0.04, 0.3, {rate: 1 + i * 0.05}); thud(t, 0.18); });
  [4.0, 5.0, 7.5, 8.2, 10.0, 10.6].forEach((t, i) => { smp('app_sfx_whoosh', t, 0.18, {rate: 1.1 + hash(i) * 0.3}); });
  /* "12 TESTER" and "300 INSTALL" */
  pop(6.6, 0.5, 1.05); chime(6.62, [84, 88, 91], 0.36, 0.06); stamp(6.64, 0.4); sparkle(6.7, 0.9, 0.5, 10);
  pop(9.0, 0.5, 1.15); chime(9.02, [84, 88, 91, 96], 0.4, 0.06); imp(9.02, 0.6, 3); stamp(9.04, 0.45); sparkle(9.1, 1.0, 0.55, 12);
  /* arriving: slow down and land */
  air(11.6, 0.8, 0.3, false); whistle(11.2, 12.2, 0.18);
  thud(12.3, 0.5); smp('app_sfx_boing', 12.3, 0.4); smp('swish-1', 12.46, 0.3);
  /* 12.5 s: the party */
  imp(12.5, 1.0, 4); smp('app_sfx_cheer', 12.5, 0.7); smp('app_mm_milestone', 12.55, 0.6); sparkle(12.52, 1.6, 0.6, 16);
  for (let i = 0; i < 16; i++) pop(12.52 + i * 0.05 + hash(i) * 0.03, 0.16, 1.0 + hash(i + 4) * 0.8);
  smp('app_sfx_cheer', 14.0, 0.28, {rate: 1.05}); smp('app_sfx_cheer', 16.0, 0.28, {rate: 0.95});
  /* one thump each time it lands on a beat */
  for (let t = 12.5; t < 17.4; t += 0.5) { thud(t, 0.2); smp('app_flap', t + 0.18, 0.08, {rate: 1.2, max: 0.3}); }
  /* fireworks: a whistle up, a burst, crackle */
  [12.7, 13.3, 13.9, 14.6, 15.2, 15.9, 16.6, 17.1].forEach((bt, i) => {
    whistle(bt - 0.45, bt, 0.16); smp('app_box_burst', bt, 0.3, {rate: 0.9 + hash(i) * 0.4, max: 0.8}); boom(bt, 0.22);
    sparkle(bt + 0.02, 1.0, 0.45, 12); for (let k = 0; k < 6; k++) tick(bt + 0.15 + k * 0.09 + hash(i * 9 + k) * 0.05, 2200 + hash(k + i) * 1400, 0.09);
  });
  /* "200K VIEWS" */
  imp(15.1, 0.7, 3); stamp(15.12, 0.5); chime(15.14, [88, 91, 96, 100], 0.4, 0.06); sparkle(15.2, 1.0, 0.5, 12); smp('app_star_3', 15.3, 0.4);
  /* the end */
  imp(17.0, 0.8, 2); chime(17.02, [84, 88, 91, 96], 0.5, 0.07); sparkle(17.05, 1.0, 0.55, 12);
}

// ===== SCORE END

/* ============================== reverb ============================== */
function reverb(input, off) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({b: new Float32Array(Math.round((d + off) * 1.6)), i: 0, f: 0}));
  const aps = [556, 441, 341, 225].map((d) => ({b: new Float32Array(Math.round((d + off) * 1.1)), i: 0}));
  const out = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.f = o * 0.72 + c.f * 0.28;
      c.b[c.i] = x + c.f * 0.87;
      c.i = (c.i + 1) % c.b.length;
      y += o;
    }
    for (const a of aps) {
      const o = a.b[a.i];
      a.b[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.b.length;
      y = o - y * 0.5;
    }
    out[n] = y;
  }
  return out;
}
const wl = reverb(SL, 0);
const wr = reverb(SRr, 23);

/* ============================== master ============================== */
const hpL = new Biquad('hp', 32);
const hpR = new Biquad('hp', 32);
const oL = new Float32Array(N);
const oR = new Float32Array(N);
let sum = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * (t > DUR - 0.5 ? Math.max(0, (DUR - t) / 0.5) : 1);
  const auto = 1;
  oL[i] = hpL.run(L[i] + wl[i] * 0.95) * fade * auto;
  oR[i] = hpR.run(R[i] + wr[i] * 0.95) * fade * auto;
  sum += oL[i] * oL[i] + oR[i] * oR[i];
}
const rms = Math.sqrt(sum / (2 * N));
const gain = PART === 'music' ? Math.pow(10, -15.5 / 20) / rms : 1.0;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
let peak = 0;
for (let i = 0; i < N; i++) {
  const l = Math.tanh(oL[i] * gain * 1.1) * 0.95;
  const r = Math.tanh(oR[i] * gain * 1.1) * 0.95;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
const out = path.join('assets', 'audio', PART + '.wav');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, buf);
console.log(`wrote ${out} — peak ${peak.toFixed(2)}, gain ${gain.toFixed(2)}`);
