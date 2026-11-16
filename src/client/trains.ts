// Things that run along the tracks and roads, and fly over them: trains between the towns that know the railway,
// cars, buses and lorries round the towns of the information age, and aeroplanes between their airports.
// Only for the eye: the simulation does not know about them.

import { Sprite } from 'pixi.js';
import type { WorldRenderer } from './render';
import { iso } from './render';
import type { BandView } from '../shared/types';

type Tile = [number, number];
/** parts: the sprites, the first one leads; frames: animation frames of the leader (0: none) */
interface Runner { parts: Sprite[]; lead: string; frames: number; path: Tile[]; s: number; speed: number; seed: number; end: number; on: (x: number, y: number) => boolean; lift: number; free?: boolean }

const GAP = 1.15;

/** the next tile along a track, going straight where it can */
function nextTile(path: Tile[], on: (x: number, y: number) => boolean): Tile | null {
  const [x, y] = path[path.length - 1];
  const prev = path.length > 1 ? path[path.length - 2] : null;
  const opts: Tile[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (prev && prev[0] === nx && prev[1] === ny) continue;
    if (on(nx, ny)) opts.push([nx, ny]);
  }
  if (!opts.length) return null;
  if (prev) {
    const sx = x * 2 - prev[0], sy = y * 2 - prev[1];
    const straight = opts.find(([a, b]) => a === sx && b === sy);
    if (straight && Math.random() < 0.7) return straight;
  }
  return opts[Math.floor(Math.random() * opts.length)];
}

/** the nearest tile of a track within 4 steps of a town */
function near(b: BandView, on: (x: number, y: number) => boolean): Tile | null {
  const bx = Math.round(b.x), by = Math.round(b.y);
  let best: Tile | null = null, bd = 99;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d < bd && on(bx + dx, by + dy)) { bd = d; best = [bx + dx, by + dy]; }
  }
  return best;
}

export class Trains {
  runners: Runner[] = [];
  private stations: { t: Tile; modern: boolean; maglev: boolean }[] = [];
  private garages: { t: Tile; space: boolean }[] = [];
  private starships = false;
  private airports: Tile[] = [];
  private lastTrain = 0;
  private lastCar = 0;
  private lastPlane = 0;
  constructor(public r: WorldRenderer) {}

  /** where trains, cars and planes start: next to the towns that know how */
  updateBands(bands: BandView[]) {
    if (!this.r.info) return;
    this.stations = [];
    this.garages = [];
    this.airports = [];
    this.starships = bands.some((b) => b.techIds.includes('starship'));
    const rail = (x: number, y: number) => this.r.isRail(x, y);
    const road = (x: number, y: number) => this.r.isRoad(x, y);
    for (const b of bands) {
      if (!b.settled) continue;
      const t = b.techIds;
      if (t.includes('railway')) {
        const st = near(b, rail);
        if (st) this.stations.push({ t: st, modern: t.includes('computer'), maglev: t.includes('maglev') });
      }
      if (t.includes('computer')) {
        const g = near(b, road);
        if (g) this.garages.push({ t: g, space: t.includes('moon_base') });
        if (t.includes('jet') && b.size > 150) this.airports.push([Math.round(b.x), Math.round(b.y)]);
      }
    }
  }

  private start(at: Tile, on: (x: number, y: number) => boolean, names: string[], lead: string, frames: number, speed: number, end: number, lift = 0) {
    const path: Tile[] = [at];
    const n = nextTile(path, on);
    if (!n) return;
    path.push(n);
    const parts = names.filter((nm) => this.r.atlas.has(nm)).map((nm) => this.r.atlas.sprite(nm));
    if (!parts.length) return;
    for (const p of parts) { p.alpha = 0; this.r.peopleLayer.addChild(p); }
    this.runners.push({ parts, lead, frames, path, s: 0, speed, seed: Math.random() * 100, end, on, lift });
  }

  private spawnTrain() {
    const st = this.stations[Math.floor(Math.random() * this.stations.length)];
    const rail = (x: number, y: number) => this.r.isRail(x, y);
    const end = 60 + Math.floor(Math.random() * 120);
    if (st.maglev && this.r.atlas.has('maglev0')) this.start(st.t, rail, ['maglev0'], 'maglev', 4, 3.2, end);
    else if (st.modern && this.r.atlas.has('etrain')) this.start(st.t, rail, ['etrain', 'etrain'], 'etrain', 0, 2.4 + Math.random() * 0.6, end);
    else this.start(st.t, rail, ['loco0', ...(Math.random() < 0.5 ? ['carriage', 'carriage', 'goodswagon'] : ['goodswagon', 'goodswagon'])], 'loco', 4, 1.4 + Math.random() * 0.6, end);
  }

  private spawnCar() {
    const { t: g, space } = this.garages[Math.floor(Math.random() * this.garages.length)];
    const road = (x: number, y: number) => this.r.isRoad(x, y);
    const k = Math.random();
    const end = 15 + Math.floor(Math.random() * 30);
    // in the space age the cars fly over the roads, pods drive themselves and drones carry the parcels
    if (space) {
      if (k < 0.45) this.start(g, road, ['flycar0'], 'flycar', 4, 2, end, 22);
      else if (k < 0.8) this.start(g, road, ['pod'], 'pod', 0, 1.3, end);
      else this.start(g, road, ['cargodrone'], 'cargodrone', 0, 1.6, end, 34);
      return;
    }
    if (k < 0.6) this.start(g, road, ['car0'], 'car', 4, 1.6 + Math.random() * 0.5, end);
    else if (k < 0.85) this.start(g, road, ['bus0'], 'bus', 4, 1.2, end);
    else this.start(g, road, ['truck'], 'truck', 0, 1.3, end);
  }

  /** a plane flies high over the land from one airport to another */
  private spawnPlane() {
    const a = this.airports[Math.floor(Math.random() * this.airports.length)];
    const others = this.airports.filter((o) => o !== a && Math.hypot(o[0] - a[0], o[1] - a[1]) > 15);
    if (!others.length || !this.r.atlas.has('plane0')) return;
    const b = others[Math.floor(Math.random() * others.length)];
    // later the big airships glide between the towns too, and now and then a starship passes high above
    const k = Math.random();
    const kind = this.starships && k < 0.1 && this.r.atlas.has('starship') ? 'starship' : this.starships && k < 0.4 && this.r.atlas.has('airship') ? 'airship' : 'plane';
    const s = this.r.atlas.sprite(kind === 'plane' ? 'plane0' : kind);
    s.alpha = 0;
    this.r.peopleLayer.addChild(s);
    const len = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    // a straight line of tile points; the plane does not care about the ground
    const path: Tile[] = [];
    for (let i = 0; i <= len; i++) path.push([a[0] + ((b[0] - a[0]) * i) / len, a[1] + ((b[1] - a[1]) * i) / len]);
    this.runners.push({ parts: [s], lead: kind, frames: kind === 'plane' ? 4 : 0, path, s: 0, speed: kind === 'plane' ? 4 : kind === 'airship' ? 1.5 : 1, seed: Math.random() * 100, end: path.length, on: () => true, lift: kind === 'starship' ? 140 : 70, free: true });
  }

  /** a point on the path and whether it heads west on screen */
  private at(path: Tile[], s: number): { x: number; y: number; west: boolean } {
    const i = Math.max(0, Math.min(path.length - 2, Math.floor(s)));
    const f = Math.max(0, Math.min(1, s - i));
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, west: iso(x1, y1).x < iso(x0, y0).x };
  }

  frame(now: number, dt: number) {
    if (!this.r.info) return;
    const count = (lead: string[]) => this.runners.filter((u) => lead.includes(u.lead)).length;
    if (now - this.lastTrain > 5000 && this.stations.length >= 2 && count(['loco', 'etrain', 'maglev']) < Math.min(8, Math.ceil(this.stations.length / 2))) {
      this.lastTrain = now;
      this.spawnTrain();
    }
    if (now - this.lastCar > 1500 && this.garages.length && count(['car', 'bus', 'truck', 'flycar', 'pod', 'cargodrone']) < Math.min(24, this.garages.length * 2)) {
      this.lastCar = now;
      this.spawnCar();
    }
    if (now - this.lastPlane > 9000 && this.airports.length >= 2 && count(['plane', 'airship', 'starship']) < 4) {
      this.lastPlane = now;
      this.spawnPlane();
    }
    for (const u of this.runners) {
      u.s += u.speed * dt;
      // the track ahead is found as it goes (planes have their whole line already); at the end of the line it fades away
      while (!u.free && u.path.length < u.s + 3 && u.path.length < u.end) {
        const n = nextTile(u.path, u.on);
        if (!n) { u.end = u.path.length; break; }
        u.path.push(n);
      }
      const last = u.path.length - 1;
      const head = Math.min(u.s, last);
      const fade = Math.min(1, u.s / 1.5, (u.end - 1 - u.s) / 1.5);
      u.parts.forEach((p, k) => {
        const s = head - k * GAP;
        p.visible = s >= 0;
        if (s < 0) return;
        const a = this.at(u.path, s);
        const t = this.r.tileTop(a.x, a.y);
        p.position.set(t.x, t.y - u.lift);
        p.scale.x = Math.abs(p.scale.x) * (a.west ? -1 : 1);
        p.alpha = Math.max(0, fade);
        p.zIndex = t.y + u.lift;
      });
      if (u.frames) this.r.atlas.set(u.parts[0], `${u.lead}${Math.floor(now / 150 + u.seed) % u.frames}`);
    }
    this.runners = this.runners.filter((u) => {
      if (u.s < u.end - 1) return true;
      for (const p of u.parts) p.destroy();
      return false;
    });
  }
}
