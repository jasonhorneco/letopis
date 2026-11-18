// Fishing canoes: once a clan knows the boat, now and then someone pushes off from the bank,
// paddles out on the water, casts a net and comes back. Only for the eye: the simulation does not know about them.
// (People who travel over water paddle across in their own canoe: see PersonSprite.)

import { Container, Sprite } from 'pixi.js';
import type { WorldRenderer } from './render';
import { iso } from './render';
import type { BandView } from '../shared/types';

interface Camp { id: number; x: number; y: number; color: number }
interface Canoe {
  c: Container; body: Sprite; cloth: Sprite;
  path: [number, number][]; t: number; speed: number;
  /** cross: over and back; fish: out, a net cast, back */
  kind: 'cross' | 'fish';
  phase: 'go' | 'stay' | 'back';
  wait: number; seed: number;
}

const MAX = 8;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Canoes {
  canoes: Canoe[] = [];
  private camps: Camp[] = [];
  private lastSpawn = 0;
  constructor(public r: WorldRenderer) {}

  private ok(): boolean {
    return this.r.atlas.has('canoese0') && this.r.atlas.has('canoene0');
  }

  private water(x: number, y: number): boolean {
    const { w, h } = this.r.info;
    return x >= 0 && y >= 0 && x < w && y < h && !this.r.walkable(x, y);
  }

  updateBands(bands: BandView[]) {
    if (!this.r.info) return;
    // dugouts belong to the old ages: with ocean ships and harbours they are gone
    this.camps = bands.filter((b) => b.techIds.includes('boats') && !b.techIds.includes('caravel'))
      .map((b) => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), color: b.color }));
  }

  /** banks near the camp: a dry tile with water next to it */
  private banks(c: Camp): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (!this.r.walkable(x, y)) continue;
      for (const [ex, ey] of DIRS) if (this.water(x + ex, y + ey)) out.push([x, y, ex, ey]);
    }
    return out;
  }

  /** out on open water: a few tiles away from the bank, through water only */
  private outing(x: number, y: number, ex: number, ey: number): [number, number][] | null {
    const start: [number, number] = [x + ex, y + ey];
    const seen = new Map<string, [number, number] | null>([[`${start[0]},${start[1]}`, null]]);
    const queue: [number, number, number][] = [[start[0], start[1], 0]];
    const far: [number, number][] = [];
    for (let qi = 0; qi < queue.length && qi < 400; qi++) {
      const [cx, cy, d] = queue[qi];
      if (d >= 2) far.push([cx, cy]);
      if (d >= 4) continue;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
        if (seen.has(key) || !this.water(nx, ny)) continue;
        seen.set(key, [cx, cy]);
        queue.push([nx, ny, d + 1]);
      }
    }
    if (!far.length) return null;
    let at: [number, number] | null = far[Math.floor(Math.random() * far.length)];
    const path: [number, number][] = [];
    while (at) { path.push(at); at = seen.get(`${at[0]},${at[1]}`) ?? null; }
    path.push([x + ex * 0.45, y + ey * 0.45]);
    return path.reverse();
  }

  private launch(c: Camp) {
    const banks = this.banks(c);
    if (!banks.length) return;
    const [x, y, ex, ey] = banks[Math.floor(Math.random() * banks.length)];
    const path = this.outing(x, y, ex, ey);
    if (!path) return;
    const kind: Canoe['kind'] = 'fish';
    const box = new Container();
    const body = this.r.atlas.sprite('canoese0');
    const cloth = this.r.atlas.sprite('canoese0');
    cloth.tint = c.color;
    box.addChild(body, cloth);
    this.r.peopleLayer.addChild(box);
    const speed = 0.22;
    this.canoes.push({ c: box, body, cloth, path, t: 0, speed, kind, phase: 'go', wait: 0, seed: Math.random() * 100 });
  }

  private pose(k: Canoe, name: string) {
    this.r.atlas.set(k.body, name);
    const cloth = this.r.atlas.has(name + '_c');
    k.cloth.visible = cloth;
    if (cloth) this.r.atlas.set(k.cloth, name + '_c');
  }

  frame(now: number, dt: number) {
    if (!this.r.info || !this.ok()) return;
    if (now - this.lastSpawn > 3500 && this.camps.length && this.canoes.length < Math.min(MAX, this.camps.length)) {
      this.lastSpawn = now;
      this.launch(this.camps[Math.floor(Math.random() * this.camps.length)]);
    }
    // dt: seconds of real time
    const sec = dt;
    for (const k of this.canoes) {
      const n = k.path.length - 1;
      if (k.phase === 'stay') {
        k.wait -= sec;
        if (k.wait <= 0) { k.phase = 'back'; k.t = 0; k.path.reverse(); }
      } else {
        const j = Math.min(n - 1, Math.floor(k.t));
        const seg = Math.max(0.3, Math.hypot(k.path[j + 1][0] - k.path[j][0], k.path[j + 1][1] - k.path[j][1]));
        k.t = Math.min(n, k.t + k.speed * sec / seg);
        if (k.t >= n && k.phase === 'go') { k.phase = 'stay'; k.wait = k.kind === 'fish' ? 9 + Math.random() * 6 : 5; }
      }
      const i = Math.min(n - 1, Math.floor(k.t));
      const f = Math.min(1, k.t - i);
      const [x0, y0] = k.path[i], [x1, y1] = k.path[i + 1];
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const p = this.r.tileTop(x, y);
      k.c.position.set(p.x, p.y + Math.sin(now / 700 + k.seed) * 0.5);
      k.c.zIndex = p.y;
      const sx = iso(x1, y1).x - iso(x0, y0).x, sy = iso(x1, y1).y - iso(x0, y0).y;
      if (k.phase === 'stay') {
        // out on the water: the net; on the far bank: the canoe rests with the paddle still
        if (k.kind === 'fish' && this.r.atlas.has('canoenet0')) this.pose(k, `canoenet${Math.floor(now / 600 + k.seed) % 4}`);
        else this.pose(k, sy < 0 ? 'canoene0' : 'canoese0');
      } else {
        // the sprites paddle south-east (towards us) or north-east (away); going west they turn round
        this.pose(k, `${sy < 0 ? 'canoene' : 'canoese'}${Math.floor(now / 380 + k.seed) % 4}`);
        k.c.scale.x = Math.abs(k.c.scale.x) * (sx < 0 ? -1 : 1);
      }
      // pushing off from the bank and landing: a soft fade
      const left = n - k.t;
      k.c.alpha = k.phase === 'go' ? Math.min(1, k.t * 3 + 0.2) : k.phase === 'back' ? Math.min(1, left * 3) : 1;
    }
    this.canoes = this.canoes.filter((k) => {
      if (!(k.phase === 'back' && k.t >= k.path.length - 1)) return true;
      k.c.destroy({ children: true });
      return false;
    });
  }
}
