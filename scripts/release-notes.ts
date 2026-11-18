// Release notes for a round version (1.70, 1.80, ...): the English changelog of every version since the last round one.
// usage: node dist/release-notes.mjs 1.70
(globalThis as { localStorage?: unknown }).localStorage ??= { getItem: () => null, setItem: () => undefined };
const { CHANGELOG } = await import('../src/client/help');
const [maj, min] = process.argv[2].split('.').map(Number);
const out: string[] = [];
for (const r of CHANGELOG) {
  const [a, b] = r.v.split('.').map(Number);
  if (a !== maj || b <= min - 10 || b > min) continue;
  out.push(`## ${r.v}`, '');
  for (const it of r.items) out.push(`- ${it[3] === 'fix' ? 'Fix: ' : ''}${it[1].replace(/<[^>]+>/g, '')}`);
  out.push('');
}
console.log(out.join('\n'));
