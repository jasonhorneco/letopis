import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation } from '../src/server/sim/sim';

function crossing() {
  const earth = new Simulation(null, 42);
  const state = earth.serialize();
  const band = state.bands[0];
  const people = state.people.filter(p => p.bandId === band.id);
  // In this seed a straight sea crossing ends at the shore at (100, 6).
  const path = Array.from({ length: 20 }, (_, i) => 6 * earth.mapSize + 80 + i);
  state.fleet = [{
    id: 1, x: 79, y: 6, way: [], path, dest: [100, 6], isle: false, band,
    from: band.id, fromBg: band.name, fromEn: band.name, fromDe: band.name,
    techs: band.techs, color: band.color, people,
  }];
  state.people = [];
  state.bands = [];
  return state;
}

test('a reloaded world stays alive until its last village lands', () => {
  const sim = new Simulation(JSON.parse(JSON.stringify(crossing())));
  const ids = sim.s.fleet![0].people.map(p => p.id);
  assert.ok(ids.length > 0);
  sim.step();
  assert.equal(sim.s.people.length, 0);
  assert.equal(sim.s.fleet![0].people.length, ids.length);
  assert.equal(sim.extinct, false);
  sim.step();
  assert.equal(sim.s.fleet!.length, 0);
  assert.deepEqual(sim.s.people.map(p => p.id), ids);
  assert.equal(sim.extinct, false);
});

test('an empty ship or an older save without a fleet cannot keep an empty world alive', () => {
  const state = crossing();
  state.fleet![0].people = [];
  assert.equal(new Simulation(state).extinct, true);
  delete state.fleet;
  assert.equal(new Simulation(state).extinct, true);
});
