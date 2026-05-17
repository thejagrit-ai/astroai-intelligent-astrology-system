import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGunaMilan, generateKundli } from '../src/lib/astrology';

test('generateKundli is deterministic for same input', () => {
  const input = {
    name: 'Aarav',
    dob: '1998-07-15',
    time: '10:25',
    place: 'Delhi',
  };

  const first = generateKundli(input.name, input.dob, input.time, input.place);
  const second = generateKundli(input.name, input.dob, input.time, input.place);

  assert.deepEqual(first, second);
});

test('generateKundli changes on meaningful input change', () => {
  const first = generateKundli('Aarav', '1998-07-15', '10:25', 'Delhi');
  const second = generateKundli('Aarav', '1998-07-15', '10:26', 'Delhi');

  assert.notDeepEqual(first, second);
});

test('calculateGunaMilan is stable and symmetric for same pair', () => {
  const boy = generateKundli('Arjun', '1997-01-10', '09:10', 'Mumbai');
  const girl = generateKundli('Meera', '1999-03-11', '07:40', 'Pune');

  const first = calculateGunaMilan(boy, girl);
  const second = calculateGunaMilan(boy, girl);
  const swapped = calculateGunaMilan(girl, boy);

  assert.deepEqual(first, second);
  assert.equal(first.score, swapped.score);
  assert.equal(first.gunaMilan, swapped.gunaMilan);
});
