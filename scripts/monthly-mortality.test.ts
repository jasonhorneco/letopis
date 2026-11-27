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

test('monthly removals preserve resident order, immediate links, and a birth queued before its father dies', () => {
  const sim = new Simulation(null, 42);
  const band = sim.s.bands[0];
  const [mother, father, otherFather, widow, resident] = sim.s.people.filter(p => p.bandId === band.id);
  assert.ok(resident);
  for (const person of [mother, father, otherFather, widow, resident]) {
    person.born = sim.s.tick - 24 * 12;
    person.partnerId = null;
    person.lastBirth = -999;
  }
  mother.sex = widow.sex = 1;
  father.sex = otherFather.sex = resident.sex = 0;
  mother.partnerId = father.id;
  father.partnerId = mother.id;
  widow.partnerId = otherFather.id;
  otherFather.partnerId = widow.id;
  father.born = otherFather.born = sim.s.tick - 200 * 12;
  band.fed = 1.4;
  band.lastNeed = band.lastProd = 1;
  const people = sim.s.people;
  const orderedSurvivors = people.filter(p => p !== father && p !== otherFather);
  const members = new Map(sim.s.bands.map(b => [b.id, [] as typeof people]));
  const bandMembers = [mother, father, otherFather, widow, resident];
  members.set(band.id, bandMembers);
  const firstChildId = sim.s.nextPersonId;
  const expected = [false, true, true, true, false, false, false, false];
  const chance = sim.rng.chance.bind(sim.rng);
  let draw = 0;
  sim.rng.chance = probability => {
    if (draw === 3) {
      assert.equal(sim['byId'].get(father.id), undefined);
      assert.equal(bandMembers.includes(father), false);
      assert.equal(mother.partnerId, null);
    }
    if (draw === 4) {
      assert.equal(sim['byId'].get(otherFather.id), undefined);
      assert.equal(bandMembers.includes(otherFather), false);
      assert.equal(widow.partnerId, null);
    }
    const roll = chance(probability);
    return expected[draw++] ?? roll;
  };
  sim['lifeAndDeath'](members);
  assert.ok(draw >= expected.length);
  assert.strictEqual(sim.s.people, people);
  assert.equal(people.length, orderedSurvivors.length + 1);
  for (const [i, survivor] of orderedSurvivors.entries()) assert.strictEqual(people[i], survivor);
  assert.deepEqual(bandMembers, [mother, widow, resident]);
  assert.deepEqual(sim.deadQueue.map(d => [d.id, d.partnerId]), [[father.id, mother.id], [otherFather.id, widow.id]]);
  assert.deepEqual(sim.events.filter(e => e.kind === 'death').map(e => e.personId), [father.id, otherFather.id]);
  const child = people.at(-1)!;
  assert.deepEqual([child.id, child.motherId, child.fatherId, child.bandId], [firstChildId, mother.id, father.id, band.id]);
  assert.ok(mother.children.includes(child.id) && father.children.includes(child.id));
  assert.ok(sim.deadQueue[0].children.includes(child.id));
  assert.equal(widow.children.includes(child.id), false);
});

test('seeded mortality keeps the same resident order and RNG after a checkpoint round trip', () => {
  const sim = new Simulation(null, 42);
  const elders = sim.s.people.slice(0, 5);
  for (const person of elders) person.born = sim.s.tick - 200 * 12;
  sim.step();
  assert.deepEqual(sim.deadQueue.filter(d => elders.some(p => p.id === d.id)).map(d => d.id), elders.map(p => p.id));
  const restored = new Simulation(JSON.parse(JSON.stringify(sim.serialize())));
  assert.deepEqual(restored.s.people, sim.s.people);
  assert.deepEqual(restored.rng.s, sim.rng.s);
  for (let i = 0; i < 4; i++) {
    sim.events = [];
    sim.deadQueue = [];
    restored.step();
    sim.step();
    assert.deepEqual(restored.s.people, sim.s.people);
    assert.deepEqual(restored.deadQueue, sim.deadQueue);
    assert.deepEqual(restored.events, sim.events);
    assert.deepEqual(restored.rng.s, sim.rng.s);
    restored.events = [];
    restored.deadQueue = [];
  }
});

test('an interrupted mortality pass removes completed deaths from the original array', () => {
  const sim = new Simulation(null, 42);
  const band = sim.s.bands[0];
  const people = sim.s.people;
  const cohort = people.filter(p => p.bandId === band.id).slice(0, 2);
  const [dead, survivor] = cohort;
  dead.born = sim.s.tick - 200 * 12;
  dead.partnerId = survivor.id;
  survivor.partnerId = dead.id;
  band.lastNeed = band.lastProd = 1;
  const expected = people.filter(p => p !== dead);
  const members = new Map(sim.s.bands.map(b => [b.id, b === band ? cohort : []]));
  const injected = new Error('injected after first death');
  let rolls = 0;
  sim.rng.chance = () => {
    if (rolls++ === 0) return true;
    throw injected;
  };

  assert.throws(() => sim['lifeAndDeath'](members), error => error === injected);
  assert.strictEqual(sim.s.people, people);
  assert.deepEqual(people, expected);
  for (const p of expected) assert.strictEqual(sim['byId'].get(p.id), p);
  assert.equal(sim['byId'].size, expected.length);
  assert.equal(sim['byId'].has(dead.id), false);
  assert.deepEqual(cohort, [survivor]);
  assert.equal(survivor.partnerId, null);
  assert.deepEqual(sim.deadQueue.map(d => d.id), [dead.id]);
  assert.deepEqual(sim.events.filter(e => e.kind === 'death').map(e => e.personId), [dead.id]);
});
