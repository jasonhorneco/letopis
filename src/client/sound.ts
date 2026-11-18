// Sounds of the place under the camera, made on the fly (no sound files): water, the murmur of a village,
// birds by day and crickets at night, the calls of the animals nearby. Close to the ground they are clear;
// the higher the camera goes, the more they blur together and fade away.

import type { WorldRenderer } from './render';
import { TW, TH } from './render';
import { Biome, isWater, RIVER_WATER } from '../shared/types';

type Call = (a: AudioContext, out: AudioNode, t: number) => void;

/** a voice: a tone gliding between pitches through a soft filter */
function voice(a: AudioContext, out: AudioNode, t: number, o: {
  type?: OscillatorType; f: number[]; dur: number; q?: number; cut?: number; vib?: number; vibRate?: number; gain?: number; attack?: number;
}) {
  const osc = a.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  const n = o.f.length - 1;
  osc.frequency.setValueAtTime(o.f[0], t);
  o.f.forEach((f, i) => { if (i) osc.frequency.linearRampToValueAtTime(f, t + (o.dur * i) / n); });
  if (o.vib) {
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = o.vibRate ?? 6;
    lg.gain.value = o.vib;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
  }
  const flt = a.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = o.cut ?? 1800;
  flt.Q.value = o.q ?? 1;
  const g = a.createGain();
  const peak = o.gain ?? 0.3, at = o.attack ?? 0.05;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + at);
  g.gain.setValueAtTime(peak, t + o.dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(flt).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

/** a short burst of noise (claps, clinks, wings, crackles) */
function burst(a: AudioContext, out: AudioNode, noise: AudioBuffer, t: number, freq: number, dur: number, gain: number, q = 2) {
  const s = a.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 1.5, dur + 0.05);
}

const moo: Call = (a, o, t) => voice(a, o, t, { f: [120, 135, 110, 95], dur: 1.4, cut: 700, q: 4, gain: 0.35, attack: 0.15 });
const baa: Call = (a, o, t) => voice(a, o, t, { f: [330, 310, 300], dur: 0.7, cut: 1600, q: 3, vib: 25, vibRate: 11, gain: 0.22 });
const bark: Call = (a, o, t) => { for (let i = 0; i < 2; i++) voice(a, o, t + i * 0.28, { type: 'square', f: [420, 300, 220], dur: 0.16, cut: 1200, q: 2, gain: 0.25, attack: 0.01 }); };
const howl: Call = (a, o, t) => voice(a, o, t, { type: 'triangle', f: [330, 520, 560, 480, 360], dur: 3, cut: 2500, vib: 8, vibRate: 5, gain: 0.2, attack: 0.4 });
const cluck: Call = (a, o, t) => { for (let i = 0; i < 4; i++) voice(a, o, t + i * 0.18, { type: 'square', f: [700, 500], dur: 0.08, cut: 2000, gain: 0.12, attack: 0.01 }); };
const neigh: Call = (a, o, t) => voice(a, o, t, { f: [900, 1100, 700, 500, 350], dur: 1.2, cut: 2400, vib: 60, vibRate: 14, gain: 0.18 });
const oink: Call = (a, o, t) => { for (let i = 0; i < 3; i++) voice(a, o, t + i * 0.22, { type: 'square', f: [180, 140], dur: 0.14, cut: 600, q: 5, gain: 0.25, attack: 0.02 }); };
const caw: Call = (a, o, t) => { for (let i = 0; i < 2; i++) voice(a, o, t + i * 0.4, { type: 'square', f: [700, 600, 520], dur: 0.25, cut: 1600, q: 6, gain: 0.15, attack: 0.02 }); };
const quack: Call = (a, o, t) => { for (let i = 0; i < 3; i++) voice(a, o, t + i * 0.2, { type: 'sawtooth', f: [500, 380], dur: 0.12, cut: 1100, q: 8, gain: 0.18, attack: 0.01 }); };
const hoot: Call = (a, o, t) => { for (const d of [0, 0.5, 0.75]) voice(a, o, t + d, { type: 'sine', f: [400, 380], dur: d ? 0.2 : 0.4, gain: 0.25, attack: 0.04 }); };
const screech: Call = (a, o, t) => voice(a, o, t, { type: 'sawtooth', f: [2200, 2600, 1800], dur: 0.8, cut: 4000, vib: 120, vibRate: 30, gain: 0.08 });
const meow: Call = (a, o, t) => voice(a, o, t, { f: [500, 750, 600], dur: 0.6, cut: 1800, q: 5, gain: 0.12 });
const growl: Call = (a, o, t) => voice(a, o, t, { f: [90, 110, 80], dur: 1.3, cut: 400, q: 2, vib: 15, vibRate: 22, gain: 0.35, attack: 0.2 });
const trumpet: Call = (a, o, t) => voice(a, o, t, { f: [500, 800, 760, 700], dur: 1.1, cut: 3000, vib: 30, vibRate: 9, gain: 0.15 });
const chirp: Call = (a, o, t) => {
  const base = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) voice(a, o, t + i * 0.13, { type: 'sine', f: [base, base * 1.3, base * 0.9], dur: 0.09, cut: 8000, gain: 0.05, attack: 0.01 });
};

/** the calls of the animals the eye can see */
const CALLS: Record<string, Call> = {
  cow: moo, aurochs: moo, bison: moo, sheep: baa, goat: baa, dog: bark, fox: bark, wolf: howl, hen: cluck,
  horse: neigh, wildhorse: neigh, donkey: neigh, pig: oink, boar: oink, crow: caw, duck: quack, swan: quack, owl: hoot,
  eagle: screech, cat: meow, bear: growl, cavebear: growl, lion: growl, elephant: trumpet, mammoth: trumpet, stork: chirp, heron: caw,
};

export class Soundscape {
  on = false;
  private a: AudioContext | null = null;
  private master!: GainNode;
  private water!: GainNode;
  private waves!: GainNode;
  private crowd!: GainNode;
  private wind!: GainNode;
  private noise!: AudioBuffer;
  private next = { animal: 0, bird: 0, village: 0, fire: 0 };
  private mix = { water: 0, sea: 0, crowd: 0, forest: 0, land: 0, near: 0 };
  private lastLook = 0;
  constructor(private r: WorldRenderer) {}

  /** browsers only let sound start after a click */
  start() {
    if (this.a) { void this.a.resume(); return; }
    const a = (this.a = new AudioContext());
    this.master = a.createGain();
    this.master.gain.value = 0;
    this.master.connect(a.destination);
    // two seconds of soft (brown) noise, the stuff water, wind and crowds are made of
    const len = a.sampleRate * 2;
    this.noise = a.createBuffer(1, len, a.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const loop = (cut: number, type: BiquadFilterType = 'lowpass', q = 0.7) => {
      const s = a.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = a.createBiquadFilter();
      f.type = type;
      f.frequency.value = cut;
      f.Q.value = q;
      const g = a.createGain();
      g.gain.value = 0;
      s.connect(f).connect(g).connect(this.master);
      s.start(0, Math.random() * 2);
      return g;
    };
    this.water = loop(1400, 'bandpass', 0.6); // a river babbling
    this.waves = loop(500);                    // the slow breath of the sea
    this.crowd = loop(900, 'bandpass', 1.2);   // many voices far off
    this.wind = loop(300);
  }

  stop() { void this.a?.suspend(); }

  /** what is under the camera: once in a while, it is cheap but not free */
  private look(cx: number, cy: number, R: number) {
    const { w, h } = this.r.info;
    let n = 0, water = 0, sea = 0, forest = 0;
    const step = Math.max(1, Math.round(R / 4));
    for (let y = Math.round(cy - R); y <= cy + R; y += step) for (let x = Math.round(cx - R); x <= cx + R; x += step) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x, b = this.r.biome[i];
      n++;
      if (isWater(b)) { sea++; water++; } else if (this.r.river[i] >= RIVER_WATER) water++;
      else if (b === Biome.Forest || b === Biome.Taiga || b === Biome.Marsh) forest++;
    }
    let crowd = 0;
    for (const c of this.r.camps.values()) {
      const d = Math.hypot(c.tx - cx, c.ty - cy);
      if (d < R + 3) crowd += Math.min(1, (2 + c.homes.children.length) / 10) * (1 - d / (R + 3));
    }
    this.mix = { water: n ? (water - sea) / n : 0, sea: n ? sea / n : 0, crowd: Math.min(1, crowd), forest: n ? forest / n : 0, land: n ? 1 - water / n : 1, near: 0 };
  }

  frame(camX: number, camY: number, zoom: number, halfW: number) {
    const a = this.a;
    if (!a || !this.on || !this.r.info) return;
    const now = a.currentTime;
    // screen point to tile (ground level is close enough)
    const cx = (camX / (TW / 2) + camY / (TH / 2)) / 2, cy = (camY / (TH / 2) - camX / (TW / 2)) / 2;
    // the camera up high hears nothing; close down everything is clear
    const near = Math.max(0, Math.min(1, (zoom - 0.6) / 2.4));
    const R = Math.max(3, Math.min(10, 8 / Math.max(0.4, zoom) + 2));
    if (performance.now() - this.lastLook > 400) { this.lastLook = performance.now(); this.look(cx, cy, R); }
    const m = this.mix, night = this.r.nightNow;
    // up high the sounds blur: the clear calls go first, the soft beds last
    const bed = near ** 0.7, clear = near ** 1.6;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, now, 0.5);
    set(this.master, 0.9);
    set(this.water, m.water * 0.12 * bed);
    set(this.waves, m.sea * (0.08 + 0.05 * Math.sin(now * 0.6)) * bed);
    set(this.crowd, m.crowd * (night ? 0.03 : 0.1) * (0.75 + 0.25 * Math.sin(now * 0.9 + Math.sin(now * 2.3))) * bed);
    set(this.wind, 0); // the steady wind was heard everywhere and grated
    if (clear < 0.05) return;
    // birds by day over woods and fields, crickets at night
    if (now > this.next.bird && m.land > 0.3 && !this.r.mars) {
      this.next.bird = now + 1.5 + Math.random() * 4 / (0.3 + m.forest);
      const g = a.createGain();
      g.gain.value = clear * (0.5 + m.forest);
      const p = a.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(p).connect(this.master);
      if (night) for (let i = 0; i < 6; i++) voice(a, g, now + i * 0.07, { type: 'sine', f: [4300, 4300], dur: 0.04, gain: 0.025, attack: 0.005 });
      else chirp(a, g, now);
    }
    // the village: a hammer, a door, voices calling
    if (now > this.next.village && m.crowd > 0.15 && !night) {
      this.next.village = now + 0.8 + Math.random() * 3;
      const g = a.createGain();
      g.gain.value = clear * m.crowd;
      const p = a.createStereoPanner();
      p.pan.value = Math.random() * 1.4 - 0.7;
      g.connect(p).connect(this.master);
      if (Math.random() < 0.5) burst(a, g, this.noise, now, 2500 + Math.random() * 1500, 0.08, 0.6, 6);
      else voice(a, g, now, { type: 'sawtooth', f: [180 + Math.random() * 120, 220 + Math.random() * 150], dur: 0.25 + Math.random() * 0.3, cut: 900, q: 6, gain: 0.07 });
    }
    // the fire crackles at night
    if (now > this.next.fire && m.crowd > 0.1 && night) {
      this.next.fire = now + 0.05 + Math.random() * 0.4;
      burst(a, this.master, this.noise, now, 3000 + Math.random() * 3000, 0.03, 0.25 * clear * m.crowd, 3);
    }
    // an animal nearby calls now and then, from where it stands
    if (now > this.next.animal) {
      this.next.animal = now + 2 + Math.random() * 5;
      const f = this.r.fauna;
      const all = [...f.wild, ...[...f.tame.values()].flat()].filter((x) => CALLS[x.sp.id] && Math.hypot(x.x - cx, x.y - cy) < R);
      const pickA = all[Math.floor(Math.random() * all.length)];
      if (pickA && (!night || ['owl', 'wolf', 'dog'].includes(pickA.sp.id))) {
        const d = Math.hypot(pickA.x - cx, pickA.y - cy);
        const g = a.createGain();
        g.gain.value = clear * (1 - d / R) * 1.2;
        const p = a.createStereoPanner();
        const sx = ((pickA.x - pickA.y) * (TW / 2) - camX) * zoom;
        p.pan.value = Math.max(-1, Math.min(1, sx / halfW));
        g.connect(p).connect(this.master);
        CALLS[pickA.sp.id](a, g, now);
      }
    }
  }
}
