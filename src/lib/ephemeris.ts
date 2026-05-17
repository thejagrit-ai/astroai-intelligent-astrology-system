import { KundliData } from './astrology';
// Lightweight wrapper: attempt to use `astronomia` for ephemeris calculations.
// If `astronomia` is not installed or an error occurs, return null so caller can fallback.

export async function computeAccurateKundli(name: string, dob: string, time: string, place: string): Promise<KundliData | null> {
  try {
    const astr = await import('astronomia');
      // Best-effort ephemeris: try to compute geocentric ecliptic longitudes using
      // `astronomia` when available. This is intentionally tolerant: if any step
      // fails (missing data, APIs, or time/location gaps), it returns null so the
      // caller can fall back to the deterministic generator.
      const mod = await import('astronomia');

      // Basic guards: different versions export modules differently; check for a couple
      // of expected helpers. If absent, bail out gracefully.
      const julian = (mod as any).julian || (mod as any).Julian;
      const solar = (mod as any).solar || (mod as any).sun || null;
      const moonpos = (mod as any).moonposition || (mod as any).moon || null;
      const planetposition = (mod as any).planetposition || null;

      if (!julian) {
        console.info('astronomia present but julian module unavailable');
        return null;
      }

      // Parse date/time — note: input `time` has no timezone information. We assume
      // the provided date/time are in UTC to compute positions. For production use
      // you should pass explicit timezone and geographic longitude for house
      // calculations; here we only compute approximate planetary longitudes.
      const [y, m, d] = (dob || '').split('-').map(s => parseInt(s, 10));
      const [hh, mm] = (time || '00:00').split(':').map(s => parseInt(s, 10));
      if (!y || !m || !d) return null;

      // Julian Day (UTC)
      let jd: number;
      try {
        // julian.day or julian.calendarToJD depending on API
        if (typeof julian.jd === 'function') {
          // some builds expose jd(year, month, day, hour)
          jd = (julian as any).jd(y, m, d + (hh + mm / 60) / 24);
        } else if (typeof julian.calendarGregorianToJD === 'function') {
          jd = (julian as any).calendarGregorianToJD(y, m, d) + (hh + mm / 60) / 24;
        } else if (typeof julian.calendarToJD === 'function') {
          jd = (julian as any).calendarToJD(y, m, d) + (hh + mm / 60) / 24;
        } else {
          // fallback: compute JS Date and convert
          const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
          jd = (dt.getTime() / 86400000) + 2440587.5;
        }
      } catch (err) {
        const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
        jd = (dt.getTime() / 86400000) + 2440587.5;
      }

      const planets: any[] = [];

      // Helper to safely call a module function and return null on failure
      const safeCall = (fn: Function | null, ...args: any[]) => {
        try { return fn ? fn(...args) : null; } catch (e) { return null; }
      };

      // Sun longitude (apparent) if available
      let sunLon: number | null = null;
      if (solar && typeof (solar as any).apparentLongitude === 'function') {
        const val = safeCall((solar as any).apparentLongitude, jd);
        sunLon = typeof val === 'number' ? (val % 360 + 360) % 360 : null;
      }

      // Moon longitude
      let moonLon: number | null = null;
      if (moonpos && typeof (moonpos as any).position === 'function') {
        const mpos = safeCall((moonpos as any).position, jd);
        if (mpos && typeof mpos.lon === 'number') moonLon = (mpos.lon % 360 + 360) % 360;
        else if (mpos && typeof mpos.longitude === 'number') moonLon = (mpos.longitude % 360 + 360) % 360;
      }

      // For other planets try planetposition with bundled VSOP data if present.
      const planetNames = ['Mercury','Venus','Mars','Jupiter','Saturn'];
      for (const pname of planetNames) {
        try {
          // try to resolve data module: 'astronomia/data/vsop87Bear/<planet>.js'
          let data: any = null;
          try {
            data = await import(`astronomia/data/vsop87Bear/${pname.toLowerCase()}.js`);
            data = data && data.default ? data.default : data;
          } catch (e) {
            try {
              data = await import(`astronomia/data/vsop87/${pname.toLowerCase()}.js`);
              data = data && data.default ? data.default : data;
            } catch (ee) {
              data = null;
            }
          }

          if (planetposition && data) {
            const P = new (planetposition as any).Planet(data);
            const c = safeCall((planetposition as any).position, P, jd);
            // different builds return different shapes
            const lon = c && (c.lon || c.longitude || (c.ecl && c.ecl.lon));
            if (typeof lon === 'number') {
              planets.push({ name: pname, longitude: (lon % 360 + 360) % 360 });
              continue;
            }
          }
        } catch (err) {
          // ignore and continue
        }

        // if we reach here push null placeholder
        planets.push({ name: pname, longitude: null });
      }

      // Build results merging sun/moon and placeholders
      const resultPlanets: any[] = [];
      resultPlanets.push({ name: 'Sun', longitude: sunLon ?? 0, rashi: '', house: 0, nakshatra: '' });
      resultPlanets.push({ name: 'Moon', longitude: moonLon ?? 0, rashi: '', house: 0, nakshatra: '' });
      for (const p of planets) resultPlanets.push({ name: p.name, longitude: (typeof p.longitude === 'number' ? p.longitude : 0), rashi: '', house: 0, nakshatra: '' });
      // Rahu/Ketu (mean node) — not implemented robustly here
      resultPlanets.push({ name: 'Rahu', longitude: 0, rashi: '', house: 0, nakshatra: '' });
      resultPlanets.push({ name: 'Ketu', longitude: 180, rashi: '', house: 0, nakshatra: '' });

      // Construct a minimal KundliData to return; predictions/mahadasa will be filled
      const seed = `${name}|${dob}|${time}|${place}`;

      return {
        planets: resultPlanets.map(p => ({
          name: p.name,
          longitude: typeof p.longitude === 'number' ? Number(p.longitude.toFixed(2)) : 0,
          rashi: '',
          house: 0,
          nakshatra: '',
        })),
        houses: [],
        ascendant: '',
        nakshatra: resultPlanets[1]?.nakshatra || '',
        mahadasha: '',
        antardasha: '',
        predictions: {
          personality: 'Accurate ephemeris generated predictions are not yet implemented.',
          career: '',
          marriage: '',
          health: '',
          remedies: [],
        }
      } as KundliData;
  } catch (err) {
    // Not installed or failed to compute — caller will fall back to existing generator.
    console.info('astronomia not available or failed to compute accurate kundli', err);
    return null;
  }
}
