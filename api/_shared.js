import { GoogleGenAI } from "@google/genai";

const chatResponseCache = new Map();
const horoscopeCache = new Map();
const reportCache = new Map();
const DEFAULT_CHAT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-3-flash-preview"
];

const SYSTEM_PROMPT = `
You are Astro Guru, an expert Vedic astrologer.

Rules:
- Always give COMPLETE answers (never cut sentences)
- Minimum 6-8 lines
- Explain properly (no half responses)
- Always include:
  - Insight
  - Explanation
  - Guidance
  - Remedies (2-3)
- End with a follow-up question
- Never repeat same template
`;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildAstroGuruInstruction(userKundli, options) {
  const selectedTone = (options && options.answerTone) || "detailed";
  const goalsText = options && options.userGoals
    ? `User goals and context memory: ${options.userGoals}`
    : "User goals and context memory: Not provided yet.";
  const userName = (options && options.userName) || (userKundli && (userKundli.name || userKundli.fullName)) || 'Seeker';
  const historySummary = (options && options.historySummary) || 'No recent chat summary available.';
  const ascendant = (userKundli && userKundli.ascendant) || "Aries";
  const nakshatra = (userKundli && userKundli.nakshatra) || "Ashwini";
  const mahadasha = (userKundli && userKundli.mahadasha) || "Rahu";
  const antardasha = (userKundli && userKundli.antardasha) || "Rahu";

  return `${SYSTEM_PROMPT}

You are Astro Guru, a precise and compassionate Vedic astrologer.
User name: ${userName}
User chart data: ${JSON.stringify(userKundli)}.
${goalsText}
Recent chat summary: ${historySummary}

Interpret the chart using the following anchors:
- Ascendant: ${ascendant}
- Nakshatra: ${nakshatra}
- Mahadasha: ${mahadasha}
- Antardasha: ${antardasha}

Requirements:
- Give detailed astrology insights with planetary position interpretation.
- Mention any dosha patterns, strengths, and balancing factors when relevant.
- Provide practical advice for career, love, health, and finance.
- Include 2-4 specific remedies such as mantra, gemstone, fasting, donation, or daily practice.
- Keep the tone personal, grounded, and non-generic.
- Use the chart data consistently and do not invent contradictions.
- Write in well-structured paragraphs with short section breaks.
- Add a section called Why this advice tied to chart factors.
- If the query is vague, ask 1-2 clarifying follow-up questions before final recommendations.
- Avoid repetitive generic statements.

Tone preference mode: ${selectedTone}.
Tone rules:
- concise: keep it short and actionable.
- detailed: comprehensive with sections and context.
- spiritual: include dharmic framing and mantras.
- practical: concrete everyday action plan.`;
}

function summarizeRecentMessages(history) {
  try {
    if (!Array.isArray(history) || history.length === 0) return 'No recent history.';
    const last = history.slice(-6).map(m => (m.parts && m.parts[0] && m.parts[0].text) ? m.parts[0].text : (m.text || '')).filter(Boolean);
    if (last.length === 0) return 'No recent history.';
    // create a short 1-3 sentence summary by joining and truncating
    const joined = last.join(' | ');
    if (joined.length <= 240) return joined;
    return joined.slice(0, 240) + '...';
  } catch (e) {
    return 'No recent history.';
  }
}



function extractGeminiText(response) {
  const primary = typeof response?.text === "string" ? response.text.trim() : "";
  if (primary) {
    return primary;
  }

  const candidateParts = Array.isArray(response?.candidates)
    ? response.candidates
        .flatMap((candidate) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .filter(Boolean)
    : [];

  return candidateParts.join("\n").trim();
}

function sanitizeResponse(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lastChar = normalized[normalized.length - 1];
  if (/[\.,!?)]/.test(lastChar)) {
    return normalized;
  }

  return `${normalized}.`;
}

function hasMinimumQuality(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 6) return false;
  if (text.length < 260) return false;

  const uniqueLines = new Set(lines.map((line) => line.toLowerCase()));
  return uniqueLines.size >= 4;
}

function buildRepairPrompt(userMessage, partialResponse) {
  return [
    SYSTEM_PROMPT,
    "The previous response is incomplete or too short. Rewrite it fully.",
    "Output requirements:",
    "- Minimum 8 lines",
    "- Complete sentences only",
    "- Include Insight, Explanation, Guidance, and 2-3 Remedies",
    "- End with one follow-up question",
    `User question: ${userMessage}`,
    `Incomplete draft: ${partialResponse}`,
  ].join("\n\n");
}

function buildStructuredReportPrompt(zodiac, period, userKundli) {
  return `Create a ${period} astrology report for ${zodiac}.
Chart context: ${JSON.stringify(userKundli || {})}

Return strict JSON only with this exact schema:
{
  "insight": "string",
  "focus": "string",
  "avoid": "string",
  "career": "string",
  "love": "string",
  "money": "string",
  "health": "string",
  "remedies": ["string", "string", "string"]
}

Quality rules:
- Personalized, specific, non-generic astrology guidance.
- Mention planetary influence in at least one section.
- Practical and realistic recommendations.
- No markdown.
- No extra keys.`;
}

export function defaultChatText() {
  return "The stars suggest steady progress today. Focus on one priority, communicate clearly, and avoid impulsive reactions in important decisions.";
}

function normalizeMessage(input) {
  return String(input || "").trim().toLowerCase();
}

function buildIntent(userMessage) {
  const query = normalizeMessage(userMessage);

  if (!query) return "general";
  if (/^hi$|^hello$|^hey$|namaste|good\s+(morning|afternoon|evening)/i.test(query)) return "greeting";
  if (/career|job|work|business|promotion|interview|salary|startup|profession/i.test(query)) return "career";
  if (/love|marriage|relationship|partner|spouse|dating|breakup/i.test(query)) return "love";
  if (/health|stress|sleep|anxiety|illness|fitness|energy/i.test(query)) return "health";
  if (/money|finance|wealth|income|investment|debt|loan|expense/i.test(query)) return "money";
  if (/remedy|upay|mantra|gemstone|pooja|donation|fasting|vrat/i.test(query)) return "remedies";
  if (/personality|nature|strength|weakness|traits|behavior/i.test(query)) return "personality";
  if (/transit|gochar|dasha|antardasha|timeline|next\s*(month|week|30|90)/i.test(query)) return "timeline";
  return "general";
}

function deterministicPick(list, seedInput) {
  const raw = String(seedInput || "fallback");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  const pick = Math.abs(hash) % list.length;
  return list[pick];
}

function buildFallbackResponse(message, userKundli, options, reason) {
  const name = userKundli?.name || userKundli?.fullName || "seeker";
  const ascendant = userKundli?.ascendant || userKundli?.zodiacSign || "Aries";
  const nakshatra = userKundli?.nakshatra || "Ashwini";
  const mahadasha = userKundli?.mahadasha || "Rahu";
  const antardasha = userKundli?.antardasha || "Rahu";
  const tone = options?.answerTone || "detailed";
  const intent = buildIntent(message);

  const fallbackByIntent = {
    greeting: [
      `Namaste ${name}. I am with you. Your ${ascendant} ascendant shows initiative, and ${mahadasha}-${antardasha} supports focused action over scattered effort.`,
      `Pranam ${name}. I can already see a strong ${nakshatra} influence in your chart pattern. Ask me career, relationship, health, or remedies and I will guide precisely.`,
      `Blessings ${name}. Your chart currently reflects movement through ${mahadasha}-${antardasha}. Start with your top concern, and I will give a chart-based step-by-step reading.`
    ],
    career: [
      `Career Insight: With ${ascendant} rising and ${mahadasha}-${antardasha}, your progress comes through disciplined execution and visible communication.

Why this is happening: This combination amplifies ambition, but results improve when planning and consistency are stronger than speed.

What to do now: Build one 30-day priority plan, send weekly updates to mentors/managers, and avoid changing direction too quickly.

Remedies: Chant Om Gam Ganapataye Namah 108 times on Wednesdays, donate green moong on Wednesdays, and start work during a fixed morning hour daily.` ,
      `Career Outlook: Your karma sector is active, favoring practical growth rather than dramatic jumps.

Why this is happening: ${nakshatra} influence rewards skill refinement and sustained effort.

What to do now: Focus on one high-value skill, keep a work journal, and defer risky switches until momentum is stable.

Remedies: Offer water to Surya at sunrise, keep Saturdays light and disciplined, and perform one act of service weekly.`
    ],
    love: [
      `Love Insight: Your relationship axis is sensitive now, bringing deep emotions and lessons in clarity.

Why this is happening: ${mahadasha}-${antardasha} can intensify expectations, while ${ascendant} energy prefers fast decisions.

What to do now: Speak clearly, pace commitment decisions, and check assumptions before reacting.

Remedies: Chant Om Shukraya Namah on Fridays, wear clean light colors on Fridays, and practice one calm listening ritual each evening.`,
      `Relationship Reading: This phase supports healing and stability if communication stays grounded.

Why this is happening: ${nakshatra} pattern shows emotional depth with occasional overthinking.

What to do now: Set shared weekly check-ins, reduce reactive messaging, and prioritize trust-building actions.

Remedies: Offer white sweets on Fridays, keep a gratitude note for your partner, and avoid major decisions during emotional spikes.`
    ],
    health: [
      `Health Insight: Your chart suggests stress regulation is the primary key right now.

Why this is happening: ${mahadasha}-${antardasha} can disturb rhythm if sleep and food timing become irregular.

What to do now: Fix sleep-wake timing, add 20 minutes of daily walking, and reduce late-night screen stimulation.

Remedies: Chant Maha Mrityunjaya Mantra 11 times daily, hydrate on a fixed schedule, and keep evening meals lighter.`,
      `Vitality Reading: Energy is available, but consistency determines outcomes.

Why this is happening: ${ascendant} gives drive, while ${nakshatra} may increase mental load when routines are weak.

What to do now: Follow a 7-day routine reset with sleep, hydration, and breathing practice.

Remedies: 5 minutes pranayama morning and evening, avoid skipped meals, and offer water to the Sun at sunrise.`
    ],
    money: [
      `Money Insight: Financial stability is favored through structure, not impulsive bets.

Why this is happening: Current dasha flow supports accumulation through disciplined choices.

What to do now: Use a 50-30-20 framework, avoid emotional spending, and review expenses weekly.

Remedies: Donate food on Saturdays, keep one savings transfer automated, and avoid new debt without a repayment map.`,
      `Wealth Reading: A gradual but durable growth phase is active.

Why this is happening: ${ascendant} drive can increase earnings, but risk-control must stay strong.

What to do now: Prioritize emergency fund expansion and steady investments over speculative moves.

Remedies: Offer mustard oil at Shani temple on Saturdays and maintain strict budget discipline for 40 days.`
    ],
    remedies: [
      `Targeted Remedies for your current chart window:
1. Chant Om Namah Shivaya (108 repetitions) daily.
2. Offer water to Surya at sunrise on Sundays.
3. Donate black sesame or food on Saturdays.
4. Keep one discipline vow for 21 days (speech, sleep, or spending).

These stabilize Rahu-style fluctuations and improve decision clarity.`,
      `Practical Upay Plan:
1. Maha Mrityunjaya Mantra (11 times) for mental steadiness.
2. Friday Venus remedy: offer white flowers/sweets.
3. Wednesday Mercury remedy: donate green moong.
4. Daily 10-minute silence after sunset.

Follow for 21 days, then reassess outcomes.`
    ],
    personality: [
      `Personality Insight: ${ascendant} rising gives initiative, courage, and independent thinking. ${nakshatra} adds sensitivity and depth.

Growth edge: You do best when speed is balanced with reflection.

Actionable focus: Keep a weekly review of decisions, communication, and energy leaks to convert intensity into clarity.`,
      `Core Traits Reading: Your chart pattern shows leadership potential, intuitive pattern recognition, and high inner drive.

Challenge pattern: Occasional overcommitment and impatience under pressure.

Improvement path: Set fewer priorities, finish deeply, and protect recovery windows.`
    ],
    timeline: [
      `Near-Term Timeline: Next 30 days favor structured actions, communication cleanup, and disciplined routines.

Week 1: organize priorities and pending decisions.
Week 2: relationship and communication alignment.
Week 3: career visibility and output consistency.
Week 4: financial pruning and energy reset.

Key advice: choose consistency over intensity for best outcomes.`,
      `Transit-Oriented Guidance: Your current dasha rhythm supports correction and consolidation before expansion.

Next 4 weeks: improve systems, reduce reactive decisions, and close old loops.

Best window: after your routines stabilize, then take strategic growth steps.`
    ],
    general: [
      `Core Reading: Your chart currently favors grounded progress through disciplined daily action.

Why this is happening: ${mahadasha}-${antardasha} can create high ambition with mental noise if routine is weak.

What to do now: simplify priorities, keep communication clear, and follow one daily spiritual anchor.

Remedies: Om Namah Shivaya, sunrise water offering, and weekly donation discipline.`,
      `General Insight: This phase is about alignment, not speed. You gain most by reducing distraction and acting with consistency.

Chart factors: ${ascendant}, ${nakshatra}, and ${mahadasha}-${antardasha} indicate strong outcomes when focus and routine are non-negotiable.

Practical next step: share your top concern (career/love/health/money) for a tighter reading.`
    ]
  };

  const chosen = deterministicPick(
    fallbackByIntent[intent] || fallbackByIntent.general,
    `${message}|${ascendant}|${nakshatra}|${mahadasha}|${antardasha}`
  );

  const compact = tone === "concise";
  // Never expose internal service errors or API status to end users.
  const suffix = "";

  if (compact) {
    return `${chosen.split("\n\n")[0]}\n\nAsk one specific question for a sharper chart-based answer.${suffix}`;
  }

  return `${chosen}\n\nWould you like a deeper chart breakdown for your next 30 days?${suffix}`;
}

function normalizeErrorMessage(message) {
  const lowered = String(message || "").toLowerCase();
  if (lowered.includes("quota") || lowered.includes("rate") || lowered.includes("resource_exhausted")) {
    return "quota limit";
  }
  if (lowered.includes("api key") || lowered.includes("permission_denied") || lowered.includes("unauthorized")) {
    return "authorization issue";
  }
  if (lowered.includes("model") || lowered.includes("not found") || lowered.includes("unsupported")) {
    return "model unavailable";
  }
  if (lowered.includes("network") || lowered.includes("fetch") || lowered.includes("timeout")) {
    return "network issue";
  }
  return "service issue";
}

function getCandidateModels() {
  const configured = String(process.env.GEMINI_MODEL || "").trim();
  if (!configured) {
    return DEFAULT_CHAT_MODELS;
  }

  if (DEFAULT_CHAT_MODELS.includes(configured)) {
    return [configured, ...DEFAULT_CHAT_MODELS.filter((model) => model !== configured)];
  }

  return [configured, ...DEFAULT_CHAT_MODELS];
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function defaultHoroscopeText(zodiac) {
  return `${zodiac} daily reading: Career improves through disciplined planning, relationships benefit from calm communication, and finances favor cautious choices. A short morning meditation helps your clarity.`;
}

export function defaultStructuredReport(zodiac, period) {
  return {
    insight: `${zodiac} ${period} reading shows steady progress with best outcomes through disciplined action and emotional balance.`,
    focus: "Prioritize one meaningful goal and complete it with full attention before taking on new tasks.",
    avoid: "Avoid impulsive reactions, overcommitting time, and making financial decisions under emotional pressure.",
    career: "Career momentum builds through consistency. Document your work and communicate clearly with seniors and collaborators.",
    love: "Relationships improve with calm listening and practical affection. Keep expectations clear and communication gentle.",
    money: "Use a structured plan for expenses and savings. Small disciplined decisions compound into stability.",
    health: "Sleep rhythm, hydration, and light exercise are your key support pillars in this cycle.",
    remedies: [
      "Chant a grounding mantra for 11 minutes in the morning.",
      "Offer water to the Sun on Sundays and maintain a gratitude journal.",
      "Donate food or essentials once this week to balance karmic flow."
    ]
  };
}

function getAi() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GENAI_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    console.warn('No Gemini/GenAI API key found in environment. Checked GEMINI_API_KEY, GENAI_KEY, GOOGLE_API_KEY, VITE_GEMINI_API_KEY.');
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

export async function getChatReply({ message, userKundli, history, options }) {
  const userMessage = String(message || '').trim();

  const ai = getAi();
  if (!ai) {
    const fallback = buildFallbackResponse(userMessage, userKundli, options, 'missing_api_key');
    return sanitizeResponse(fallback);
  }

  const systemInstruction = buildAstroGuruInstruction(userKundli, options);
  const contents = [
    ...(Array.isArray(history) ? history : []),
    { role: "user", parts: [{ text: String(userMessage) }] }
  ];

  let lastError = '';
  const candidateModels = getCandidateModels();
  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
            config: {
            systemInstruction,
            temperature: 0,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1500
          }
        });

        console.log("FULL RESPONSE:", response);
        const text = sanitizeResponse(extractGeminiText(response));
        if (text && hasMinimumQuality(text)) {
          return text;
        }

        if (text) {
          const repaired = await ai.models.generateContent({
            model,
            contents: [
              { role: "user", parts: [{ text: buildRepairPrompt(userMessage, text) }] }
            ],
            config: {
              temperature: 0.2,
              topP: 0.9,
              topK: 40,
              maxOutputTokens: 1600
            }
          });

          console.log("FULL RESPONSE:", repaired);
          const repairedText = sanitizeResponse(extractGeminiText(repaired));
          if (repairedText && hasMinimumQuality(repairedText)) {
            return repairedText;
          }

          lastError = 'short_or_incomplete_response';
        } else {
          lastError = 'empty_response';
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        lastError = messageText;

        const unavailableModel = /not found|unsupported|model/i.test(messageText);
        const transient = /timeout|network|temporar|503|500|resource_exhausted|quota/i.test(messageText);

        if (unavailableModel) {
          break;
        }

        if (transient && attempt < 2) {
          await wait(350 * (attempt + 1));
          continue;
        }

        break;
      }
    }
  }

  const fallback = buildFallbackResponse(
    userMessage,
    userKundli,
    options,
    normalizeErrorMessage(lastError || 'unknown')
  );
  return sanitizeResponse(fallback);
}

export async function getHoroscopeReply(zodiac) {
  if (horoscopeCache.has(zodiac)) {
    return horoscopeCache.get(zodiac);
  }

  const ai = getAi();
  if (!ai) {
    const fallback = defaultHoroscopeText(zodiac);
    horoscopeCache.set(zodiac, fallback);
    return fallback;
  }

  const prompt = `Generate a detailed daily horoscope for the ${zodiac} sign.
Include sections for Career, Love, Health, Finance, and Remedies.
Interpret planetary influences in a realistic Vedic astrology tone.
Provide practical advice and grounded guidance.
Use clear headings and complete paragraphs.
Avoid generic filler and keep the reading specific.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0,
      topP: 1,
      topK: 1
    }
  });

  const text = response.text || defaultHoroscopeText(zodiac);
  horoscopeCache.set(zodiac, text);
  return text;
}

export async function getStructuredReport({ zodiac, period, userKundli }) {
  const cacheKey = stableStringify({ zodiac, period, userKundli: userKundli || null });
  if (reportCache.has(cacheKey)) {
    return reportCache.get(cacheKey);
  }

  const ai = getAi();
  if (!ai) {
    const fallback = defaultStructuredReport(zodiac, period);
    reportCache.set(cacheKey, fallback);
    return fallback;
  }

  const prompt = buildStructuredReportPrompt(zodiac, period, userKundli);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0,
      topP: 1,
      topK: 1
    }
  });

  const text = (response.text || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = defaultStructuredReport(zodiac, period);
  }

  reportCache.set(cacheKey, parsed);
  return parsed;
}
