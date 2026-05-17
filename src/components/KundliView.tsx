import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Calendar, Clock, MapPin, Search, Info, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateKundli, generateKundliAccurate, KundliData } from '../lib/astrology';
import { auth } from '../lib/firebase';
import { getOrCreateKundliCache } from '../lib/cache';
import { trackFirstTimeEvent } from '../lib/analytics';
import KundliChart from './KundliChart';
import { Badge } from '@/components/ui/badge';
import LocationAutocomplete from './LocationAutocomplete';

export default function KundliView({ profile }: { profile: any }) {
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    dob: profile?.dob || '',
    time: profile?.birthTime || '',
    place: profile?.birthPlace || ''
  });

  const [kundli, setKundli] = useState<KundliData | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [statusError, setStatusError] = useState('');

  const handleGenerate = async () => {
    if (!formData.dob || !formData.time || !formData.place) {
      setStatusError('Please enter date, time, and place for chart generation.');
      return;
    }

    setCalculating(true);
    setStatusError('');
    try {
      const fallback = async () => await generateKundliAccurate(formData.name, formData.dob, formData.time, formData.place);
      const userId = auth.currentUser?.uid;
      const data = userId
        ? await getOrCreateKundliCache(
            userId,
            {
              name: formData.name,
              dob: formData.dob,
              time: formData.time,
              place: formData.place,
            },
            fallback,
          )
        : await fallback();

      setKundli(data);
      if (userId) {
        await trackFirstTimeEvent(userId, 'first_chart_generated', {
          zodiac: profile?.zodiacSign || null,
          usedCloudCache: true,
        });
      }
    } catch (error: any) {
      console.error(error);
      const msg = (error && (error.message || error.toString())) || 'unknown error';
      const isPermission = /permission|insufficient/i.test(msg);
      if (!isPermission) {
        const short = msg.length > 180 ? msg.slice(0, 177) + '...' : msg;
        setStatusError(`Could not read chart cache from cloud: ${short}. Generated chart locally instead.`);
      } else {
        // Hide permission-related errors from the UI to avoid alarming users.
        setStatusError('');
      }
      setKundli(generateKundli(formData.name, formData.dob, formData.time, formData.place));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="max-w-2xl">
        <h2 className="text-4xl font-bold tracking-tight italic serif mb-4 underline decoration-amber-500/30 underline-offset-8">Divine Birth Chart</h2>
        <p className="text-gray-400 leading-relaxed">
          Generate your North Indian style Janam Kundli with precise planetary positions, Bhav reports, and Mahadasha analysis.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-[#121212] border-white/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Search size={18} className="text-amber-500" /> Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Full Name</label>
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Date</label>
                  <Input 
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({...formData, dob: e.target.value})}
                    className="bg-white/5 border-white/10 [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Time</label>
                  <Input 
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="bg-white/5 border-white/10 [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Birth Place</label>
                <LocationAutocomplete 
                  value={formData.place}
                  onChange={val => setFormData({...formData, place: val})}
                  className="bg-white/5 border-white/10"
                />
              </div>

              <Button 
                onClick={handleGenerate}
                disabled={calculating}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 shadow-[0_4px_15px_rgba(245,158,11,0.2)]"
              >
                {calculating ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Sparkles size={18} />
                  </motion.div>
                ) : 'Recalculate Chart'}
              </Button>

              {statusError && (
                <p className="text-xs text-rose-400">{statusError}</p>
              )}
            </CardContent>
          </Card>

          {kundli && (
            <Card className="bg-amber-500/5 border-amber-500/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase font-bold text-amber-500/70 tracking-widest leading-none">Primary Nakshatra</p>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-500">{kundli.nakshatra}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase font-bold text-amber-500/70 tracking-widest">Current Mahadasha</p>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-500">{kundli.mahadasha}</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-8 space-y-8">
          {kundli ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                  <KundliChart houses={kundli.houses} planets={kundli.planets} />
                </motion.div>

                <div className="space-y-6">
                  <Card className="bg-[#121212] border-white/5 h-full">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-widest text-amber-500">Planetary Vitals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {kundli.planets.map((p, idx) => (
                          <div key={`${p.name}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-sm">
                            <span className="font-bold text-white">{p.name}</span>
                            <div className="flex gap-4 text-xs text-gray-400 font-mono">
                              <span>{Math.floor(p.longitude)}° {p.rashi.substring(0,3)}</span>
                              <span className="text-amber-500/70">{p.nakshatra}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 bg-white/5 border-white/10 text-gray-300 hover:text-white">
                      <Info size={16} className="mr-2" /> Explainer
                    </Button>
                  </div>
                </div>
              </div>

              {/* Predictions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PredictionCard title="Personality" content={kundli.predictions.personality} />
                <PredictionCard title="Career" content={kundli.predictions.career} />
                <PredictionCard title="Marriage" content={kundli.predictions.marriage} />
                <PredictionCard title="Health" content={kundli.predictions.health} />
              </div>

              {/* Remedies Section */}
              <Card className="bg-indigo-600/5 border-indigo-500/20">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-3 italic serif">
                    <Zap className="text-indigo-400" size={20} /> Celestial Remedies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {kundli.predictions.remedies.map((r, i) => (
                      <li key={i} className="flex items-start gap-4 text-slate-300 text-sm">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 size={12} className="text-indigo-400" />
                        </div>
                        {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-[400px] rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-gray-600 bg-white/[0.02]">
              <Sparkles size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Adjust details and click regenerate to view your chart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PredictionCard({ title, content }: { title: string, content: string }) {
  return (
    <Card className="bg-slate-900/40 border-slate-800 hover:border-indigo-500/20 transition-all">
      <CardHeader className="pb-2">
        <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">{title}</p>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300 text-sm leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}

function CheckCircle2({ size, className }: { size: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}
