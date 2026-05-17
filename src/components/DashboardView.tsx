import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Sun, Moon, TrendingUp, Zap, Heart, Briefcase, Activity, DollarSign, AlertTriangle, Target, Gem, Clock3, Bookmark, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZODIAC_DATA, HOROSCOPE_SECTIONS } from '../constants';
import { generateDailyHoroscopePred, generateStructuredReport, StructuredReport } from '../lib/gemini';
import { auth } from '../lib/firebase';
import { listReadingTimeline, markReadingOutcome, saveReadingTimelineEntry } from '../lib/userFeatures';
import { computeProfileCompleteness } from '../lib/userFeatures';
import AstroBackground from './AstroBackground';

const ZODIAC_ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

const INSIGHT_LIBRARY = [
  'Your initiative is strong today and decisions taken before noon can shape long-term progress.',
  'Emotional clarity improves through structured routines, helping you avoid scattered effort.',
  'A practical step in one pending area unlocks momentum in two other parts of your day.',
  'You are in a growth window where discipline gives better results than speed.',
  'Support from mentors or experienced people can open opportunities if you ask directly.',
  'Your communication carries unusual influence today, so choose timing and words carefully.',
];

const FOCUS_LIBRARY = [
  'Prioritize one high-impact task before checking low-priority messages.',
  'Keep energy stable with small breaks and consistent hydration.',
  'Plan money decisions with a written checklist before committing.',
  'Speak clearly in relationships instead of assuming intentions.',
  'Use the evening for strategy and reflection, not reactive decisions.',
  'Complete unfinished tasks first to free mental space for new opportunities.',
];

const AVOID_LIBRARY = [
  'Avoid overcommitting in the first half of the day.',
  'Avoid impulsive spending driven by mood shifts.',
  'Avoid rushing sensitive conversations without context.',
  'Avoid comparing your progress with others; focus on your timeline.',
  'Avoid skipping rest cycles, as fatigue can affect judgment.',
  'Avoid multitasking during important calls or meetings.',
];

const CAREER_ADVICE = [
  'Take ownership of one visible responsibility. Leadership grows through consistent delivery.',
  'Use concise communication in meetings. Precision helps your authority and trust.',
  'Choose steady progress over dramatic shifts; your momentum is stronger than it looks.',
  'Focus on quality over quantity today. One polished result is more valuable than many partial tasks.',
];

const LOVE_ADVICE = [
  'Listening deeply will improve connection more than giving quick solutions.',
  'Express appreciation in simple words; emotional warmth matters today.',
  'Set soft boundaries where needed and communicate with kindness.',
  'Avoid old patterns and respond to what is present now.',
];

const HEALTH_ADVICE = [
  'A short walk after meals helps both digestion and mood regulation.',
  'Keep sleep timing stable for better emotional balance.',
  'Light stretching can reduce stress accumulation from screen time.',
  'Choose lighter evening food and reduce stimulants late in the day.',
];

const LUCKY_COLORS = ['Indigo', 'Silver', 'Saffron', 'Emerald', 'Sky Blue', 'White', 'Rose', 'Teal', 'Maroon', 'Royal Blue', 'Turquoise', 'Violet'];
const LUCKY_TIMES = ['6:30-7:30 AM', '9:00-10:00 AM', '11:30 AM-12:30 PM', '1:30-2:30 PM', '4:00-5:00 PM', '7:00-8:00 PM'];

function getZodiacIndex(zodiac: string) {
  const index = ZODIAC_ORDER.indexOf(zodiac);
  return index >= 0 ? index : 0;
}

function pickByIndex<T>(items: T[], index: number, offset = 0) {
  return items[(index + offset) % items.length];
}

function getMoonHouseByZodiac(zodiac: string) {
  const houseBySign: Record<string, number> = {
    Aries: 5,
    Taurus: 4,
    Gemini: 3,
    Cancer: 2,
    Leo: 1,
    Virgo: 12,
    Libra: 11,
    Scorpio: 10,
    Sagittarius: 9,
    Capricorn: 8,
    Aquarius: 7,
    Pisces: 6,
  };

  return houseBySign[zodiac] || 9;
}

function getMoonInfluence(house: number) {
  const influence: Record<number, string> = {
    1: 'emotions are amplified and self-expression is stronger; lead with calm confidence',
    2: 'family and finances require mindful speech and practical decision making',
    3: 'communication, networking, and short tasks receive supportive momentum',
    4: 'home comforts and emotional grounding become the foundation of productivity',
    5: 'creativity and romance are active; channel excitement into focused creation',
    6: 'routines, service, and health choices shape the quality of your day',
    7: 'partnerships mirror your inner state, so balance assertiveness with empathy',
    8: 'deep transformation is active; avoid rushed reactions and honor intuition',
    9: 'learning, guidance, and long-term perspective help you make wiser moves',
    10: 'career visibility rises; disciplined actions are noticed quickly',
    11: 'gains, allies, and social circles can support tangible progress',
    12: 'rest, reflection, and closure work are more beneficial than constant activity',
  };

  return influence[house] || influence[9];
}

function buildHoroscopeSnippet(text: string, zodiac: string, insightFallback: string[]) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return insightFallback;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (sentences.length >= 3) {
    return sentences;
  }

  return [
    `${zodiac} energy is active today with subtle support for practical progress.`,
    ...insightFallback,
  ].slice(0, 5);
}

export default function DashboardView({ profile }: { profile: any }) {
  const [horoscope, setHoroscope] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [structuredReport, setStructuredReport] = useState<StructuredReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [savingReading, setSavingReading] = useState(false);
  const [readingTimeline, setReadingTimeline] = useState<any[]>([]);
  const zodiac = profile?.zodiacSign || 'Aries';
  const zodiacInfo = ZODIAC_DATA[zodiac];
  const zodiacIndex = getZodiacIndex(zodiac);
  const confidenceMeta = computeProfileCompleteness(profile || {});

  const dynamicDailyData = useMemo(() => {
    const moonHouse = getMoonHouseByZodiac(zodiac);

    const insightFallback = [
      pickByIndex(INSIGHT_LIBRARY, zodiacIndex, 0),
      pickByIndex(INSIGHT_LIBRARY, zodiacIndex, 2),
      pickByIndex(INSIGHT_LIBRARY, zodiacIndex, 4),
    ];

    return {
      moonHouse,
      moonInfluence: getMoonInfluence(moonHouse),
      insightLines: buildHoroscopeSnippet(horoscope, zodiac, insightFallback),
      focus: pickByIndex(FOCUS_LIBRARY, zodiacIndex, 1),
      avoid: pickByIndex(AVOID_LIBRARY, zodiacIndex, 2),
      luckyColor: pickByIndex(LUCKY_COLORS, zodiacIndex),
      luckyNumber: ((zodiacIndex + 3) * 2) % 9 + 1,
      luckyTime: pickByIndex(LUCKY_TIMES, zodiacIndex, 2),
      careerAdvice: pickByIndex(CAREER_ADVICE, zodiacIndex, 0),
      loveAdvice: pickByIndex(LOVE_ADVICE, zodiacIndex, 1),
      healthAdvice: pickByIndex(HEALTH_ADVICE, zodiacIndex, 2),
    };
  }, [horoscope, zodiac, zodiacIndex]);

  useEffect(() => {
    async function fetchHoroscope() {
      if (!profile?.zodiacSign) return;
      try {
        setLoading(true);
        const cacheKey = `horoscope_${profile.zodiacSign}_${new Date().toDateString()}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          setHoroscope(cached);
          setLoading(false);
          return;
        }

        const text = await generateDailyHoroscopePred(profile.zodiacSign);
        if (text) {
          setHoroscope(text);
          localStorage.setItem(cacheKey, text);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHoroscope();
  }, [profile?.zodiacSign]);

  useEffect(() => {
    async function fetchStructuredReport() {
      try {
        setReportLoading(true);
        const report = await generateStructuredReport(zodiac, reportPeriod, profile?.kundli || null);
        setStructuredReport(report);
      } catch (error) {
        console.error(error);
      } finally {
        setReportLoading(false);
      }
    }

    fetchStructuredReport();
  }, [reportPeriod, zodiac, profile?.kundli]);

  useEffect(() => {
    async function fetchTimeline() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      try {
        const readings = await listReadingTimeline(userId);
        setReadingTimeline(readings);
      } catch (error) {
        console.error(error);
      }
    }

    fetchTimeline();
  }, []);

  const handleSaveReading = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !structuredReport) return;

    try {
      setSavingReading(true);
      await saveReadingTimelineEntry(userId, {
        period: reportPeriod,
        zodiac,
        insight: structuredReport.insight,
        report: structuredReport,
      });

      const readings = await listReadingTimeline(userId);
      setReadingTimeline(readings);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingReading(false);
    }
  };

  const handleOutcomeUpdate = async (readingId: string, cameTrue: boolean) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await markReadingOutcome(userId, readingId, cameTrue);
      const readings = await listReadingTimeline(userId);
      setReadingTimeline(readings);
    } catch (error) {
      console.error(error);
    }
  };

  const predictions = [
    { label: 'Personality', value: profile?.predictions?.personality, icon: Sparkles, color: 'text-indigo-400' },
    { label: 'Career', value: profile?.predictions?.career, icon: Briefcase, color: 'text-blue-400' },
    { label: 'Health', value: profile?.predictions?.health, icon: Activity, color: 'text-emerald-400' },
    { label: 'Marriage', value: profile?.predictions?.marriage, icon: Heart, color: 'text-rose-400' },
  ];

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl space-y-6 overflow-hidden rounded-[28px] border border-slate-800/80 bg-[#080812]/85 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-6 lg:p-8">
      <AstroBackground className="opacity-80" />

      <div className="relative z-10 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
           <h1 className="text-2xl font-bold text-white italic serif sm:text-3xl">Salutations, {profile?.name || 'Seeker'}</h1>
           <p className="text-sm text-slate-400">The cosmos is aligned in your favor today.</p>
        </div>
        <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl">
          <Sparkles className="text-indigo-400" size={18} />
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">{zodiac} Ascendant</span>
        </div>
      </header>

      {/* Main Horoscope Card */}
      <section className="theme-card relative overflow-hidden rounded-[28px] border border-slate-800/70 bg-[#0a0a14]/78 p-5 backdrop-blur-3xl sm:p-6 lg:p-7">
        <div className="absolute -right-10 -top-10 pointer-events-none text-[140px] opacity-10 text-indigo-500 blur-sm sm:text-[180px]">
          {zodiacInfo.icon}
        </div>
        
        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl theme-gradient-accent text-2xl text-white shadow-xl shadow-indigo-500/20 ring-4 ring-indigo-500/10 sm:h-16 sm:w-16 sm:text-3xl">
                {zodiacInfo.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white italic serif sm:text-3xl">{zodiac} Daily Guidance</h2>
                <p className="text-indigo-400 text-sm font-medium flex items-center gap-2">
                  <Moon size={14} /> Transit: Moon in your {zodiac === 'Aries' ? '5th' : '9th'} House
                </p>
              </div>
            </motion.div>
            <Badge variant="outline" className="w-fit bg-emerald-500/10 px-4 py-1 text-emerald-400 border-emerald-500/30 animate-pulse">Positive Energy</Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:gap-8">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-indigo-500/10 via-slate-950/50 to-purple-500/10 p-5 shadow-inner shadow-indigo-500/5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">Today's Insight</p>
                  <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px]">
                    {loading ? 'Syncing' : 'Updated'}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {dynamicDailyData.insightLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-sm leading-relaxed text-slate-200/90">
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="mb-3 flex items-center gap-2 text-indigo-300">
                  <Moon size={16} />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Planetary Influence Summary</p>
                </div>
                <p className="text-sm leading-relaxed text-slate-300">
                  Moon in your {dynamicDailyData.moonHouse}th house means {dynamicDailyData.moonInfluence}.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InfoCard icon={Briefcase} label="Career" value={dynamicDailyData.careerAdvice} iconColor="text-blue-400" />
                <InfoCard icon={Heart} label="Love" value={dynamicDailyData.loveAdvice} iconColor="text-rose-400" />
                <InfoCard icon={Activity} label="Health" value={dynamicDailyData.healthAdvice} iconColor="text-emerald-400" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <InfoCard icon={Target} label="Focus For Today" value={dynamicDailyData.focus} iconColor="text-indigo-400" />
                <InfoCard icon={AlertTriangle} label="Avoid Today" value={dynamicDailyData.avoid} iconColor="text-amber-400" />
              </div>

              <Card className="overflow-hidden rounded-2xl border-indigo-500/25 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-200">
                    <Gem size={16} /> Lucky Elements
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 pt-0">
                  <div className="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Color</p>
                    <p className="mt-1 text-sm font-semibold text-white">{dynamicDailyData.luckyColor}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Number</p>
                    <p className="mt-1 text-sm font-semibold text-white">{dynamicDailyData.luckyNumber}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Time</p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-white">
                      <Clock3 size={12} /> {dynamicDailyData.luckyTime}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {HOROSCOPE_SECTIONS.map((s, idx) => (
                  <div key={s.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/45 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</p>
                      <span className="text-xs font-mono text-white">{75 + (idx * 5)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${75 + (idx * 5)}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className={`h-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-pink-500' : idx === 2 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile-based Insights */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-3xl border-slate-800/70 bg-[#0a0a14]/70">
          <CardHeader className="flex flex-col gap-4 border-b border-white/5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-bold text-white italic serif">Structured Reports</CardTitle>
            <div className="flex gap-2 rounded-full bg-slate-900/60 p-1">
              {(['daily', 'weekly', 'monthly'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setReportPeriod(period)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    reportPeriod === period ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {reportLoading || !structuredReport ? (
              <div className="space-y-3">
                <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
                <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-white/5 animate-pulse" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ReportItem title="Today's Insight" value={structuredReport.insight} />
                <ReportItem title="Focus For Today" value={structuredReport.focus} />
                <ReportItem title="Avoid Today" value={structuredReport.avoid} />
                <ReportItem title="Career" value={structuredReport.career} />
                <ReportItem title="Love" value={structuredReport.love} />
                <ReportItem title="Money" value={structuredReport.money} />
                <ReportItem title="Health" value={structuredReport.health} />
                <ReportItem title="Remedies" value={structuredReport.remedies.join(' | ')} />
              </div>
            )}

            <button
              onClick={handleSaveReading}
              disabled={!structuredReport || savingReading}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <Bookmark size={14} /> {savingReading ? 'Saving...' : 'Save Reading'}
            </button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-800/70 bg-[#0a0a14]/70">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-lg font-bold text-white italic serif">Saved Readings Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-3">
                {readingTimeline.length === 0 && (
                  <p className="text-sm text-slate-500">No saved readings yet. Save one from the report panel.</p>
                )}
                {readingTimeline.map(item => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">{item.period} • {item.zodiac}</p>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{item.cameTrue === true ? 'Came True' : item.cameTrue === false ? 'Not Yet' : 'Pending'}</Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{item.insight}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleOutcomeUpdate(item.id, true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                      >
                        <CheckCircle2 size={12} /> True
                      </button>
                      <button
                        onClick={() => handleOutcomeUpdate(item.id, false)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300"
                      >
                        <XCircle size={12} /> Not Yet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {predictions.map((p, idx) => (
          <motion.div
            key={`${p.label}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="h-full overflow-hidden rounded-3xl border-slate-800/70 bg-[#0a0a14]/65 transition-all group hover:border-indigo-500/50">
              <CardHeader className="flex flex-row items-center gap-4 border-b border-white/5 pb-4">
                <div className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800 ${p.color} transition-all group-hover:scale-110`}>
                  <p.icon size={20} />
                </div>
                <CardTitle className="text-lg font-bold text-white italic serif">{p.label} Insights</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <p className="text-sm text-slate-400 leading-relaxed font-light">
                  {p.value || 'Generate your detailed Kundli to unlock deep insights into your destiny.'}
                </p>
                <p className={`mt-3 text-[10px] uppercase font-bold tracking-widest ${confidenceMeta.confidence === 'high' ? 'text-emerald-400' : confidenceMeta.confidence === 'medium' ? 'text-amber-400' : 'text-rose-400'}`}>
                  Confidence: {confidenceMeta.confidence}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Zap} label="Dynamic Energy" value="High" color="text-yellow-400" />
        <StatCard icon={Moon} label="Lunar Phase" value="Waxing Gibbous" color="text-blue-400" />
        <StatCard icon={TrendingUp} label="Best Period" value="Evening" color="text-emerald-400" />
        <StatCard icon={Sun} label="Dominant Planet" value="Jupiter" color="text-orange-400" />
      </section>
      </div>
    </div>
  );
}

function ReportItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-200">{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, iconColor }: { icon: any; label: string; value: string; iconColor: string }) {
  return (
    <Card className="rounded-2xl border border-slate-800/70 bg-slate-950/45 transition-all hover:border-indigo-500/40 hover:bg-slate-900/70">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon size={14} className={iconColor} />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-200">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition-all group hover:border-indigo-500/30 sm:p-5">
      <div className="absolute -right-4 -bottom-4 text-white/5 group-hover:text-white/10 transition-colors">
        <Icon size={80} />
      </div>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/50 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none">{label}</p>
      <p className="text-lg font-bold text-white mt-1.5">{value}</p>
    </div>
  );
}
