#!/usr/bin/env node
/*
  Kundli validator using Swiss Ephemeris (optional).

  Usage:
    1. Install swisseph: `npm install swisseph`
    2. Run: `npm run validate:kundli`

  The script will compare planetary longitudes from `generateKundli` with Swiss Ephemeris
  for a set of sample birthdates and report differences (degrees).
*/
import { generateKundli } from '../lib/astrology';

async function run() {
  let swe: any;
  try {
    // dynamic import so script can run even when package is missing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    swe = require('swisseph');
  } catch (err) {
    console.error('Swiss Ephemeris (swisseph) package is not installed.');
    console.error('Install with: npm install swisseph');
    process.exitCode = 2;
    return;
  }

  const samples = [
    { name: 'Sample A', nameStr: 'A', dob: '1990-01-01', time: '12:00', place: 'Delhi', year: 1990, month: 1, day: 1, hour: 12 },
    { name: 'Sample B', nameStr: 'B', dob: '1985-06-15', time: '07:30', place: 'Mumbai', year: 1985, month: 6, day: 15, hour: 7.5 },
  ];

  const planetMap = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

  console.log('Starting Kundli validation against Swiss Ephemeris...');

  for (const s of samples) {
    console.log(`\nSample: ${s.name} (${s.dob} ${s.time})`);
    const localKundli = generateKundli(s.nameStr, s.dob, s.time, s.place);

    // Swiss Ephemeris expects Julian Day UT; use swe.julday
    const jd = swe.julday(s.year, s.month, s.day, s.hour);

    const diffs: string[] = [];

    for (let i = 0; i < planetMap.length; i++) {
      const pname = planetMap[i];
      let sweIndex: number | null = null;
      switch (pname) {
        case 'Sun': sweIndex = swe.SUN; break;
        case 'Moon': sweIndex = swe.MOON; break;
        case 'Mars': sweIndex = swe.MARS; break;
        case 'Mercury': sweIndex = swe.MERCURY; break;
        case 'Jupiter': sweIndex = swe.JUPITER; break;
        case 'Venus': sweIndex = swe.VENUS; break;
        case 'Saturn': sweIndex = swe.SATURN; break;
        case 'Rahu': sweIndex = swe.MEAN_NODE; break;
        case 'Ketu': sweIndex = swe.MEAN_NODE; break;
        default: sweIndex = null;
      }

      if (sweIndex === null) continue;

      // For Rahu/Ketu we will compute the mean node and derive Ketu as opposite.
      let sweepos: number;
      if (pname === 'Ketu') {
        const node = swe.calc_ut(jd, swe.MEAN_NODE);
        sweepos = (node.longitude + 180) % 360;
      } else {
        const res = swe.calc_ut(jd, sweIndex);
        sweepos = res.longitude;
      }

      const ours = localKundli.planets.find(p => p.name === pname);
      if (!ours) {
        diffs.push(`${pname}: missing in our kundli`);
        continue;
      }

      const delta = Math.abs(((ours.longitude - sweepos + 540) % 360) - 180); // minimal angular distance
      diffs.push(`${pname}: ours=${ours.longitude.toFixed(3)}°, swe=${sweepos.toFixed(3)}°, Δ=${delta.toFixed(3)}°`);
    }

    console.log(diffs.join('\n'));
  }

  console.log('\nValidation complete.');
}

run().catch(err => {
  console.error('Validator error:', err);
  process.exitCode = 1;
});
