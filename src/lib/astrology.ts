export interface Planet {
  name: string;
  longitude: number; // 0-360
  rashi: string;
  house: number;
  nakshatra: string;
}

import { computeAccurateKundli } from './ephemeris';

export interface KundliData {
  planets: Planet[];
  houses: string[];
  ascendant: string;
  nakshatra: string;
  mahadasha: string;
  antardasha: string;
  predictions: {
    personality: string;
    career: string;
    marriage: string;
    health: string;
    remedies: string[];
  };
}

const RASHIS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

const PREDICTION_TEMPLATES = {
  dynamic: [
    "Your path is illuminated by strong planetary alignments, suggesting a period of significant growth.",
    "The celestial positioning indicates a need for balance between your spiritual and worldly pursuits.",
    "A unique combination of dasha periods suggests that hidden talents will soon surface.",
    "The placement of your moon sign brings emotional depth and intuitive wisdom to your decision-making."
  ],
  career: [
    "A highly successful phase in professional life is predicted. Mercury's influence favors communication and trade.",
    "Stability in career is foreseen. Hard work will yield results under Saturn's steady gaze.",
    "Creative fields will provide the best opportunities for advancement. Venus favors artistic endeavors.",
    "Leadership roles are likely. Your natural charisma will help you navigate complex organizational structures."
  ],
  marriage: [
    "Harmony in relationships is predicted. A supportive partner will be a pillar of strength.",
    "Meaningful connections are on the horizon. Patience will lead to soulful bonds.",
    "Focus on communication to strengthen your marital ties. Jupiter's blessing brings wisdom to partnerships.",
    "A period of deep emotional connection and mutual respect is indicated in your relationship sector."
  ],
  health: [
    "Vitality remains high. Regular physical activity will enhance your natural energy levels.",
    "Focus on mental wellness and meditation. A calm mind will reflect in vibrant health.",
    "Pay attention to digestive health. Balanced nutrition is key to your ongoing well-being.",
    "Excellent physical recovery and stamina are predicted. Stay hydrated and well-rested."
  ]
};

const REMEDIES = [
  "Maintain a daily gratitude journal to align with positive frequencies.",
  "Chant the 'Om' mantra 108 times daily for mental clarity.",
  "Donate a portion of your earnings on Saturdays to appease Saturn.",
  "Offer water to the Sun every morning for vitality and success.",
  "Wear light blue or white on Mondays to calm the mind.",
  "Practice mindfulness meditation for 15 minutes each evening.",
  "Keep a small rose quartz or crystal to attract harmony in relationships."
];

function normalizeSeedPart(value: string | undefined) {
  return (value || '').trim().toLowerCase();
}

function hashString(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function seededIndex(seed: string, offset: string, length: number) {
  return hashString(`${seed}|${offset}`) % length;
}

function seededFraction(seed: string, offset: string) {
  return hashString(`${seed}|${offset}`) / 0x7fffffff;
}

function formatLongitude(longitude: number) {
  return Number(longitude.toFixed(2));
}

function buildSeed(name: string, dob: string, time: string, place: string) {
  return [name, dob, time, place].map(normalizeSeedPart).join('|');
}

function buildPlanets(seed: string) {
  const planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

  return planetNames.map((name, index) => {
    // Produce a raw longitude and normalize into [0, 360)
    const raw = seededFraction(seed, `planet-${name}-${index}`) * 360;
    const longitude = formatLongitude((raw % 360 + 360) % 360);

    const rashiIndex = Math.floor(longitude / 30) % 12;
    const nakIndex = Math.floor(longitude / (360 / 27)) % 27;
    const house = rashiIndex + 1; // house numbers 1..12 aligned with rashi index

    return {
      name,
      longitude,
      rashi: RASHIS[rashiIndex],
      house,
      nakshatra: NAKSHATRAS[nakIndex],
    };
  });
}

function buildRemedies(seed: string) {
  return [
    REMEDIES[seededIndex(seed, 'remedy-1', REMEDIES.length)],
    REMEDIES[seededIndex(seed, 'remedy-2', REMEDIES.length)],
    REMEDIES[seededIndex(seed, 'remedy-3', REMEDIES.length)],
  ];
}

function buildPredictions(seed: string) {
  return {
    personality: PREDICTION_TEMPLATES.dynamic[seededIndex(seed, 'personality', PREDICTION_TEMPLATES.dynamic.length)],
    career: PREDICTION_TEMPLATES.career[seededIndex(seed, 'career', PREDICTION_TEMPLATES.career.length)],
    marriage: PREDICTION_TEMPLATES.marriage[seededIndex(seed, 'marriage', PREDICTION_TEMPLATES.marriage.length)],
    health: PREDICTION_TEMPLATES.health[seededIndex(seed, 'health', PREDICTION_TEMPLATES.health.length)],
    remedies: buildRemedies(seed),
  };
}

export function generateKundli(name: string, dob: string, time: string, place: string): KundliData {
  const seed = buildSeed(name, dob, time, place);
  const planets = buildPlanets(seed);
  const ascIndex = seededIndex(seed, 'ascendant', 12);
  const mahadashas = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  const ascendant = RASHIS[ascIndex];
  const houses = RASHIS.slice(ascIndex).concat(RASHIS.slice(0, ascIndex));

  return {
    planets,
    houses,
    ascendant,
    nakshatra: planets[1].nakshatra,
    mahadasha: mahadashas[seededIndex(seed, 'mahadasha', mahadashas.length)],
    antardasha: mahadashas[seededIndex(seed, 'antardasha', mahadashas.length)],
    predictions: buildPredictions(seed),
  };
}

export function calculateKundli(nameOrDob: string, dobOrTime: string, timeOrPlace: string, maybePlace?: string): KundliData {
  if (typeof maybePlace === 'string') {
    return generateKundli(nameOrDob, dobOrTime, timeOrPlace, maybePlace);
  }

  return generateKundli('', nameOrDob, dobOrTime, timeOrPlace);
}

export function getZodiacSign(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  return "Capricorn";
}

function chartSignature(chart: KundliData) {
  return [
    chart.ascendant,
    chart.nakshatra,
    chart.mahadasha,
    chart.antardasha,
    chart.planets.map(planet => `${planet.name}:${planet.longitude.toFixed(2)}:${planet.rashi}:${planet.house}:${planet.nakshatra}`).join('|'),
  ].join('||');
}

function deriveGunaScore(boyData: KundliData, girlData: KundliData) {
  const parts = [chartSignature(boyData), chartSignature(girlData)].sort();
  const combinedSeed = `${parts[0]}::${parts[1]}`;
  return 18 + seededIndex(combinedSeed, 'guna-score', 19);
}

function deriveGunaDescription(score: number) {
  return score > 25
    ? 'Excellent compatibility with strong emotional bond.'
    : score > 18
      ? 'Good compatibility. Requires some adjustments.'
      : 'Average match. Caution advised in communication.';
}

export function calculateGunaMilan(boyData: KundliData, girlData: KundliData) {
  const score = deriveGunaScore(boyData, girlData);
  return {
    score,
    percentage: Math.round((score / 36) * 100),
    explanation: deriveGunaDescription(score),
    gunaMilan: score
  };
}

export function calculateCompatibility(boyData: KundliData, girlData: KundliData) {
  return calculateGunaMilan(boyData, girlData);
}

export async function generateKundliAccurate(name: string, dob: string, time: string, place: string): Promise<KundliData> {
  const accurate = await computeAccurateKundli(name, dob, time, place);
  if (accurate) return accurate;
  return generateKundli(name, dob, time, place);
}
