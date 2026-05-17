import { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Video, Star, Award, Clock, MapPin, ChevronRight, Globe, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ASTROLOGERS } from '../constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

export default function AstrologersView() {
  const [selectedAstro, setSelectedAstro] = useState<any>(null);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h2 className="text-4xl font-bold tracking-tight italic serif mb-4 underline decoration-indigo-500/30 underline-offset-8">Divine Connection</h2>
        <p className="text-gray-400 leading-relaxed">
          Connect with verified masters of Vedic science for one-on-one consulting. Our experts provide deep insights into your destiny.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ASTROLOGERS.map((astro, idx) => (
          <motion.div
            key={astro.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="bg-[#121212] border-white/5 hover:border-indigo-500/30 transition-all duration-500 group overflow-hidden">
              <CardContent className="p-6">
                <div className="flex gap-4 items-start mb-6">
                  <div className="relative">
                    <Avatar className="w-20 h-20 rounded-2xl border-2 border-indigo-500/20 shadow-xl">
                      <AvatarImage src={astro.avatar} />
                      <AvatarFallback>{astro.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 right-0 bg-emerald-500 w-4 h-4 rounded-full border-2 border-[#121212] shadow-lg shadow-emerald-500/20 animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">{astro.name}</h3>
                      <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-none text-[10px] font-bold">VERIFIED</Badge>
                    </div>
                    <p className="text-gray-400 text-xs mb-3 flex items-center gap-1 font-medium">
                      <Award size={12} className="text-indigo-500" /> {astro.specialization}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="text-amber-500 fill-amber-500" size={14} />
                        <span className="font-bold text-white">{astro.rating}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                        <Clock size={14} />
                        <span>{astro.experience} Exp</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-indigo-500/20 text-white font-bold h-12 rounded-xl transition-all shadow-lg flex items-center justify-between px-6 group/btn">
                        <span>View Full Profile</span>
                        <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a14] border-slate-800 text-slate-200 sm:max-w-[425px] rounded-3xl overflow-hidden backdrop-blur-3xl">
                      <DialogHeader className="pb-4">
                        <div className="flex items-center gap-4">
                           <Avatar className="w-16 h-16 rounded-2xl border-2 border-indigo-500/30">
                            <AvatarImage src={astro.avatar} />
                            <AvatarFallback>{astro.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <DialogTitle className="text-2xl font-bold text-white italic serif">{astro.name}</DialogTitle>
                            <DialogDescription className="text-indigo-400 font-medium">
                              {astro.specialization}
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>
                      <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Rating</p>
                            <p className="text-lg font-bold text-amber-500">★ {astro.rating}</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Experience</p>
                            <p className="text-lg font-bold text-white">{astro.experience}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Divine Wisdom</h4>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {astro.name} is a renowned master in {astro.specialization}, bridging ancient Vedic rituals with modern life challenges. With over {astro.experience} of dedicated service, they have guided thousands towards celestial harmony.
                          </p>
                        </div>

                        <div className="flex gap-3">
                           <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl">
                             Schedule Session
                           </Button>
                           <Button variant="outline" className="w-12 h-12 rounded-xl p-0 border-slate-800 bg-slate-900/50 hover:bg-slate-800">
                             <MessageCircle size={20} className="text-indigo-400" />
                           </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
