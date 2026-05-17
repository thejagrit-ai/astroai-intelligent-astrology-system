import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { Sparkles, Map, MessageSquare, Heart, Users, Star, ArrowRight, Zap, CheckCircle2, TrendingUp, ShieldCheck, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ASTROLOGERS, ZODIAC_DATA } from '../constants';

// --- Typewriter Component ---
function Typewriter({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(text.substring(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 70);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayText}</span>;
}

// --- Counter Component ---
function Counter({ value, suffix = "" }: { value: number, suffix?: string }) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(null);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 2000;
    let timer: any;

    const animate = () => {
      const step = end / (duration / 16);
      start += step;
      if (start >= end) {
        setCount(end);
        return;
      }
      setCount(Math.floor(start));
      timer = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(timer);
  }, [value]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

// --- StarField Component ---
function StarField() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {[...Array(100)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: Math.random(), scale: Math.random() * 0.5 + 0.5 }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: '2px',
            height: '2px',
            backgroundColor: 'white',
            borderRadius: '50%',
            boxShadow: '0 0 5px white'
          }}
        />
      ))}
    </div>
  );
}

export default function LandingPageView({ onAction }: { onAction: (target: string) => void }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [redirecting, setRedirecting] = useState(false);
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -200]);

  const handleCTA = (target: string) => {
    console.log(`[Astro Guru] CTA Triggered: ${target}`);
    setRedirecting(true);
    // Slight delay for premium feel
    setTimeout(() => {
      onAction(target);
      setRedirecting(false);
    }, 400);
  };

  const features = [
    { icon: Map, title: "AI Kundli Generation", desc: "Instantly generate detailed North Indian birth charts with high-precision mathematical accuracy." },
    { icon: Star, title: "Daily Horoscope", desc: "Get personalized AI-driven Rashi Phal covering Love, Career, and Wealth insights." },
    { icon: Heart, title: "Guna Milan", desc: "Evaluate relationship compatibility using the ancient 36 Guna system with AI context." },
    { icon: MessageSquare, title: "Celestial Chat", desc: "Real-time responses to your destiny queries using our proprietary Vedic AI model." },
    { icon: Zap, title: "Transits & Dasha", desc: "Deep analysis of Mahadasha timelines and current planetary transits for strategic planning." },
    { icon: ShieldCheck, title: "Privacy Guaranteed", desc: "Your birth details and cosmic queries are encrypted and never shared with third parties." },
  ];

  const testimonials = [
    { name: "Siddharth Mehta", role: "Entrepreneur", text: "The planetary analysis was shockingly accurate. It helped me time my business launch perfectly during a favorable Jupiter transit.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=m1" },
    { name: "Priya Sharma", role: "Software Engineer", text: "Easiest Kundli interface I've used. The AI chatbot explains complex concepts like Sade Sati in such simple terms.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=p2" },
    { name: "Rajiv Kapoor", role: "Creative Lead", text: "The Guna Milan feature is very detailed. It doesn't just give a score, it provides a thematic resonance report.", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=r3" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const moveX = (clientX - window.innerWidth / 2) / 50;
    const moveY = (clientY - window.innerHeight / 2) / 50;
    setMousePos({ x: moveX, y: moveY });
  };

  return (
    <div 
      className="min-h-screen bg-[#050510] text-slate-200 overflow-x-hidden selection:bg-indigo-500/30 font-sans"
      onMouseMove={handleMouseMove}
    >
      {/* --- Cosmic Background Layer --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <StarField />
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full mix-blend-screen animate-pulse animation-delay-2000"></div>
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-blue-900/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Floating Zodiac Symbols - Interactive */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Object.values(ZODIAC_DATA).slice(0, 8).map((z, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.1, 1],
              x: mousePos.x * (i + 1) * 0.5,
              y: mousePos.y * (i + 1) * 0.5
            }}
            style={{
              position: 'absolute',
              top: `${(i * 1234) % 100}%`,
              left: `${(i * 5678) % 100}%`,
              filter: `blur(${i % 2 === 0 ? '4px' : '0px'})`
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="text-7xl md:text-8xl select-none text-indigo-500/20"
          >
            {z.icon}
          </motion.div>
        ))}
      </div>

      {/* --- Hero Section --- */}
      <section className="relative min-h-screen flex items-center justify-center p-6 pt-20">
        <div className="container max-w-6xl relative z-10 text-center">
          {redirecting && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-indigo-600/90 backdrop-blur-md px-6 py-3 rounded-full border border-indigo-400/30 flex items-center gap-3 shadow-2xl"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
              <span className="text-white text-sm font-bold uppercase tracking-widest">Consulting the Stars...</span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative inline-block"
          >
            <div className="absolute inset-0 bg-indigo-500 blur-[30px] opacity-20 animate-pulse rounded-full"></div>
            <div className="w-24 h-24 rounded-[2rem] theme-gradient-accent mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.5)] ring-1 ring-white/20 relative z-10">
              <Sparkles className="text-white" size={48} />
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-7xl md:text-9xl font-bold text-white mb-6 tracking-tighter italic serif leading-none"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">Astro Guru</span>
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl md:text-4xl text-indigo-300 font-medium tracking-tight mb-8 h-12"
          >
            <Typewriter text="AI-Powered Astrology. Real Predictions." />
          </motion.div>

          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-slate-400 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto font-light"
          >
            Unlock your cosmic blueprint with the power of artificial intelligence. Master-grade Kundli generation and soulful daily guidance, recalculated in real-time.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Button 
              size="lg" 
              onClick={() => handleCTA('dashboard')}
              className="h-16 px-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              Get Started <ArrowRight className="ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
            <button 
              onClick={() => handleCTA('kundli')}
              className="h-16 px-12 border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white font-bold text-lg rounded-2xl transition-all hover:border-indigo-500/50"
            >
              Generate Kundli
            </button>
            <button 
              onClick={() => handleCTA('chat')}
              className="h-16 px-12 border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white font-bold text-lg rounded-2xl transition-all hover:border-indigo-500/50 ml-0 sm:ml-4"
            >
              Try AI Chat
            </button>
          </motion.div>
        </div>
      </section>

      {/* --- Stats Section --- */}
      <section className="py-20 px-6 relative z-10">
        <div className="container max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center border-y border-white/5 py-16 backdrop-blur-sm bg-white/[0.02] rounded-[3rem]">
            <div className="space-y-2">
              <div className="text-5xl font-bold text-white italic serif">
                <Counter value={50000} suffix="+" />
              </div>
              <p className="text-slate-500 uppercase tracking-[0.2em] text-xs font-bold">Kundlis Generated</p>
            </div>
            <div className="space-y-2 border-x border-white/5">
              <div className="text-5xl font-bold text-indigo-400 italic serif">
                <Counter value={95} suffix="%" />
              </div>
              <p className="text-slate-500 uppercase tracking-[0.2em] text-xs font-bold">Accuracy Rate</p>
            </div>
            <div className="space-y-2">
              <div className="text-5xl font-bold text-white italic serif">
                <Counter value={10000} suffix="+" />
              </div>
              <p className="text-slate-500 uppercase tracking-[0.2em] text-xs font-bold">Active Seekers</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Features Grid --- */}
      <section className="py-32 px-6 relative z-10">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-24">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-6xl font-bold text-white italic serif mb-6 tracking-tight"
            >
              Celestial Capabilities
            </motion.h2>
            <p className="text-slate-500 text-xl font-light">Combining ancient Vedic precision with futuristic intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                onClick={() => handleCTA(f.title.includes('Kundli') ? 'kundli' : f.title.includes('Chat') ? 'chat' : f.title.includes('Guna') ? 'matching' : 'dashboard')}
                className="p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl relative group overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-8 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all">
                  <f.icon size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed font-light">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Astrologers Preview --- */}
      <section className="py-32 px-6 relative z-10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-xl text-left">
              <h2 className="text-4xl font-bold text-white italic serif mb-4 underline decoration-indigo-500/30 underline-offset-8">Divine Connection</h2>
              <p className="text-slate-500 text-lg leading-relaxed">Connect with verified masters of Vedic science for one-on-one consulting.</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => handleCTA('astrologers')}
              className="h-12 px-8 border-slate-700 text-white hover:bg-slate-800 rounded-full uppercase tracking-widest text-[10px] font-bold"
            >
              View All Astrologers
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ASTROLOGERS.slice(0, 3).map((astro, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-indigo-500/20 overflow-hidden">
                    <img src={astro.avatar} alt={astro.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-white">{astro.name}</h4>
                    <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">{astro.specialization}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Experience</span>
                    <span className="text-sm text-white font-medium">{astro.experience}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 text-sm font-bold">★ {astro.rating}</div>
                    <button 
                      onClick={() => handleCTA('astrologers')}
                      className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 hover:text-white transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Interactive Testimonials Carousel --- */}
      <section className="py-32 px-6 relative z-10 overflow-hidden">
        <div className="container max-w-6xl mx-auto text-center">
           <h2 className="text-4xl md:text-6xl font-bold text-white italic serif mb-20 tracking-tight">Whispers of Destiny</h2>
           
           <div className="relative h-[400px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTestimonial}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.9 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="max-w-3xl bg-white/[0.03] border border-white/10 p-12 rounded-[3.5rem] backdrop-blur-2xl relative shadow-2xl"
                >
                  <Sparkles className="absolute -top-10 -right-10 text-indigo-500/20" size={120} />
                  <p className="text-2xl md:text-3xl text-white font-light italic serif mb-10 leading-relaxed">
                    "{testimonials[activeTestimonial].text}"
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <img 
                      src={testimonials[activeTestimonial].avatar} 
                      className="w-16 h-16 rounded-full border-2 border-indigo-500/30 p-1 bg-slate-900" 
                      alt=""
                    />
                    <div>
                      <p className="text-xl font-bold text-white tracking-tight">{testimonials[activeTestimonial].name}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-bold">{testimonials[activeTestimonial].role}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Indicators */}
              <div className="absolute bottom-[-40px] flex gap-3">
                {testimonials.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${activeTestimonial === i ? 'w-10 bg-indigo-500' : 'w-2 bg-white/10'}`}
                  />
                ))}
              </div>
           </div>
        </div>
      </section>

      {/* --- Final CTA --- */}
      <section className="py-48 px-6 relative z-10">
        <div className="container max-w-5xl mx-auto rounded-[4rem] bg-gradient-to-b from-indigo-600/20 to-transparent border border-indigo-500/20 p-20 text-center relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.1),transparent)]"></div>
          <h2 className="text-6xl md:text-8xl font-bold text-white italic serif mb-10 tracking-tighter">Awaken Your Spirit.</h2>
          <p className="text-xl md:text-2xl text-indigo-300 font-light mb-12 max-w-xl mx-auto leading-relaxed">
            Join 10,000+ seekers who have aligned their path with the stars.
          </p>
          <Button 
            size="lg" 
            onClick={() => handleCTA('dashboard')}
            className="h-20 px-20 bg-white text-indigo-950 font-bold text-2xl rounded-full shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-105 transition-all active:scale-95"
          >
            Start Journey
          </Button>
          
          <div className="mt-16 flex flex-wrap items-center justify-center gap-12 opacity-50">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Scalable Insights</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Global Database</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Deluxe Footer --- */}
      <footer className="py-20 border-t border-white/5 px-6 relative z-10 bg-[#050510]">
        <div className="container max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl theme-gradient-accent flex items-center justify-center">
                 <Sparkles className="text-white" size={24} />
               </div>
               <span className="text-2xl font-bold italic serif text-white tracking-tight">Astro Guru</span>
            </div>
            <p className="text-slate-500 font-light max-w-sm leading-relaxed">
              Bridging the ancient science of light with modern neural networks. Deciphering the heavens for the next generation of consciousness.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold uppercase tracking-widest text-xs">Oracle Service</h4>
            <div className="flex flex-col gap-3 text-slate-500 text-sm font-light">
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Daily Rashi</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Deep Kundli</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">AI Consultation</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Matchmaking</span>
            </div>
          </div>
          <div className="space-y-4 text-right">
            <h4 className="text-white font-bold uppercase tracking-widest text-xs">Legal Realm</h4>
            <div className="flex flex-col gap-3 text-slate-500 text-sm font-light">
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy Sanctum</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Cosmic Terms</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Celestial Support</span>
            </div>
          </div>
        </div>
        <div className="container max-w-6xl mx-auto flex justify-between items-center border-t border-white/5 pt-10">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 Celestial Intelligence Systems LLC</p>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 flex items-center justify-center transition-colors cursor-pointer">
              <Globe size={14} className="text-slate-500" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
