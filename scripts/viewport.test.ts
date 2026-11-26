import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Simulation } from '../src/server/sim/sim';
import { localPeople, regionRows, VIEWPORT_PEOPLE_LIMIT } from '../src/server/views';
import { PEOPLE_PER_BAND } from '../src/shared/types';
import type { PersonRow } from '../src/shared/types';

interface Resident { id: number; bandId: number; x: number; y: number; fame?: number }
const view = { key: '0,0', x0: 100, y0: 200, w: 50, h: 50, map: null };
const region = { left: 1, top: 2, right: 8, bottom: 9 };

function simulation(people: Resident[], chiefs = new Set<number>()) {
  const residents = new Map(people.map(p => [p.id, p]));
  let encoded = 0;
  const sim = {
    s: { people, bands: [...chiefs].map(chiefId => ({ chiefId })) },
    personRow(id: number): PersonRow | undefined {
      encoded++;
      const p = residents.get(id);
      if (p) return [id, Math.round(p.x * 10), Math.round(p.y * 10), 0, p.bandId, 20, 0, Number(chiefs.has(id)), p.fame ?? 0];
    },
  } as unknown as Simulation;
  return { sim, encoded: () => encoded };
}

test('busy viewport caps serialized rows and samples deterministically across settlements', () => {
  const people = Array.from({ length: 50 * 300 }, (_, i) =>
    ({ id: i + 1, bandId: Math.floor(i / 300) + 1, x: 105, y: 207, fame: i === 298 ? 7 : undefined }));
  const chief = 300;
  const primary = simulation(people, new Set([chief]));
  const reverse = simulation([...people].reverse(), new Set([chief]));
  const rows = regionRows(primary.sim, view, region);
  assert.equal(rows.length, VIEWPORT_PEOPLE_LIMIT);
  assert.equal(primary.encoded(), VIEWPORT_PEOPLE_LIMIT);
  assert.deepEqual(rows, regionRows(reverse.sim, view, region));
  assert.equal(new Set(rows.map(r => r[4])).size, 50);
  assert.equal(new Set(rows.map(r => r[0])).size, VIEWPORT_PEOPLE_LIMIT);
  assert.equal(rows[0][0], chief);
  assert.equal(rows[50][0], 299, 'prominent people follow the chief in their settlement');
});

test('the settlement sample matches the renderer budget and preserves small groups', () => {
  const people = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, bandId: 1, x: 105, y: 207 }));
  people.push({ id: 121, bandId: 2, x: 105, y: 207 }, { id: 122, bandId: 3, x: 105, y: 207 });
  const { sim } = simulation(people);
  const rows = regionRows(sim, view, region);
  assert.equal(rows.length, PEOPLE_PER_BAND + 2);
  assert.deepEqual(rows.slice(1, 3).map(r => r[0]), [121, 122]);
});

test('focus survives outside the rectangle and reserves a slot, with map-local coordinates', () => {
  const people = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, bandId: 1, x: 105, y: 207 }));
  people.push({ id: 61, bandId: 1, x: 120, y: 212 }, { id: 62, bandId: 1, x: 154, y: 212 });
  const { sim } = simulation(people);
  const rows = regionRows(sim, view, { ...region, focus: 61 });
  assert.equal(rows.length, PEOPLE_PER_BAND);
  assert.equal(rows[0][0], 61);
  assert.equal(rows.filter(row => row[0] === 61).length, 1);
  assert.deepEqual(localPeople(rows, view)[0].slice(0, 3), [61, 200, 120]);
  assert.deepEqual(regionRows(sim, view, { focus: 61 }), [rows[0]]);
  assert.deepEqual(regionRows(sim, view, { focus: 62 }), []);
  assert.deepEqual(regionRows(sim, view, { focus: 999 }), []);
  assert.deepEqual(regionRows(sim, view, null), []);
});
