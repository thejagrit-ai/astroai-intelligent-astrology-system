import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKundli } from '../src/lib/astrology';

test('generateKundli outputs valid planet longitudes, rashis, houses, and nakshatras', () => {
  const kundli = generateKundli('Test', '1990-01-01', '12:00', 'Delhi');
  assert.ok(Array.isArray(kundli.planets), 'planets should be array');
  for (const p of kundli.planets) {
    assert.equal(typeof p.name, 'string');
    assert.ok(typeof p.longitude === 'number' && p.longitude >= 0 && p.longitude < 360, `longitude ${p.longitude} in range`);
    assert.ok(typeof p.rashi === 'string' && p.rashi.length > 0, 'rashi present');
    assert.ok(Number.isInteger(p.house) && p.house >= 1 && p.house <= 12, `house ${p.house} in 1..12`);
    assert.ok(typeof p.nakshatra === 'string' && p.nakshatra.length > 0, 'nakshatra present');
  }
});
