import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKundli } from '../src/lib/astrology';

test('generateKundli is deterministic for same inputs', () => {
  const a = generateKundli('DetUser', '1995-05-20', '08:15', 'Mumbai');
  const b = generateKundli('DetUser', '1995-05-20', '08:15', 'Mumbai');

  // Basic structural checks
  assert.equal(a.ascendant, b.ascendant);
  assert.equal(a.mahadasha, b.mahadasha);
  assert.equal(a.nakshatra, b.nakshatra);
  assert.deepEqual(a.planets.map(p => ({ name: p.name, longitude: p.longitude, rashi: p.rashi, house: p.house, nakshatra: p.nakshatra })),
                   b.planets.map(p => ({ name: p.name, longitude: p.longitude, rashi: p.rashi, house: p.house, nakshatra: p.nakshatra })));
});
