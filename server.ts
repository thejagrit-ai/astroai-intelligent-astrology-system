import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import net from "node:net";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const chatResponseCache = new Map<string, string>();
const horoscopeCache = new Map<string, string>();
const reportCache = new Map<string, unknown>();
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_CHAT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-3-flash-preview',
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildAstroGuruInstruction(userKundli: any, options?: { answerTone?: string; userGoals?: string }) {
  const selectedTone = options?.answerTone || 'detailed';
  const goalsText = options?.userGoals ? `User goals and context memory: ${options.userGoals}` : 'User goals and context memory: Not provided yet.';
  const ascendant = userKundli?.ascendant || 'Aries';
  const nakshatra = userKundli?.nakshatra || 'Ashwini';
  const mahadasha = userKundli?.mahadasha || 'Rahu';
  const antardasha = userKundli?.antardasha || 'Rahu';

  return `${SYSTEM_PROMPT}

You are Astro Guru, a precise and compassionate Vedic astrologer.
The user's birth data: ${JSON.stringify(userKundli)}.
${goalsText}

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

function buildStructuredReportPrompt(zodiac: string, period: 'daily' | 'weekly' | 'monthly', userKundli?: any) {
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

function extractGeminiText(response: any) {
  const primary = typeof response?.text === 'string' ? response.text.trim() : '';
  if (primary) return primary;

  const candidateParts = Array.isArray(response?.candidates)
    ? response.candidates
        .flatMap((candidate: any) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
    : [];

  return candidateParts.join('\n').trim();
}

function sanitizeResponse(text: string) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const lastChar = normalized[normalized.length - 1];
  if (/[\.,!?)]/.test(lastChar)) {
    return normalized;
  }

  return `${normalized}.`;
}

function hasMinimumQuality(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 6) return false;
  if (text.length < 260) return false;

  const uniqueLines = new Set(lines.map((line) => line.toLowerCase()));
  return uniqueLines.size >= 4;
}

function buildRepairPrompt(userMessage: string, partialResponse: string) {
  return [
    SYSTEM_PROMPT,
    'The previous response is incomplete or too short. Rewrite it fully.',
    'Output requirements:',
    '- Minimum 8 lines',
    '- Complete sentences only',
    '- Include Insight, Explanation, Guidance, and 2-3 Remedies',
    '- End with one follow-up question',
    `User question: ${userMessage}`,
    `Incomplete draft: ${partialResponse}`,
  ].join('\n\n');
}

function normalizeMessage(input: unknown) {
  return String(input || '').trim().toLowerCase();
}

function buildIntent(userMessage: string) {
  const query = normalizeMessage(userMessage);

  if (!query) return 'general';
  if (/^hi$|^hello$|^hey$|namaste|good\s+(morning|afternoon|evening)/i.test(query)) return 'greeting';
  if (/career|job|work|business|promotion|interview|salary|startup|profession/i.test(query)) return 'career';
  if (/love|marriage|relationship|partner|spouse|dating|breakup/i.test(query)) return 'love';
  if (/health|stress|sleep|anxiety|illness|fitness|energy/i.test(query)) return 'health';
  if (/money|finance|wealth|income|investment|debt|loan|expense/i.test(query)) return 'money';
  if (/remedy|upay|mantra|gemstone|pooja|donation|fasting|vrat/i.test(query)) return 'remedies';
  if (/personality|nature|strength|weakness|traits|behavior/i.test(query)) return 'personality';
  if (/transit|gochar|dasha|antardasha|timeline|next\s*(month|week|30|90)/i.test(query)) return 'timeline';
  return 'general';
}

function deterministicPick(list: string[], seedInput: string) {
  const raw = String(seedInput || 'fallback');
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  const pick = Math.abs(hash) % list.length;
  return list[pick];
}

function buildFallbackResponse(message: string, userKundli: any, options: any, reason: string) {
  const name = userKundli?.name || userKundli?.fullName || 'seeker';
  const ascendant = userKundli?.ascendant || userKundli?.zodiacSign || 'Aries';
  const nakshatra = userKundli?.nakshatra || 'Ashwini';
  const mahadasha = userKundli?.mahadasha || 'Rahu';
  const antardasha = userKundli?.antardasha || 'Rahu';
  const tone = options?.answerTone || 'detailed';
  const intent = buildIntent(message);

  const fallbackByIntent: Record<string, string[]> = {
    greeting: [
      `Namaste ${name}. I am with you. Your ${ascendant} ascendant shows initiative, and ${mahadasha}-${antardasha} supports focused action over scattered effort.`,
      `Pranam ${name}. I can already see a strong ${nakshatra} influence in your chart pattern. Ask me career, relationship, health, or remedies and I will guide precisely.`,
      `Blessings ${name}. Your chart currently reflects movement through ${mahadasha}-${antardasha}. Start with your top concern, and I will give a chart-based step-by-step reading.`,
    ],
    career: [
      `Career Insight: With ${ascendant} rising and ${mahadasha}-${antardasha}, your progress comes through disciplined execution and visible communication.\n\nWhy this is happening: This combination amplifies ambition, but results improve when planning and consistency are stronger than speed.\n\nWhat to do now: Build one 30-day priority plan, send weekly updates to mentors/managers, and avoid changing direction too quickly.\n\nRemedies: Chant Om Gam Ganapataye Namah 108 times on Wednesdays, donate green moong on Wednesdays, and start work during a fixed morning hour daily.`,
      `Career Outlook: Your karma sector is active, favoring practical growth rather than dramatic jumps.\n\nWhy this is happening: ${nakshatra} influence rewards skill refinement and sustained effort.\n\nWhat to do now: Focus on one high-value skill, keep a work journal, and defer risky switches until momentum is stable.\n\nRemedies: Offer water to Surya at sunrise, keep Saturdays light and disciplined, and perform one act of service weekly.`,
    ],
    love: [
      `Love Insight: Your relationship axis is sensitive now, bringing deep emotions and lessons in clarity.\n\nWhy this is happening: ${mahadasha}-${antardasha} can intensify expectations, while ${ascendant} energy prefers fast decisions.\n\nWhat to do now: Speak clearly, pace commitment decisions, and check assumptions before reacting.\n\nRemedies: Chant Om Shukraya Namah on Fridays, wear clean light colors on Fridays, and practice one calm listening ritual each evening.`,
      `Relationship Reading: This phase supports healing and stability if communication stays grounded.\n\nWhy this is happening: ${nakshatra} pattern shows emotional depth with occasional overthinking.\n\nWhat to do now: Set shared weekly check-ins, reduce reactive messaging, and prioritize trust-building actions.\n\nRemedies: Offer white sweets on Fridays, keep a gratitude note for your partner, and avoid major decisions during emotional spikes.`,
    ],
    health: [
      `Health Insight: Your chart suggests stress regulation is the primary key right now.\n\nWhy this is happening: ${mahadasha}-${antardasha} can disturb rhythm if sleep and food timing become irregular.\n\nWhat to do now: Fix sleep-wake timing, add 20 minutes of daily walking, and reduce late-night screen stimulation.\n\nRemedies: Chant Maha Mrityunjaya Mantra 11 times daily, hydrate on a fixed schedule, and keep evening meals lighter.`,
      `Vitality Reading: Energy is available, but consistency determines outcomes.\n\nWhy this is happening: ${ascendant} gives drive, while ${nakshatra} may increase mental load when routines are weak.\n\nWhat to do now: Follow a 7-day routine reset with sleep, hydration, and breathing practice.\n\nRemedies: 5 minutes pranayama morning and evening, avoid skipped meals, and offer water to the Sun at sunrise.`,
    ],
    money: [
      `Money Insight: Financial stability is favored through structure, not impulsive bets.\n\nWhy this is happening: Current dasha flow supports accumulation through disciplined choices.\n\nWhat to do now: Use a 50-30-20 framework, avoid emotional spending, and review expenses weekly.\n\nRemedies: Donate food on Saturdays, keep one savings transfer automated, and avoid new debt without a repayment map.`,
      `Wealth Reading: A gradual but durable growth phase is active.\n\nWhy this is happening: ${ascendant} drive can increase earnings, but risk-control must stay strong.\n\nWhat to do now: Prioritize emergency fund expansion and steady investments over speculative moves.\n\nRemedies: Offer mustard oil at Shani temple on Saturdays and maintain strict budget discipline for 40 days.`,
    ],
    remedies: [
      `Targeted Remedies for your current chart window:\n1. Chant Om Namah Shivaya (108 repetitions) daily.\n2. Offer water to Surya at sunrise on Sundays.\n3. Donate black sesame or food on Saturdays.\n4. Keep one discipline vow for 21 days (speech, sleep, or spending).\n\nThese stabilize Rahu-style fluctuations and improve decision clarity.`,
      `Practical Upay Plan:\n1. Maha Mrityunjaya Mantra (11 times) for mental steadiness.\n2. Friday Venus remedy: offer white flowers/sweets.\n3. Wednesday Mercury remedy: donate green moong.\n4. Daily 10-minute silence after sunset.\n\nFollow for 21 days, then reassess outcomes.`,
    ],
    personality: [
      `Personality Insight: ${ascendant} rising gives initiative, courage, and independent thinking. ${nakshatra} adds sensitivity and depth.\n\nGrowth edge: You do best when speed is balanced with reflection.\n\nActionable focus: Keep a weekly review of decisions, communication, and energy leaks to convert intensity into clarity.`,
      `Core Traits Reading: Your chart pattern shows leadership potential, intuitive pattern recognition, and high inner drive.\n\nChallenge pattern: Occasional overcommitment and impatience under pressure.\n\nImprovement path: Set fewer priorities, finish deeply, and protect recovery windows.`,
    ],
    timeline: [
      `Near-Term Timeline: Next 30 days favor structured actions, communication cleanup, and disciplined routines.\n\nWeek 1: organize priorities and pending decisions.\nWeek 2: relationship and communication alignment.\nWeek 3: career visibility and output consistency.\nWeek 4: financial pruning and energy reset.\n\nKey advice: choose consistency over intensity for best outcomes.`,
      `Transit-Oriented Guidance: Your current dasha rhythm supports correction and consolidation before expansion.\n\nNext 4 weeks: improve systems, reduce reactive decisions, and close old loops.\n\nBest window: after your routines stabilize, then take strategic growth steps.`,
    ],
    general: [
      `Core Reading: Your chart currently favors grounded progress through disciplined daily action.\n\nWhy this is happening: ${mahadasha}-${antardasha} can create high ambition with mental noise if routine is weak.\n\nWhat to do now: simplify priorities, keep communication clear, and follow one daily spiritual anchor.\n\nRemedies: Om Namah Shivaya, sunrise water offering, and weekly donation discipline.`,
      `General Insight: This phase is about alignment, not speed. You gain most by reducing distraction and acting with consistency.\n\nChart factors: ${ascendant}, ${nakshatra}, and ${mahadasha}-${antardasha} indicate strong outcomes when focus and routine are non-negotiable.\n\nPractical next step: share your top concern (career/love/health/money) for a tighter reading.`,
    ],
  };

  const chosen = deterministicPick(
    fallbackByIntent[intent] || fallbackByIntent.general,
    `${message}|${ascendant}|${nakshatra}|${mahadasha}|${antardasha}`
  );

  const compact = tone === 'concise';
  // Do not reveal internal service/error reasons to end users.
  const suffix = '';

  if (compact) {
    return `${chosen.split('\n\n')[0]}\n\nAsk one specific question for a sharper chart-based answer.${suffix}`;
  }

  return `${chosen}\n\nWould you like a deeper chart breakdown for your next 30 days?${suffix}`;
}

function normalizeErrorMessage(message: string) {
  const lowered = String(message || '').toLowerCase();
  if (lowered.includes('quota') || lowered.includes('rate') || lowered.includes('resource_exhausted')) return 'quota limit';
  if (lowered.includes('api key') || lowered.includes('permission_denied') || lowered.includes('unauthorized')) return 'authorization issue';
  if (lowered.includes('model') || lowered.includes('not found') || lowered.includes('unsupported')) return 'model unavailable';
  if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('timeout')) return 'network issue';
  return 'service issue';
}

function getCandidateModels() {
  const configured = String(process.env.GEMINI_MODEL || '').trim();
  if (!configured) {
    return DEFAULT_CHAT_MODELS;
  }

  if (DEFAULT_CHAT_MODELS.includes(configured)) {
    return [configured, ...DEFAULT_CHAT_MODELS.filter((model) => model !== configured)];
  }

  return [configured, ...DEFAULT_CHAT_MODELS];
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function apiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 60;

  const current = requestBuckets.get(key);
  if (!current || now > current.resetAt) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (current.count >= maxRequests) {
    res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    return;
  }

  current.count += 1;
  requestBuckets.set(key, current);
  next();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT || 3000);
  const preferredHmrPort = Number(process.env.HMR_PORT || 24678);
  const PORT = await findAvailablePort(preferredPort);
  const hmrPort = await findAvailablePort(preferredHmrPort);

  app.use(express.json());
  app.use('/api', apiRateLimiter);

  app.post("/api/chat", async (req, res) => {
    try {
      const { userKundli, history, userMessage, message, options } = req.body || {};
      const resolvedMessage = typeof userMessage === 'string' ? userMessage : message;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const fallback = buildFallbackResponse(String(resolvedMessage || ''), userKundli, options, 'missing_api_key');
        res.json({ text: fallback, reply: fallback });
        return;
      }

      if (!userKundli || !resolvedMessage) {
        res.status(400).json({ error: "Invalid payload for chat request." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = buildAstroGuruInstruction(userKundli, options);

      const contents = [
        ...(Array.isArray(history) ? history : []),
        { role: "user", parts: [{ text: String(resolvedMessage) }] },
      ];

      let text = '';
      let lastError = '';
      const models = getCandidateModels();

      for (const model of models) {
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
                maxOutputTokens: 1500,
              },
            });

            console.log('FULL RESPONSE:', response);
            const candidate = sanitizeResponse(extractGeminiText(response));
            if (candidate && hasMinimumQuality(candidate)) {
              text = candidate;
              break;
            }

            if (candidate) {
              const repaired = await ai.models.generateContent({
                model,
                contents: [
                  { role: 'user', parts: [{ text: buildRepairPrompt(String(resolvedMessage), candidate) }] }
                ],
                config: {
                  temperature: 0.2,
                  topP: 0.9,
                  topK: 40,
                  maxOutputTokens: 1600,
                },
              });

              console.log('FULL RESPONSE:', repaired);
              const repairedText = sanitizeResponse(extractGeminiText(repaired));
              if (repairedText && hasMinimumQuality(repairedText)) {
                text = repairedText;
                break;
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

        if (text) break;
      }

      if (!text) {
        text = sanitizeResponse(
          buildFallbackResponse(String(resolvedMessage || ''), userKundli, options, normalizeErrorMessage(lastError || 'unknown'))
        );
      }

      res.json({ text, reply: text });
    } catch (error) {
      console.error("/api/chat error:", error);
      const { userKundli, userMessage, message, options } = req.body || {};
      const resolvedMessage = typeof userMessage === 'string' ? userMessage : message;
      const fallback = buildFallbackResponse(
        String(resolvedMessage || ''),
        userKundli,
        options,
        normalizeErrorMessage(error instanceof Error ? error.message : String(error))
      );
      res.json({ text: fallback, reply: fallback });
    }
  });

  app.post('/api/reports', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY is missing in environment.' });
        return;
      }

      const { zodiac, period, userKundli } = req.body || {};
      if (!zodiac || !period) {
        res.status(400).json({ error: 'Missing zodiac or period in request body.' });
        return;
      }

      const cacheKey = stableStringify({ zodiac, period, userKundli: userKundli || null });
      if (reportCache.has(cacheKey)) {
        res.json({ report: reportCache.get(cacheKey) });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildStructuredReportPrompt(String(zodiac), period, userKundli);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
          topP: 1,
          topK: 1,
        },
      });

      const text = (response.text || '').trim();
      const parsed = JSON.parse(text);
      reportCache.set(cacheKey, parsed);
      res.json({ report: parsed });
    } catch (error) {
      console.error('/api/reports error:', error);
      res.status(500).json({ error: 'Failed to generate structured report.' });
    }
  });

  app.post("/api/horoscope", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY is missing in environment." });
        return;
      }

      const { zodiac } = req.body || {};
      if (!zodiac) {
        res.status(400).json({ error: "Missing zodiac in request body." });
        return;
      }

      if (horoscopeCache.has(zodiac)) {
        res.json({ text: horoscopeCache.get(zodiac) });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
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
          topK: 1,
        },
      });

      const text = response.text || "The stars are quiet right now. Please try again shortly.";
      horoscopeCache.set(zodiac, text);
      res.json({ text });
    } catch (error) {
      console.error("/api/horoscope error:", error);
      res.status(500).json({ error: "Failed to generate horoscope." });
    }
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "AstroAI Backend" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { port: hmrPort, clientPort: hmrPort, host: 'localhost' },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AstroAI Server running on http://localhost:${PORT}`);
    if (PORT !== preferredPort) {
      console.log(`Preferred port ${preferredPort} was busy, using ${PORT} instead.`);
    }
    if (hmrPort !== preferredHmrPort) {
      console.log(`Preferred HMR port ${preferredHmrPort} was busy, using ${hmrPort} instead.`);
    }
  });
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const tryPort = (port: number) => {
      const tester = net.createServer();

      tester.once("error", () => {
        tester.close();
        tryPort(port + 1);
      });

      tester.once("listening", () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port, "0.0.0.0");
    };

    tryPort(startPort);
  });
}

startServer();
