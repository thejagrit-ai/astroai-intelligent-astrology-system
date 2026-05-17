import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getZodiacSign, generateKundli } from '../lib/astrology';
import LocationAutocomplete from './LocationAutocomplete';
import { trackFirstTimeEvent } from '../lib/analytics';

export default function AuthView({ onSuccess }: { onSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    birthTime: '',
    birthPlace: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(user, { displayName: formData.name });
        
        const zodiac = getZodiacSign(new Date(formData.dob));
        const kundli = generateKundli(formData.name, formData.dob, formData.birthTime, formData.birthPlace);
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: formData.name,
          email: formData.email,
          dob: formData.dob,
          birthTime: formData.birthTime,
          birthPlace: formData.birthPlace,
          zodiacSign: zodiac,
          kundli: kundli,
          predictions: kundli.predictions,
          createdAt: new Date().toISOString()
        });

        await trackFirstTimeEvent(user.uid, 'signup_completed', {
          zodiac,
          hasBirthDetails: Boolean(formData.dob && formData.birthTime && formData.birthPlace),
        });
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        const code = err.code;
        if (code === 'auth/too-many-requests') {
          setError('Too many login attempts were made from this device. Please wait a few minutes, then try again or reset your password.');
        } else if (code === 'auth/invalid-credential') {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (code === 'auth/user-not-found') {
          setError('No account exists with this email address.');
        } else if (code === 'auth/wrong-password') {
          setError('Incorrect password. Please try again or reset your password.');
        } else if (code === 'auth/network-request-failed') {
          setError('Network error. Check your internet connection and try again.');
        } else if (code === 'auth/email-already-in-use') {
          setError('An account with this email already exists. Try logging in instead.');
        } else if (code === 'auth/operation-not-allowed') {
          setError('Email/password sign-in is disabled in Firebase Auth. Enable it in Firebase Console -> Authentication -> Sign-in method -> Email/Password.');
        } else if (code === 'auth/unauthorized-domain') {
          setError('This domain is not authorized for Firebase Auth. Add your site domain in Firebase Console -> Authentication -> Settings -> Authorized domains.');
        } else if (code === 'auth/invalid-api-key') {
          setError('Invalid Firebase API key or app config mismatch. Verify firebase-applet-config.json matches your Firebase project.');
        } else {
          setError(err.message || 'Authentication failed. Please try again.');
        }
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setInfoMessage('');
    if (!formData.email.trim()) {
      setError('Enter your email address first, then use password reset.');
      return;
    }

    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, formData.email.trim());
      setInfoMessage('Password reset email sent. Check your inbox and spam folder.');
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === 'auth/user-not-found') {
        setError('No account exists with this email address.');
      } else if (err instanceof FirebaseError && err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err instanceof FirebaseError && err.code === 'auth/operation-not-allowed') {
        setError('Password reset is disabled because Email/Password auth is not enabled in Firebase Console.');
      } else {
        setError('Could not send reset email right now. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Decorative Blur Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 theme-gradient-accent rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.3)] ring-4 ring-indigo-500/10">
            <Sparkles className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 italic serif tracking-tight">Astro Guru</h1>
          <p className="text-slate-400 font-medium tracking-wide">Enter the Realm of Celestial Wisdom</p>
        </div>

        <Card className="bg-[#0a0a14]/60 backdrop-blur-2xl border-slate-800 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/50 pb-6">
            <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 max-w-[240px] mx-auto">
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all ${isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all ${!isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Join
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-8 px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Full Name</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                      <Input 
                        required
                        className="pl-12 bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl transition-all"
                        placeholder="Arshdeep Singh"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Date of Birth</Label>
                      <Input 
                        required
                        type="date"
                        className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl [color-scheme:dark] transition-all"
                        value={formData.dob}
                        onChange={e => setFormData({...formData, dob: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Birth Time</Label>
                      <Input 
                        required
                        type="time"
                        className="bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl [color-scheme:dark] transition-all"
                        value={formData.birthTime}
                        onChange={e => setFormData({...formData, birthTime: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Birth Place</Label>
                    <LocationAutocomplete 
                      required
                      value={formData.birthPlace}
                      onChange={val => setFormData({...formData, birthPlace: val})}
                    />
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <Input 
                    required
                    type="email"
                    className="pl-12 bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl transition-all"
                    placeholder="you@celestial.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Celestial Key (Password)</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <Input 
                    required
                    type="password"
                    className="pl-12 bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-3"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              {infoMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-3"
                >
                  <Sparkles size={16} />
                  {infoMessage}
                </motion.div>
              )}

              {isLogin && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading || loading}
                  className="text-xs text-slate-400 hover:text-indigo-300 transition-colors disabled:opacity-60"
                >
                  {resetLoading ? 'Sending reset email...' : 'Forgot password? Send reset link'}
                </button>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <Sparkles size={20} />
                    {isLogin ? 'Enter Sanctuary' : 'Awake Spirit'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center mt-8 text-slate-500 text-[10px] tracking-[0.3em] font-bold uppercase">
          Guarded by Cosmic Encryption
        </p>
      </motion.div>
    </div>
  );
}
