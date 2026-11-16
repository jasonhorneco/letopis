// Trains on the railways: an engine and two or three wagons run along the tracks from town to town.
// Only for the eye: the simulation does not know about them.

import { Sprite } from 'pixi.js';
import type { WorldRenderer } from './render';
import { iso } from './render';
import type { BandView } from '../shared/types';

interface Train { parts: Sprite[]; path: [number, number][]; s: number; speed: number; seed: number; end: number }

const MAX_TRAINS = 8;
const GAP = 1.15;

export class Trains {
  trains: Train[] = [];
  private stations: [number, number][] = [];
  private lastSpawn = 0;
  constructor(public r: WorldRenderer) {}

  /** a railway tile next to every town that knows the railway */
  updateBands(bands: BandView[]) {
    if (!this.r.info) return;
    this.stations = [];
    for (const b of bands) {
      if (!b.settled || !b.techIds.includes('railway')) continue;
      const bx = Math.round(b.x), by = Math.round(b.y);
      let best: [number, number] | null = null, bd = 99;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < bd && this.r.isRail(bx + dx, by + dy)) { bd = d; best = [bx + dx, by + dy]; }
      }
      if (best) this.stations.push(best);
    }
  }

  private next(path: [number, number][]): [number, number] | null {
    const [x, y] = path[path.length - 1];
    const prev = path.length > 1 ? path[path.length - 2] : null;
    const opts: [number, number][] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (prev && prev[0] === nx && prev[1] === ny) continue;
      if (this.r.isRail(nx, ny)) opts.push([nx, ny]);
    }
    if (!opts.length) return null;
    // keep going straight when the track allows it
    if (prev) {
      const sx = x * 2 - prev[0], sy = y * 2 - prev[1];
      const straight = opts.find(([a, b]) => a === sx && b === sy);
      if (straight && Math.random() < 0.7) return straight;
    }
    return opts[Math.floor(Math.random() * opts.length)];
  }

  private spawn() {
    const st = this.stations[Math.floor(Math.random() * this.stations.length)];
    const path: [number, number][] = [st];
    // a few steps back along the track, so the wagons have somewhere to be
    const n = this.next(path);
    if (!n) return;
    path.push(n);
    const names = Math.random() < 0.5 ? ['carriage', 'carriage', 'goodswagon'] : ['goodswagon', 'goodswagon'];
    const parts = [this.r.atlas.sprite('loco0')];
    for (const nm of names) if (this.r.atlas.has(nm)) parts.push(this.r.atlas.sprite(nm));
    for (const p of parts) { p.alpha = 0; this.r.peopleLayer.addChild(p); }
    this.trains.push({ parts, path, s: 0, speed: 1.4 + Math.random() * 0.6, seed: Math.random() * 100, end: 60 + Math.floor(Math.random() * 120) });
  }

  /** a point on the path, its tile coordinates and the direction it is heading */
  private at(path: [number, number][], s: number): { x: number; y: number; west: boolean } {
    const i = Math.max(0, Math.min(path.length - 2, Math.floor(s)));
    const f = Math.max(0, Math.min(1, s - i));
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, west: iso(x1, y1).x < iso(x0, y0).x };
  }

  frame(now: number, dt: number) {
    if (!this.r.info) return;
    if (!this.r.atlas.has('loco0')) return;
    if (now - this.lastSpawn > 5000 && this.stations.length >= 2 && this.trains.length < Math.min(MAX_TRAINS, Math.ceil(this.stations.length / 2))) {
      this.lastSpawn = now;
      this.spawn();
    }
    for (const tr of this.trains) {
      tr.s += tr.speed * dt;
      // lay the track ahead as the train goes; it stops (and fades) at the end of the line
      while (tr.path.length < tr.s + 3 && tr.path.length < tr.end) {
        const n = this.next(tr.path);
        if (!n) { tr.end = tr.path.length; break; }
        tr.path.push(n);
      }
      const last = tr.path.length - 1;
      const head = Math.min(tr.s, last);
      const fade = Math.min(1, tr.s / 1.5, (tr.end - 1 - tr.s) / 1.5);
      tr.parts.forEach((p, k) => {
        const s = head - k * GAP;
        p.visible = s >= 0;
        if (s < 0) return;
        const a = this.at(tr.path, s);
        const t = this.r.tileTop(a.x, a.y);
        p.position.set(t.x, t.y);
        p.scale.x = Math.abs(p.scale.x) * (a.west ? -1 : 1);
        p.alpha = Math.max(0, fade);
        p.zIndex = t.y;
      });
      this.r.atlas.set(tr.parts[0], `loco${Math.floor(now / 150 + tr.seed) % 4}`);
    }
    this.trains = this.trains.filter((tr) => {
      if (tr.s < tr.end - 1) return true;
      for (const p of tr.parts) p.destroy();
      return false;
    });
  }
}
