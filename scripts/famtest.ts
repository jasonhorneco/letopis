// Runs a saved world for a while and prints what the famous people did.
// usage: node dist/famtest.mjs <world.json.gz> <until year>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Simulation } from '../src/server/sim/sim';
import { FAMOUS } from '../src/shared/famous';
const sim = new Simulation(JSON.parse(gunzipSync(readFileSync(process.argv[2])).toString('utf8')));
const until = Number(process.argv[3] ?? 2000);
while (sim.year < until && !sim.extinct) {
  sim.step();
  for (const e of sim.events) {
    if (e.kind === 'famous') console.log(Math.floor(sim.year), e.text, '|', e.en?.text, '|', e.de?.text);
    if ((e.kind === 'discovery') && e.personId) {
      const p = sim.s.people.find((q) => q.id === e.personId);
      if (p?.fame) console.log(Math.floor(sim.year), 'DISCOVERY', e.text);
    }
  }
  sim.events = []; sim.deadQueue = []; sim.goneQueue = []; sim.treeChanges = []; sim.roadChanges = [];
}
console.log('born', (sim.s.famous ?? []).length, 'of', FAMOUS.filter((f) => f.born >= 1890 && f.born < until).length);
