const functions = require("firebase-functions");
const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const chatResponseCache = new Map();
const horoscopeCache = new Map();
const reportCache = new Map();
const requestBuckets = new Map();

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
  const ascendant = (userKundli && userKundli.ascendant) || "Aries";
  const nakshatra = (userKundli && userKundli.nakshatra) || "Ashwini";
  const mahadasha = (userKundli && userKundli.mahadasha) || "Rahu";
  const antardasha = (userKundli && userKundli.antardasha) || "Rahu";

  return `You are Astro Guru, a precise and compassionate Vedic astrologer.
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

function defaultChatText() {
  return "The stars suggest steady progress today. Focus on one priority, communicate clearly, and avoid impulsive reactions in important decisions.";
}

function defaultHoroscopeText(zodiac) {
  return `${zodiac} daily reading: Career improves through disciplined planning, relationships benefit from calm communication, and finances favor cautious choices. A short morning meditation helps your clarity.`;
}

function defaultStructuredReport(zodiac, period) {
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

function apiRateLimiter(req, res, next) {
  const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
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
    res.status(429).json({ error: "Too many requests. Please wait and try again." });
    return;
  }

  current.count += 1;
  requestBuckets.set(key, current);
  next();
}

app.use("/api", apiRateLimiter);

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const { userKundli, history, userMessage, message, options } = req.body || {};
    const resolvedMessage = typeof userMessage === 'string' ? userMessage : message;

    if (!userKundli || !resolvedMessage) {
      res.status(400).json({ error: "Invalid payload for chat request." });
      return;
    }

    const cacheKey = stableStringify({ userKundli, history: Array.isArray(history) ? history : [], userMessage: resolvedMessage, options });
    const cachedText = chatResponseCache.get(cacheKey);
    if (cachedText) {
      res.json({ text: cachedText });
      return;
    }

    if (!apiKey) {
      const fallback = defaultChatText();
      chatResponseCache.set(cacheKey, fallback);
      res.json({ text: fallback });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = buildAstroGuruInstruction(userKundli, options);
    const contents = [
      ...(Array.isArray(history) ? history : []),
      { role: "user", parts: [{ text: String(resolvedMessage) }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
        temperature: 0,
        topP: 1,
        topK: 1,
        maxOutputTokens: 1500
      }
    });

    const text = response.text || defaultChatText();
    chatResponseCache.set(cacheKey, text);
    res.json({ text });
  } catch (error) {
    console.error("/api/chat error:", error);
    res.json({ text: defaultChatText() });
  }
});

app.post("/api/horoscope", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const { zodiac } = req.body || {};

    if (!zodiac) {
      res.status(400).json({ error: "Missing zodiac in request body." });
      return;
    }

    if (horoscopeCache.has(zodiac)) {
      res.json({ text: horoscopeCache.get(zodiac) });
      return;
    }

    if (!apiKey) {
      const fallback = defaultHoroscopeText(zodiac);
      horoscopeCache.set(zodiac, fallback);
      res.json({ text: fallback });
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
        topK: 1
      }
    });

    const text = response.text || defaultHoroscopeText(zodiac);
    horoscopeCache.set(zodiac, text);
    res.json({ text });
  } catch (error) {
    console.error("/api/horoscope error:", error);
    const zodiac = req.body && req.body.zodiac ? String(req.body.zodiac) : "Your";
    res.json({ text: defaultHoroscopeText(zodiac) });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const { zodiac, period, userKundli } = req.body || {};

    if (!zodiac || !period) {
      res.status(400).json({ error: "Missing zodiac or period in request body." });
      return;
    }

    const cacheKey = stableStringify({ zodiac, period, userKundli: userKundli || null });
    if (reportCache.has(cacheKey)) {
      res.json({ report: reportCache.get(cacheKey) });
      return;
    }

    if (!apiKey) {
      const fallback = defaultStructuredReport(String(zodiac), period);
      reportCache.set(cacheKey, fallback);
      res.json({ report: fallback });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildStructuredReportPrompt(String(zodiac), period, userKundli);
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
    } catch (parseError) {
      parsed = defaultStructuredReport(String(zodiac), period);
    }

    reportCache.set(cacheKey, parsed);
    res.json({ report: parsed });
  } catch (error) {
    console.error("/api/reports error:", error);
    const zodiac = req.body && req.body.zodiac ? String(req.body.zodiac) : "Your";
    const period = req.body && req.body.period ? req.body.period : "daily";
    res.json({ report: defaultStructuredReport(zodiac, period) });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "AstroAI API Function" });
});

exports.api = functions.region("asia-southeast1").https.onRequest(app);
