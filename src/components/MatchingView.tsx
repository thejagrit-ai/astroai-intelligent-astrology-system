import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, User, Users, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { generateKundli, calculateGunaMilan } from '../lib/astrology';
import { auth } from '../lib/firebase';
import { getOrCreateMatchingCache } from '../lib/cache';
import LocationAutocomplete from './LocationAutocomplete';

export default function MatchingView({ profile }: { profile: any }) {
  const [boy, setBoy] = useState({ name: '', dob: '', time: '', place: '' });
  const [girl, setGirl] = useState({ name: '', dob: '', time: '', place: '' });
  const [result, setResult] = useState<any>(null);
  const [matching, setMatching] = useState(false);
  const [statusError, setStatusError] = useState('');

  const handleMatch = async () => {
    if (!boy.dob || !girl.dob) return;

    setMatching(true);
    setStatusError('');
    try {
      const boyKundli = generateKundli(boy.name, boy.dob, boy.time, boy.place);
      const girlKundli = generateKundli(girl.name, girl.dob, girl.time, girl.place);

      const fallback = () => calculateGunaMilan(boyKundli, girlKundli);
      const userId = auth.currentUser?.uid;
      const matchResult = userId
        ? await getOrCreateMatchingCache(
            userId,
            {
              boyName: boy.name,
              boyDob: boy.dob,
              boyTime: boy.time,
              boyPlace: boy.place,
              girlName: girl.name,
              girlDob: girl.dob,
              girlTime: girl.time,
              girlPlace: girl.place,
            },
            fallback,
          )
        : fallback();

      const deepDive = {
        emotionalPattern: matchResult.score > 25
          ? 'Strong emotional synchrony with natural support during stress cycles.'
          : 'Emotional rhythm differs at times; active listening and reassurance improve balance.',
        communicationFriction: matchResult.score > 25
          ? 'Low friction. Most disagreements can be resolved quickly with calm dialogue.'
          : 'Medium friction. Clarify expectations early and avoid reactive language.',
        practicalAdvice: matchResult.score > 25
          ? 'Set shared long-term goals and monthly review rituals to sustain harmony.'
          : 'Use weekly check-ins and role clarity to prevent recurring misunderstandings.',
      };

      setResult({
        ...matchResult,
        deepDive,
        gunaBreakdown: [
          { label: "Varna", score: "1/1", desc: "Spiritual compatibility" },
          { label: "Vasya", score: "2/2", desc: "Mutual attraction" },
          { label: "Tara", score: matchResult.score > 25 ? "3/3" : "1.5/3", desc: "Destiny alignment" },
          { label: "Yoni", score: "4/4", desc: "Physical harmony" },
          { label: "Maitri", score: matchResult.score > 20 ? "5/5" : "3/5", desc: "Friendship level" },
          { label: "Gana", score: "6/6", desc: "Temperament" },
          { label: "Bhakoot", score: "7/7", desc: "Emotional bond" },
          { label: "Nadi", score: "8/8", desc: "Genetic health" },
        ]
      });
    } catch (error) {
      console.error(error);

      const boyKundli = generateKundli(boy.name, boy.dob, boy.time, boy.place);
      const girlKundli = generateKundli(girl.name, girl.dob, girl.time, girl.place);
      const matchResult = calculateGunaMilan(boyKundli, girlKundli);

      const deepDive = {
        emotionalPattern: matchResult.score > 25
          ? 'Strong emotional synchrony with natural support during stress cycles.'
          : 'Emotional rhythm differs at times; active listening and reassurance improve balance.',
        communicationFriction: matchResult.score > 25
          ? 'Low friction. Most disagreements can be resolved quickly with calm dialogue.'
          : 'Medium friction. Clarify expectations early and avoid reactive language.',
        practicalAdvice: matchResult.score > 25
          ? 'Set shared long-term goals and monthly review rituals to sustain harmony.'
          : 'Use weekly check-ins and role clarity to prevent recurring misunderstandings.',
      };

      setResult({
        ...matchResult,
        deepDive,
        gunaBreakdown: [
          { label: "Varna", score: "1/1", desc: "Spiritual compatibility" },
          { label: "Vasya", score: "2/2", desc: "Mutual attraction" },
          { label: "Tara", score: matchResult.score > 25 ? "3/3" : "1.5/3", desc: "Destiny alignment" },
          { label: "Yoni", score: "4/4", desc: "Physical harmony" },
          { label: "Maitri", score: matchResult.score > 20 ? "5/5" : "3/5", desc: "Friendship level" },
          { label: "Gana", score: "6/6", desc: "Temperament" },
          { label: "Bhakoot", score: "7/7", desc: "Emotional bond" },
          { label: "Nadi", score: "8/8", desc: "Genetic health" },
        ]
      });
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto">
      <header className="max-w-2xl">
        <h2 className="text-4xl font-bold tracking-tight italic serif mb-4 underline decoration-indigo-500/30 underline-offset-8">Divine Union (Matching)</h2>
        <p className="text-slate-400 leading-relaxed font-medium">
          Evaluate soul resonance using the ancient 36 Guna system (Vedic Ashtakoot Milan) to guide your union.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-stretch">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10 pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-30 animate-pulse"></div>
            <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-indigo-500/30 flex items-center justify-center relative shadow-2xl">
              <Heart className="text-indigo-400 group-hover:scale-110 transition-transform" fill="currentColor" size={24} />
            </div>
          </div>
        </div>

        <MatchInputCard 
          title="The Groom (Boy)" 
          data={boy} 
          setData={setBoy} 
          color="border-indigo-500/10 focus-within:border-indigo-500/40" 
          icon={<User className="text-indigo-400" size={20} />} 
        />
        <MatchInputCard 
          title="The Bride (Girl)" 
          data={girl} 
          setData={setGirl} 
          color="border-rose-500/10 focus-within:border-rose-500/40" 
          icon={<User className="text-rose-400" size={20} />} 
        />
      </div>

      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          onClick={handleMatch}
          disabled={matching || !boy.name || !girl.name || !boy.dob || !girl.dob}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-16 h-16 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95 flex items-center gap-3 text-lg"
        >
          {matching ? (
            <><Loader2 className="animate-spin" /> Synchronizing Spirits...</>
          ) : (
            <><Sparkles size={22} /> Analyze Compatibility</>
          )}
        </Button>
      </div>

      {statusError && (
        <p className="text-center text-xs text-rose-400">{statusError}</p>
      )}

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto pt-10"
          >
            <Card className="bg-[#0a0a14]/90 border border-slate-800 backdrop-blur-3xl overflow-hidden relative shadow-2xl rounded-3xl">
              <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none"></div>
              <CardHeader className="text-center relative pt-12 pb-6 border-b border-white/5">
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-[0.4em] mb-4">Celestial Accord</p>
                <div className="relative inline-block">
                   <div className="text-8xl font-bold bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent italic serif tracking-tighter">
                    {result.gunaMilan}
                    <span className="text-4xl text-slate-700 ml-2">/ 36</span>
                  </div>
                </div>
                <div className="flex justify-center gap-3 mt-6">
                  <Badge className={`${result.score > 25 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : result.score > 20 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/20 text-rose-400 border-rose-500/20'} px-6 py-2 rounded-xl text-xs font-bold tracking-widest`}>
                    {result.score > 25 ? 'EXCELLENT MATCH' : result.score > 20 ? 'AVERAGE MATCH' : 'CAUTION ADVISED'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-8 pt-10 space-y-10">
                <div className="flex items-center gap-6 bg-slate-950/60 p-8 rounded-3xl border border-white/5 shadow-inner">
                  <div className={`p-5 rounded-2xl ${result.score > 20 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'} shrink-0`}>
                    {result.score > 20 ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg mb-2 italic serif">Sages' Oracle</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">{result.explanation}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {result.gunaBreakdown.map((guna: any) => (
                    <div key={guna.label} className="bg-white/5 p-5 rounded-2xl border border-white/5 text-center group hover:bg-indigo-500/10 transition-all">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest group-hover:text-indigo-400 transition-colors uppercase">{guna.label}</p>
                      <p className="text-xl font-bold text-white italic serif">{guna.score}</p>
                      <p className="text-[9px] text-slate-600 mt-1 font-medium">{guna.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-300 mb-2">Emotional Pattern</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{result.deepDive?.emotionalPattern}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-amber-300 mb-2">Communication Friction</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{result.deepDive?.communicationFriction}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-300 mb-2">Practical Advice</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{result.deepDive?.practicalAdvice}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MatchInputCard({ title, data, setData, color, icon }: any) {
  return (
    <Card className={`bg-[#0a0a14]/60 border-slate-800 backdrop-blur-xl ${color} h-full transition-all group rounded-3xl`}>
      <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-800/50">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 group-hover:text-white transition-colors">{icon}</div>
        <CardTitle className="text-base font-bold text-white tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Name</label>
          <Input 
            value={data.name} 
            onChange={e => setData({...data, name: e.target.value})}
            className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-11 rounded-xl transition-all"
            placeholder="Identity"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Birth Date</label>
            <Input 
              type="date"
              value={data.dob} 
              onChange={e => setData({...data, dob: e.target.value})}
              className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-11 rounded-xl [color-scheme:dark] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Birth Time</label>
            <Input 
              type="time" 
              value={data.time} 
              onChange={e => setData({...data, time: e.target.value})}
              className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-11 rounded-xl [color-scheme:dark] transition-all"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Ancestral Home (Place)</label>
          <LocationAutocomplete 
            value={data.place} 
            onChange={val => setData({...data, place: val})}
            className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-11 rounded-xl transition-all"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function GunaItem({ label, score }: { label: string, score: string }) {
  return (
    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-center hover:bg-indigo-500/5 transition-colors">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">{label}</p>
      <p className="text-sm font-bold text-white italic serif">{score}</p>
    </div>
  );
}
