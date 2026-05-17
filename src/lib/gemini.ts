export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export interface ChatResponseOptions {
  answerTone?: 'concise' | 'detailed' | 'spiritual' | 'practical';
  userGoals?: string;
}

export interface StructuredReport {
  insight: string;
  focus: string;
  avoid: string;
  career: string;
  love: string;
  money: string;
  health: string;
  remedies: string[];
}

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

function normalizeGeminiErrorMessage(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes('api key not valid') || lowered.includes('permission_denied')) {
    return 'Gemini API key is invalid or not authorized for this project.';
  }

  if (lowered.includes('quota') || lowered.includes('rate limit') || lowered.includes('resource_exhausted')) {
    return 'Gemini quota limit reached. Please try again later.';
  }

  if (lowered.includes('not found') || lowered.includes('model')) {
    return 'Configured Gemini model is unavailable.';
  }

  if (lowered.includes('fetch') || lowered.includes('network')) {
    return 'Network error while contacting Gemini API.';
  }

  return message || 'Something went wrong. Please try again.';
}

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
];

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function extractGeminiTextFromPayload(data: any) {
  const candidateParts = Array.isArray(data?.candidates)
    ? data.candidates
        .flatMap((candidate: any) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
    : [];

  return candidateParts.join('\n').trim();
}

function sanitizeResponse(text: string) {
  const trimmed = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';

  const lastChar = trimmed[trimmed.length - 1];
  const completed = /[\.,!?)]/.test(lastChar) ? trimmed : `${trimmed}.`;
  return completed;
}

function hasMinimumQuality(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 6) return false;
  if (text.length < 260) return false;

  const uniqueLines = new Set(lines.map(line => line.toLowerCase()));
  if (uniqueLines.size < 4) return false;

  return true;
}

function buildRepairPrompt(originalQuestion: string, partialResponse: string) {
  return [
    SYSTEM_PROMPT,
    'The previous response is incomplete or too short. Rewrite it fully.',
    'Output requirements:',
    '- Minimum 8 lines',
    '- Complete sentences only',
    '- Include Insight, Explanation, Guidance, and 2-3 Remedies',
    '- End with one follow-up question',
    `User question: ${originalQuestion}`,
    `Incomplete draft: ${partialResponse}`,
  ].join('\n\n');
}

function pickDeterministic<T>(items: T[], seed: string) {
  let hash = 0;
  const source = String(seed || 'seed');
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return items[Math.abs(hash) % items.length];
}

function getCandidateModels() {
  const configured = (import.meta.env.VITE_GEMINI_MODEL || '').trim();
  if (!configured) {
    return DEFAULT_GEMINI_MODELS;
  }

  if (DEFAULT_GEMINI_MODELS.includes(configured)) {
    return [configured, ...DEFAULT_GEMINI_MODELS.filter(model => model !== configured)];
  }

  return [configured, ...DEFAULT_GEMINI_MODELS];
}

function buildLocalAstrologerFallback(message: string, context: { userKundli?: any; options?: ChatResponseOptions }, reason?: string) {
  const seekerName = context?.userKundli?.name || context?.userKundli?.fullName || 'seeker';
  const ascendant = context?.userKundli?.ascendant || context?.userKundli?.zodiacSign || 'Aries';
  const nakshatra = context?.userKundli?.nakshatra || 'Ashwini';
  const mahadasha = context?.userKundli?.mahadasha || 'Rahu';
  const antardasha = context?.userKundli?.antardasha || 'Rahu';

  const query = message.toLowerCase();
  const isCareer = /career|job|work|business|profession/.test(query);
  const isLove = /love|marriage|relationship|partner/.test(query);
  const isHealth = /health|stress|sleep|anxiety|body/.test(query);

  const openers = [
    `Pranam ${seekerName}, thank you for this question. I am reading your chart signal for: "${message}".`,
    `Namaste ${seekerName}. I have mapped your current planetary pattern for your query: "${message}".`,
    `My dear ${seekerName}, your question "${message}" is important. Here is a focused chart-based reading.`,
  ];

  let coreInsight = `Your current chart pattern shows strong karmic movement through ${mahadasha}-${antardasha}, with ${ascendant} rising energy making this a phase of decisive action and inner correction.`;
  let explanation = `This happens because Rahu-type periods amplify ambition and uncertainty together, while your ${nakshatra} signature pushes quick decisions; this often activates pressure in the 10th house (career), 7th house (relationships), and 6th house (health routine).`;
  let guidance = 'Stay disciplined with one clear priority for the next 21 days, avoid overcommitting, and maintain a steady daily rhythm so planetary intensity converts into progress.';

  if (isCareer) {
    coreInsight = `In your professional path, ${ascendant} influence with ${mahadasha}-${antardasha} indicates opportunity through bold initiatives, but results improve only when communication and planning are precise.`;
    explanation = `Astrologically, this reflects activation of Mercury-Saturn style themes: skill refinement, structure, and accountability, especially around the 10th house of karma and recognition.`;
    guidance = 'Focus on one high-impact skill, document your work weekly, and avoid sudden role switches until momentum stabilizes.';
  } else if (isLove) {
    coreInsight = `In relationships, this phase brings deep emotional lessons: attraction is strong, but clarity and consistency are more important than intensity right now.`;
    explanation = `This reflects 7th-house sensitivity with Rahu-type fluctuations; expectations can run ahead of emotional grounding if Moon-Venus balance is weak.`;
    guidance = 'Communicate calmly, set practical expectations, and give relationships time to mature before major commitments.';
  } else if (isHealth) {
    coreInsight = `For health, your chart indicates that stress regulation is the key remedy; energy is high but nervous-system balance needs conscious discipline.`;
    explanation = `Astrologically, 6th-house activation during ${mahadasha}-${antardasha} can manifest as irregular sleep, scattered focus, or digestive strain if routine is unstable.`;
    guidance = 'Stabilize sleep timing, reduce screen stimulation late evening, and keep a consistent food and movement schedule.';
  }

  const diagnostics = reason ? `\n\nNote: live AI channel was briefly unavailable (${reason}).` : '';

  return [
    pickDeterministic(openers, `${message}|${ascendant}|${nakshatra}`),
    `Core Insight: ${coreInsight}`,
    `Explanation: ${explanation}`,
    `Practical Guidance: ${guidance}`,
    'Remedies: 1) Chant "Om Namah Shivaya" for 108 repetitions daily, 2) Offer water to the Sun at sunrise on Sundays, 3) Keep a Saturday discipline of donation (black sesame or food), 4) Practice one act of conscious patience before reacting in conflict.',
    'Would you like me to analyze your next 30-day transit window in detail, or should I give focused remedies only for your current top concern?',
  ].join('\n\n') + diagnostics;
}

function buildPrompt(message: string, context?: { userKundli?: any; history?: ChatMessage[]; options?: ChatResponseOptions }) {
  const chartContext = context?.userKundli ? JSON.stringify(context.userKundli) : '{}';
  const historyContext = Array.isArray(context?.history)
    ? context!.history!.map(entry => `${entry.role}: ${entry.parts?.[0]?.text || ''}`).join('\n')
    : '';
  const answerTone = context?.options?.answerTone || 'detailed';
  const userGoals = context?.options?.userGoals || '';
  const seekerName = context?.userKundli?.name || context?.userKundli?.fullName || '';

  return [
    SYSTEM_PROMPT,
    'You are Astro Guru, a highly experienced Vedic astrologer with deep expertise in kundli analysis, graha influences, houses, doshas, transits, and remedies.',
    'Response style rules:',
    '- Use a calm, wise, slightly spiritual human tone.',
    '- Address the user as "seeker" or by name if available.',
    '- Avoid robotic phrasing, repeated sentences, and generic filler.',
    '- Keep each answer meaningful, specific, and practical.',
    'Output structure (always follow in this order):',
    '1) Greeting (1 line)',
    '2) Core Insight (clear astrological reading)',
    '3) Explanation (why this is happening astrologically)',
    '4) Practical Guidance (what to do now)',
    '5) Remedies (2-4 specific remedies: mantra, gemstone, fasting, behavior)',
    '6) Follow-up Question (ask 1-2 intelligent next-step questions)',
    'Content quality rules:',
    '- Minimum 6-10 lines.',
    '- Mention relevant planets and houses when chart context is available.',
    '- Explain likely effects on career, love, and health where relevant.',
    '- Use specific astrological reasoning, not vague positivity statements.',
    '- Continue logically from prior conversation context.',
    '- Do not say you are an AI; speak as a real astrologer.',
    '- Never end on a trailing comma or broken sentence.',
    seekerName ? `Seeker name: ${seekerName}` : 'Seeker name: not provided.',
    `User chart context: ${chartContext}`,
    historyContext ? `Conversation history:\n${historyContext}` : '',
    userGoals ? `User goals: ${userGoals}` : '',
    `Tone preference: ${answerTone}`,
    'Give detailed, human-like astrologer guidance using the required structure.',
    `User message: ${message}`,
  ].filter(Boolean).join('\n\n');
}

export async function fetchAIResponse(message: string, context: { userKundli?: any; history?: ChatMessage[]; options?: ChatResponseOptions } = {}) {
  const { userKundli, history = [], options } = context;
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const prompt = buildPrompt(message, { userKundli, history, options });
  let lastError = 'Gemini request failed';

  // Layer 1: backend endpoint (server key)
  try {
    const backendResponse = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userMessage: message, userKundli, history, options }),
    }, 20000);
    const backendData = await backendResponse.json().catch(() => ({}));
    console.log('FULL RESPONSE:', backendData);
    const backendText = sanitizeResponse((backendData?.reply || backendData?.text || '').toString());
    if (backendResponse.ok && backendText && hasMinimumQuality(backendText)) {
      return backendText;
    }
    lastError = String(backendData?.error || 'Backend chat response incomplete');
  } catch (error) {
    console.error('Backend /api/chat failed:', error);
    lastError = error instanceof Error ? error.message : String(error);
  }

  // Layer 2: direct browser Gemini (VITE key)
  if (apiKey) {
    const candidateModels = getCandidateModels();
    for (const model of candidateModels) {
      try {
        let handled = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: prompt }],
                  },
                ],
              }),
            },
            25000
          );

          const data = await response.json().catch(() => ({}));
          console.log('FULL RESPONSE:', data);

          if (!response.ok) {
            const rawMessage = String(data?.error?.message || 'Gemini request failed');
            lastError = rawMessage;

            const isModelUnavailable = /not found|model|unsupported/i.test(rawMessage);
            if (isModelUnavailable) {
              handled = true;
              break;
            }

            const isTransientServerError = response.status >= 500;
            if (isTransientServerError && attempt < 2) {
              await wait(400 * (attempt + 1));
              continue;
            }

            handled = true;
            break;
          }

          const text = sanitizeResponse(extractGeminiTextFromPayload(data));
          if (text && hasMinimumQuality(text)) {
            return text;
          }

          if (text) {
            const repairResponse = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [{ text: buildRepairPrompt(message, text) }],
                    },
                  ],
                }),
              },
              25000
            );

            const repairData = await repairResponse.json().catch(() => ({}));
            console.log('FULL RESPONSE:', repairData);
            const repairedText = sanitizeResponse(extractGeminiTextFromPayload(repairData));
            if (repairResponse.ok && repairedText && hasMinimumQuality(repairedText)) {
              return repairedText;
            }

            lastError = 'Gemini returned short/incomplete response.';
            handled = true;
            break;
          }

          lastError = 'Gemini returned an empty response.';
          handled = true;
          break;
        }

        if (handled) {
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  } else {
    lastError = 'Missing VITE_GEMINI_API_KEY in environment.';
  }

  // Layer 3: local astrologer fallback (never fail)
  const fallback = buildLocalAstrologerFallback(message, { userKundli, options }, normalizeGeminiErrorMessage(lastError));
  return sanitizeResponse(fallback);
}

export async function generateAstrologyResponse(userKundli: any, history: ChatMessage[], userMessage: string, options?: ChatResponseOptions) {
  return fetchAIResponse(userMessage, { userKundli, history, options });
}

export async function getAstrologyContextResponse(userKundli: any, history: ChatMessage[], userMessage: string, options?: ChatResponseOptions) {
  return fetchAIResponse(userMessage, { userKundli, history, options });
}

export async function generateDailyHoroscopePred(zodiac: string) {
  const response = await fetch('/api/horoscope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zodiac }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Horoscope request failed');
  }

  const payload = await response.json();
  return payload?.text || '';
}

function defaultStructuredReport(zodiac: string, period: 'daily' | 'weekly' | 'monthly'): StructuredReport {
  return {
    insight: `${zodiac} ${period} reading shows steady progress with best outcomes through disciplined action and emotional balance.`,
    focus: 'Prioritize one meaningful goal and complete it with full attention before taking on new tasks.',
    avoid: 'Avoid impulsive reactions, overcommitting time, and making financial decisions under emotional pressure.',
    career: 'Career momentum builds through consistency. Document your work and communicate clearly with seniors and collaborators.',
    love: 'Relationships improve with calm listening and practical affection. Keep expectations clear and communication gentle.',
    money: 'Use a structured plan for expenses and savings. Small disciplined decisions compound into stability.',
    health: 'Sleep rhythm, hydration, and light exercise are your key support pillars in this cycle.',
    remedies: [
      'Chant a grounding mantra for 11 minutes in the morning.',
      'Offer water to the Sun on Sundays and maintain a gratitude journal.',
      'Donate food or essentials once this week to balance karmic flow.',
    ],
  };
}

export async function generateStructuredReport(
  zodiac: string,
  period: 'daily' | 'weekly' | 'monthly',
  userKundli?: any,
): Promise<StructuredReport> {
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zodiac, period, userKundli }),
  });

  if (!response.ok) {
    return defaultStructuredReport(zodiac, period);
  }

  const payload = await response.json().catch(() => null);
  const report = payload?.report;
  if (!report) {
    return defaultStructuredReport(zodiac, period);
  }

  return {
    insight: report.insight || defaultStructuredReport(zodiac, period).insight,
    focus: report.focus || defaultStructuredReport(zodiac, period).focus,
    avoid: report.avoid || defaultStructuredReport(zodiac, period).avoid,
    career: report.career || defaultStructuredReport(zodiac, period).career,
    love: report.love || defaultStructuredReport(zodiac, period).love,
    money: report.money || defaultStructuredReport(zodiac, period).money,
    health: report.health || defaultStructuredReport(zodiac, period).health,
    remedies: Array.isArray(report.remedies) && report.remedies.length > 0 ? report.remedies : defaultStructuredReport(zodiac, period).remedies,
  };
}
