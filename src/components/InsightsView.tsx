import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Orbit, Sparkles, Timer } from 'lucide-react';
import AstroBackground from './AstroBackground';

const TRANSIT_LABELS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function deriveOffset(seed: string, mod: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % mod;
}

export default function InsightsView({ profile }: { profile: any }) {
  const zodiac = profile?.zodiacSign || 'Aries';
  const dashaSeed = `${profile?.name || 'seeker'}|${profile?.dob || ''}|${profile?.birthTime || ''}`;

  const dashaTimeline = [
    { period: 'Current Mahadasha', value: profile?.kundli?.mahadasha || profile?.mahadasha || 'Rahu', years: 'Now - 2028' },
    { period: 'Next Antardasha', value: profile?.kundli?.antardasha || 'Jupiter', years: '2028 - 2031' },
    { period: 'Upcoming Cycle', value: 'Saturn', years: '2031 - 2036' },
  ];

  const transitCalendar = DAY_LABELS.map((day, index) => ({
    day,
    transit: `${TRANSIT_LABELS[(index + deriveOffset(dashaSeed, TRANSIT_LABELS.length)) % TRANSIT_LABELS.length]} influence`,
    intensity: 55 + ((index + deriveOffset(zodiac, 5)) % 5) * 9,
  }));

  return (
    <div className="relative isolate mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-800/80 bg-[#080812]/85 p-5 sm:p-6 lg:p-8">
      <AstroBackground className="opacity-70" />
      <div className="relative z-10 space-y-6">
        <header className="space-y-2">
          <h2 className="text-3xl font-bold text-white italic serif">Transit Calendar & Dasha Timeline</h2>
          <p className="text-sm text-slate-400">Track your planetary climate and key dasha progression windows for better decisions.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-3xl border-slate-800/70 bg-[#0a0a14]/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Timer size={18} className="text-indigo-400" /> Dasha Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashaTimeline.map((item, idx) => (
                <div key={`${item.period}-${idx}`} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{item.period}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                  <p className="text-xs text-indigo-300">{item.years}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-800/70 bg-[#0a0a14]/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><CalendarDays size={18} className="text-indigo-400" /> Weekly Transit Calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transitCalendar.map((item, idx) => (
                <div key={`${item.day}-${idx}`} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">{item.day}</p>
                    <p className="text-xs text-indigo-300">{item.intensity}% intensity</p>
                  </div>
                  <p className="text-sm text-slate-200">{item.transit}</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${item.intensity}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-indigo-500/20 bg-indigo-500/10">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Orbit size={18} className="text-indigo-300 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Transit Signal for {zodiac}</p>
                <p className="mt-1 text-sm text-slate-200">
                  This week supports practical planning over impulsive moves. Use high-intensity windows for important communication,
                  and keep low-intensity windows for reflection and course correction.
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300 font-bold">
                  <Sparkles size={12} /> Chart generation version: v2 deterministic
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
