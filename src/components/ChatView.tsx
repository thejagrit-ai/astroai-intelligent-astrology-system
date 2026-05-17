import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Send, Sparkles, User, Bot, Loader2, Trash2, ArrowRight } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { fetchAIResponse as requestAIResponse, ChatMessage } from '../lib/gemini';
import { generateKundli } from '../lib/astrology';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AstroBackground from './AstroBackground';
import { trackFirstTimeEvent } from '../lib/analytics';

const SUGGESTIONS = [
  "What does my career look like?",
  "Tell me about my personality traits",
  "Any health advice for me?",
  "Which planets are strongest in my chart?",
  "Suggest some remedies for peace of mind"
];

export default function ChatView({ profile }: { profile: any }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: any;
    clientMessageId?: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusError, setStatusError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const currentUserId = auth.currentUser?.uid || profile?.uid || null;
  const DEMO_MODE = (import.meta.env.VITE_ALLOW_DEMO === 'true');
  const effectiveUserId = DEMO_MODE ? 'local-demo' : currentUserId;
  const hydratedRef = useRef(false);
  const activeRequestRef = useRef(0);
  const localMessagesKey = 'astro_guru_demo_messages';
  const [answerTone, setAnswerTone] = useState<string>(profile?.answerTone || 'detailed');
  const [userGoals, setUserGoals] = useState<string>(profile?.userGoals || '');

  const chatKundli = useMemo(() => {
    if (profile?.kundli) {
      return profile.kundli;
    }

    if (profile?.dob && profile?.birthTime && profile?.birthPlace) {
      return generateKundli(profile?.name || '', profile.dob, profile.birthTime, profile.birthPlace);
    }

    return {
      ascendant: profile?.zodiacSign || 'Aries',
      nakshatra: 'Ashwini',
      mahadasha: 'Rahu',
      antardasha: 'Rahu',
      planets: [],
      houses: [],
      predictions: {
        personality: 'Your chart details are still loading, but your energy shows strong curiosity and drive.',
        career: 'Your career path favors initiative and practical action.',
        marriage: 'Relationships benefit from patient, honest communication.',
        health: 'Balance rest and routine to stay centered.',
        remedies: []
      }
    };
  }, [profile]);

  useEffect(() => {
    if (!effectiveUserId) {
      setMessages([]);
      hydratedRef.current = false;
      return;
    }

    // In demo mode we skip Firestore realtime syncing to avoid requiring project credentials.
    if (DEMO_MODE) {
      try {
        const stored = window.localStorage.getItem(localMessagesKey);
        if (stored) {
          setMessages(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage parse issues and continue with empty chat.
      }
      hydratedRef.current = true;
      return () => {};
    }

    const q = query(
      collection(db, 'users', effectiveUserId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const persisted = snap.docs.map(doc => {
        const data = doc.data() as Record<string, any>;

        return {
          id: doc.id,
          role: data.role === 'assistant' || data.role === 'model' ? 'assistant' : 'user',
          content: typeof data.content === 'string' ? data.content : String(data.text || ''),
          createdAt: data.createdAt,
          clientMessageId: typeof data.clientMessageId === 'string' ? data.clientMessageId : undefined,
        };
      });

      setMessages(previous => {
        const merged = [...previous];
        const seen = new Set(merged.map(message => message.clientMessageId || message.id).filter(Boolean) as string[]);

        for (const message of persisted) {
          const key = message.clientMessageId || message.id;
          if (!key || seen.has(key)) continue;
          merged.push(message);
          seen.add(key);
        }

        if (!hydratedRef.current) {
          hydratedRef.current = true;
          return persisted;
        }

        return merged.sort((left, right) => {
          const leftTime = left.createdAt?.seconds ? left.createdAt.seconds * 1000 : left.createdAt?.toDate?.()?.getTime?.() || 0;
          const rightTime = right.createdAt?.seconds ? right.createdAt.seconds * 1000 : right.createdAt?.toDate?.()?.getTime?.() || 0;
          return leftTime - rightTime;
        });
      });
    });

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    setAnswerTone(profile?.answerTone || 'detailed');
    setUserGoals(profile?.userGoals || '');
  }, [profile]);

  useEffect(() => {
    if (!DEMO_MODE || typeof window === 'undefined') return;
    const existing = window.localStorage.getItem(localMessagesKey);
    if (existing && messages.length === 0) return;
    if (!existing && messages.length === 0) return;
    try {
      window.localStorage.setItem(localMessagesKey, JSON.stringify(messages));
    } catch {
      // Local persistence is best-effort only.
    }
  }, [messages, DEMO_MODE]);

  const handleClearHistory = async () => {
    if (!currentUserId || messages.length === 0) return;
    if (!confirm("Are you sure you want to clear your celestial transcript?")) return;
    
    setClearing(true);
    setStatusError('');
    try {
      if (DEMO_MODE) {
        setMessages([]);
        window.localStorage.removeItem(localMessagesKey);
        return;
      }
      const userRef = collection(db, 'users', currentUserId, 'messages');
      const snap = await getDocs(userRef);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      setMessages([]);
    } catch (err) {
      console.error(err);
      setStatusError('Could not clear chat history right now. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const fetchAIResponse = async (message: string, sourceMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages) => {
    const responseText = await requestAIResponse(message, {
      userKundli: chatKundli,
      history: messagesToChatHistory(sourceMessages),
      options: {
        answerTone: answerTone || profile?.answerTone || 'detailed',
        userGoals: userGoals || profile?.userGoals || '',
      },
    });

    return responseText;
  };

  const messagesToChatHistory = (sourceMessages: Array<{ role: 'user' | 'assistant'; content: string }>): ChatMessage[] => {
    return sourceMessages.map(message => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));
  };

  const persistMessage = async (
    userRef: ReturnType<typeof collection>,
    payload: {
      text: string;
      content: string;
      role: 'user' | 'model';
      clientMessageId: string;
      createdAt: any;
    }
  ) => {
    if (DEMO_MODE) return;
    try {
      await addDoc(userRef, payload);
    } catch (error) {
      // Persistence should not block conversational flow.
      console.warn('Chat persistence failed:', error);
    }
  };

  const saveProfilePreferences = async () => {
    if (!currentUserId) return;
    try {
      const docRef = doc(db, 'users', currentUserId);
      await setDoc(docRef, { answerTone, userGoals }, { merge: true });
    } catch (err) {
      console.warn('Could not save preferences', err);
    }
  };

  const sendMessage = async (text?: string) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading || !currentUserId) return;

    const requestId = Date.now();
    activeRequestRef.current = requestId;
    setInput('');
    setLoading(true);
    setStatusError('');

    const userMessageId = `local-user-${requestId}`;
    const assistantMessageId = `local-assistant-${requestId}`;

    setMessages(previous => ([
      ...previous,
      {
        id: userMessageId,
        role: 'user',
        content: userMsg,
        createdAt: Timestamp.now(),
        clientMessageId: userMessageId,
      },
      {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Astro Guru is thinking...',
        createdAt: Timestamp.now(),
        clientMessageId: assistantMessageId,
      },
    ]));

    try {
      const userRef = collection(db, 'users', currentUserId, 'messages');

      void persistMessage(userRef, {
        text: userMsg,
        content: userMsg,
        role: 'user',
        clientMessageId: userMessageId,
        createdAt: Timestamp.now()
      });

      const response = await fetchAIResponse(userMsg, [...messages, { id: userMessageId, role: 'user', content: userMsg }]);

      if (activeRequestRef.current !== requestId) {
        return;
      }

      void persistMessage(userRef, {
        text: response,
        content: response,
        role: 'model',
        clientMessageId: assistantMessageId,
        createdAt: Timestamp.now()
      });

      if (!DEMO_MODE) {
        trackFirstTimeEvent(currentUserId, 'first_chat_sent', {
          hasHistory: messages.length > 0,
        }).catch((error) => console.warn('Analytics tracking failed:', error));
      }

      setMessages(previous => previous.map(message => {
        if (message.clientMessageId !== assistantMessageId) {
          return message;
        }

        return {
          ...message,
          content: response,
        };
      }));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setStatusError(message);
      setMessages(previous => previous.filter(message => message.clientMessageId !== assistantMessageId));
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="relative isolate mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-800/80 bg-[#080812]/85 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl min-w-0">
      <AstroBackground className="opacity-90" />

      <header className="relative z-10 flex flex-col gap-3 border-b border-slate-800/70 bg-[#050508]/55 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full theme-gradient-accent ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold tracking-tight text-white italic serif">Astro Guru</h3>
            <p className="mt-1 text-[10px] font-bold uppercase leading-none tracking-widest text-indigo-400">Stellar Consultant • Always Online</p>
          </div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={answerTone}
              onChange={(e) => setAnswerTone(e.target.value)}
              className="rounded-full bg-slate-900/60 text-xs text-slate-200 px-3 py-2 border border-slate-800"
              disabled={!currentUserId}
            >
              <option value="detailed">Detailed</option>
              <option value="concise">Concise</option>
              <option value="spiritual">Spiritual</option>
              <option value="practical">Practical</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={saveProfilePreferences}
              disabled={!currentUserId}
              className="hidden sm:inline-flex text-slate-400 hover:text-white text-[10px]"
            >
              Save
            </Button>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input
              value={userGoals}
              onChange={(e) => setUserGoals(e.target.value)}
              placeholder="Your goals (e.g., career, love)"
              className="block w-full rounded-full bg-slate-900/60 text-xs text-slate-200 px-3 py-2 border border-slate-800 sm:w-48"
              disabled={!currentUserId}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={saveProfilePreferences}
              disabled={!currentUserId}
              className="inline-flex sm:hidden text-slate-400 hover:text-white text-[10px]"
            >
              Save
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearHistory}
              disabled={clearing || messages.length === 0}
              className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all text-[10px] font-bold uppercase tracking-widest"
            >
              {clearing ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
              Clear History
            </Button>
          </div>
        </div>
      </header>

      {statusError && (
        <div className="relative z-10 px-4 pt-4 text-xs font-medium text-rose-400 sm:px-6">
          {statusError}
        </div>
      )}

      <div className="relative z-10 grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-0">
        <div
          ref={scrollRef}
          className="h-[70vh] max-h-[70vh] overflow-y-auto scroll-smooth px-4 py-4 sm:px-6 custom-scrollbar"
        >
          <div className="space-y-4 sm:space-y-5">
            <AnimatePresence initial={false}>
              {messages.length === 0 && !loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-6 rounded-3xl border border-slate-800/60 bg-slate-900/35 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]"
                >
                  <div className="space-y-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
                      <Bot className="text-indigo-300/80" size={28} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-white">Ask Astro Guru anything about your chart</p>
                      <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                        Pranam {profile?.name || 'Seeker'}! I can read your birth chart, answer career questions, and suggest remedies in a clearer, more focused conversation.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2">Career</span>
                      <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2">Love</span>
                      <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2">Health</span>
                      <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2">Remedies</span>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-[#050508]/55 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Suggested Queries</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendMessage(s)}
                          disabled={loading}
                          className="group inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-left text-xs text-indigo-200 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="max-w-[14rem] break-words">{s}</span>
                          <ArrowRight size={12} className="shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {messages.map((m, idx) => {
                const timeValue = m.createdAt?.toDate?.() || m.createdAt?.seconds ? new Date(m.createdAt.seconds ? m.createdAt.seconds * 1000 : m.createdAt) : null;
                const isThinkingMessage = loading && m.clientMessageId?.startsWith('local-assistant-') && m.content === 'Astro Guru is thinking...';

                return (
                  <motion.div
                    key={m.id || idx}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex w-full max-w-[92%] gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} sm:max-w-[85%]`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'border border-slate-700 bg-slate-800 text-indigo-400 shadow-md'}`}>
                        {m.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                      </div>
                      <div className={`min-w-0 flex-1 rounded-2xl px-4 py-4 text-[13px] leading-relaxed shadow-xl sm:px-5 ${
                        m.role === 'user' ? 'border border-indigo-500/20 bg-indigo-600/10 text-white' : 'border border-slate-800 bg-slate-900/50 text-slate-300'
                      } ${m.role === 'assistant' ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          <span>{m.role === 'user' ? 'You' : 'Astro Guru'}</span>
                          {timeValue && <span>{format(timeValue, 'p')}</span>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={endRef} />
            </AnimatePresence>
          </div>
        </div>

        <form onSubmit={onFormSubmit} className="border-t border-slate-800/70 bg-[#050508]/70 p-3 sm:p-4 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-5xl gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/40 p-3 shadow-lg shadow-black/10">
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your destiny..."
              className="h-14 min-w-0 flex-1 rounded-2xl border-slate-800/80 bg-slate-950/70 px-5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500"
              disabled={loading}
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="h-14 shrink-0 rounded-2xl bg-indigo-500 px-6 font-bold text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Send</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
