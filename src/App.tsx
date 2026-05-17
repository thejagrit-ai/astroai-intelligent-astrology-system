/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  User as UserIcon, 
  Map, 
  MessageSquare, 
  Users, 
  LogOut, 
  Heart,
  LayoutDashboard,
  CalendarRange
} from 'lucide-react';
import { trackAnalyticsEvent, trackFirstTimeEvent } from './lib/analytics';
import { setupGlobalErrorListeners } from './lib/observability';

import AuthView from './components/AuthView';
import DashboardView from './components/DashboardView';
import KundliView from './components/KundliView';
import ChatView from './components/ChatView';
import MatchingView from './components/MatchingView';
import AstrologersView from './components/AstrologersView';
import LandingPageView from './components/LandingPageView';
import ProfileView from './components/ProfileView';
import InsightsView from './components/InsightsView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const DEMO_MODE = (import.meta.env.VITE_ALLOW_DEMO === 'true');
  const [activeTab, setActiveTab] = useState(DEMO_MODE ? 'chat' : 'dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    // Timeout fallback for loading state
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timer);
      try {
        setUser(u);
        if (u) {
          const docRef = doc(db, 'users', u.uid);
          profileUnsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data());
            }
          });
          setShowAuth(false);
          // If there was a pending tab from landing page, go there
          if (pendingTab) {
            setActiveTab(pendingTab);
            setPendingTab(null);
          }
        } else {
          if (profileUnsubscribe) {
            profileUnsubscribe();
            profileUnsubscribe = null;
          }
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
      unsubscribe();
    };
  }, [pendingTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanup = setupGlobalErrorListeners(() => auth.currentUser?.uid || null);
    return cleanup;
  }, []);

  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    trackAnalyticsEvent(userId, 'session_started', {
      activeTab,
      timestamp: new Date().toISOString(),
    }).catch(console.error);

    trackFirstTimeEvent(userId, 'day_7_retention_probe', {
      accountAgeDays: profile?.createdAt ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : null,
    }).catch(console.error);
  }, [user?.uid, activeTab, profile?.createdAt]);

  useEffect(() => {
    if (!profile?.remindersEnabled || !profile?.reminderTime) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const [hour, minute] = String(profile.reminderTime).split(':').map(Number);
    const now = new Date();
    const trigger = new Date();
    trigger.setHours(hour || 8, minute || 0, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const timeoutMs = trigger.getTime() - now.getTime();
    const timeoutId = window.setTimeout(() => {
      new Notification('Astro Guru Reminder', {
        body: 'Your daily guidance is ready. Open Astro Guru to read your latest insights.',
      });
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [profile?.remindersEnabled, profile?.reminderTime]);

  const handleLandingAction = (target: string) => {
    if (user) {
      setActiveTab(target);
    } else {
      setPendingTab(target);
      setShowAuth(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="text-indigo-500"
        >
          <Sparkles size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    if (showAuth) {
      return (
        <div className="relative">
          <button 
            onClick={() => setShowAuth(false)}
            className="absolute top-8 left-8 z-[100] text-slate-500 hover:text-white transition-colors flex items-center gap-2 font-bold uppercase tracking-widest text-[10px]"
          >
            ← Back to Stars
          </button>
          <AuthView onSuccess={() => setShowAuth(false)} />
        </div>
      );
    }
    return <LandingPageView onAction={handleLandingAction} />;
  }

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView profile={profile} />;
      case 'kundli': return <KundliView profile={profile} />;
      case 'chat': return <ChatView profile={profile} />;
      case 'matching': return <MatchingView profile={profile} />;
      case 'insights': return <InsightsView profile={profile} />;
      case 'astrologers': return <AstrologersView />;
      case 'profile': return <ProfileView profile={profile} />;
      default: return <DashboardView profile={profile} />;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050508] text-slate-200 font-sans min-w-0" onClick={() => setShowProfileMenu(false)}>
      {/* Navigation Sidebar */}
      <aside className="w-64 shrink-0 theme-sidebar flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 rounded-full theme-gradient-accent flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <span className="text-xl text-white">✧</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white italic serif">Astro Guru</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarNavItem 
            icon={<LayoutDashboard size={18} />} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            label="Dashboard" 
          />
          <SidebarNavItem 
            icon={<Map size={18} />} 
            active={activeTab === 'kundli'} 
            onClick={() => setActiveTab('kundli')} 
            label="Birth Chart" 
          />
          <SidebarNavItem 
            icon={<MessageSquare size={18} />} 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            label="AI Consultant" 
          />
          <SidebarNavItem 
            icon={<Heart size={18} />} 
            active={activeTab === 'matching'} 
            onClick={() => setActiveTab('matching')} 
            label="Matching" 
          />
          <SidebarNavItem 
            icon={<CalendarRange size={18} />} 
            active={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')} 
            label="Transit" 
          />
          <SidebarNavItem 
            icon={<Users size={18} />} 
            active={activeTab === 'astrologers'} 
            onClick={() => setActiveTab('astrologers')} 
            label="Experts" 
          />
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30">
            <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-2">Dasha Period</p>
            <p className="text-sm font-medium text-white">Mahadasha: {profile?.mahadasha || 'Rahu'}</p>
            <p className="text-[10px] text-slate-400">Ends Dec 2028</p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors group"
          >
            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] -z-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 blur-[100px] -z-10 rounded-full"></div>

        {/* Top Header */}
        <header className="h-20 theme-header flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-40 min-w-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Welcome back, {profile?.name || 'Explorer'}</h2>
            <p className="text-xs text-slate-500">{profile?.zodiacSign} Ascendant • {profile?.nakshatra || 'Rohini'} Nakshatra</p>
          </div>
          <div className="flex items-center gap-6 relative">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs text-slate-500 uppercase tracking-widest">Current Transit</span>
              <span className="text-sm text-amber-400 font-medium">Sun in {profile?.transitSign || 'Sagittarius'}</span>
            </div>
            
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu(!showProfileMenu);
                }}
                className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 overflow-hidden ring-offset-2 ring-offset-[#050508] transition-all hover:ring-2 hover:ring-indigo-500 cursor-pointer"
              >
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  {profile?.name?.substring(0, 2).toUpperCase() || 'AI'}
                </div>
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 rounded-2xl bg-[#0a0a14] border border-slate-800 shadow-2xl p-2 z-[60]"
                  >
                    <div className="p-3 border-b border-slate-800 mb-2">
                       <p className="text-sm font-bold text-white truncate">{profile?.name}</p>
                       <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-indigo-600/10 hover:text-white rounded-xl transition-all"
                    >
                      <UserIcon size={16} /> View Profile
                    </button>
                    <button 
                      onClick={() => auth.signOut()}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all mt-1"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarNavItem({ icon, active, onClick, label }: { icon: any, active: boolean, onClick: () => void, label: string }) {
  return (
    <div 
      onClick={onClick}
      className={`theme-nav-item ${active ? 'active-nav-item' : ''}`}
    >
      <span className={active ? 'text-indigo-400' : 'opacity-70'}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {active && (
        <motion.div 
          layoutId="sidebar-indicator"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"
        />
      )}
    </div>
  );
}
