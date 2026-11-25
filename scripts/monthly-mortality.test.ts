import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation } from '../src/server/sim/sim';

test('a death does not skip the next band member in the monthly life cycle', () => {
  const sim = new Simulation(null, 42);
  const cohort = sim.s.people.filter(p => p.bandId === sim.s.bands[0].id).slice(0, 6);
  assert.equal(cohort.length, 6);
  // At this synthetic age the ordinary mortality roll always succeeds.
  for (const person of cohort) person.born = sim.s.tick - 200 * 12;
  sim.step();
  const ids = new Set(cohort.map(p => p.id));
  assert.equal(sim.deadQueue.filter(d => ids.has(d.id)).length, cohort.length);
  assert.equal(sim.s.people.filter(p => ids.has(p.id)).length, 0);
});
