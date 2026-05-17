import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Calendar, Clock, MapPin, Sparkles, LogOut, Shield, Activity, Star, Bell, Gauge, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth, db } from '../lib/firebase';
import { ZODIAC_DATA } from '../constants';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { computeProfileCompleteness, exportUserCosmicData, saveUserPreferences, UserPreferences } from '../lib/userFeatures';
import { doc, setDoc } from 'firebase/firestore';
import { getZodiacSign, generateKundli } from '../lib/astrology';
import { updateProfile } from 'firebase/auth';
import LocationAutocomplete from './LocationAutocomplete';

export default function ProfileView({ profile }: { profile: any }) {
  const zodiac = profile?.zodiacSign || 'Aries';
  const zodiacInfo = ZODIAC_DATA[zodiac];
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [identityForm, setIdentityForm] = useState({
    name: profile?.name || '',
    dob: profile?.dob || '',
    birthTime: profile?.birthTime || '',
    birthPlace: profile?.birthPlace || '',
    gender: profile?.gender || '',
  });
  const [preferences, setPreferences] = useState<UserPreferences>({
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    birthTimeAccuracy: profile?.birthTimeAccuracy || 'unknown',
    locationConfidence: Number(profile?.locationConfidence || 60),
    answerTone: profile?.answerTone || 'detailed',
    userGoals: profile?.userGoals || '',
    remindersEnabled: !!profile?.remindersEnabled,
    reminderTime: profile?.reminderTime || '08:00',
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setIdentityForm({
      name: profile?.name || '',
      dob: profile?.dob || '',
      birthTime: profile?.birthTime || '',
      birthPlace: profile?.birthPlace || '',
      gender: profile?.gender || '',
    });

    setPreferences({
      timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      birthTimeAccuracy: profile?.birthTimeAccuracy || 'unknown',
      locationConfidence: Number(profile?.locationConfidence || 60),
      answerTone: profile?.answerTone || 'detailed',
      userGoals: profile?.userGoals || '',
      remindersEnabled: !!profile?.remindersEnabled,
      reminderTime: profile?.reminderTime || '08:00',
    });
  }, [profile]);

  const completeness = useMemo(() => computeProfileCompleteness({ ...profile, ...preferences }), [profile, preferences]);
  const isProfileComplete = useMemo(() => {
    return Boolean(
      String(profile?.name || '').trim() &&
      String(profile?.dob || '').trim() &&
      String(profile?.birthPlace || '').trim()
    );
  }, [profile]);

  const validateIdentityForm = () => {
    const nextErrors: Record<string, string> = {};
    const name = identityForm.name.trim();
    const dob = identityForm.dob.trim();
    const birthTime = identityForm.birthTime.trim();
    const birthPlace = identityForm.birthPlace.trim();

    if (!name) {
      nextErrors.name = 'Full name is required.';
    }

    if (!dob) {
      nextErrors.dob = 'Date of birth is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      nextErrors.dob = 'Date format must be YYYY-MM-DD.';
    }

    if (birthTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(birthTime)) {
      nextErrors.birthTime = 'Time format must be HH:MM (24-hour).';
    }

    if (!birthPlace) {
      nextErrors.birthPlace = 'Birth place is required.';
    }

    setIdentityErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveIdentity = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    if (!validateIdentityForm()) return;

    try {
      setSavingIdentity(true);
      const name = identityForm.name.trim();
      const dob = identityForm.dob.trim();
      const birthTime = identityForm.birthTime.trim() || '12:00';
      const birthPlace = identityForm.birthPlace.trim();
      const gender = identityForm.gender.trim();
      const zodiacSign = getZodiacSign(new Date(dob));
      const kundli = generateKundli(name, dob, birthTime, birthPlace);

      await setDoc(
        doc(db, 'users', userId),
        {
          name,
          dob,
          birthTime,
          birthPlace,
          gender,
          zodiacSign,
          kundli,
          predictions: kundli.predictions,
          nakshatra: kundli.nakshatra,
          mahadasha: kundli.mahadasha,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      if (auth.currentUser && auth.currentUser.displayName !== name) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      setStatusMessage('Profile updated and chart regenerated successfully.');
      setEditingIdentity(false);
    } catch (error) {
      console.error(error);
      setStatusMessage('Could not update profile right now.');
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleCancelIdentityEdit = () => {
    setIdentityErrors({});
    setIdentityForm({
      name: profile?.name || '',
      dob: profile?.dob || '',
      birthTime: profile?.birthTime || '',
      birthPlace: profile?.birthPlace || '',
      gender: profile?.gender || '',
    });
    setEditingIdentity(false);
  };

  const handleSavePreferences = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      setSaving(true);
      setStatusMessage('');
      await saveUserPreferences(userId, preferences);
      setStatusMessage('Preferences saved successfully.');
    } catch (error) {
      console.error(error);
      setStatusMessage('Could not save preferences right now.');
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setStatusMessage('This browser does not support notifications.');
      return;
    }

    const permission = await Notification.requestPermission();
    setStatusMessage(permission === 'granted' ? 'Notification permission granted.' : 'Notification permission denied.');
  };

  const handleExportData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await exportUserCosmicData(userId);
      setStatusMessage('Backup export downloaded successfully.');
    } catch (error) {
      console.error(error);
      setStatusMessage('Could not export backup right now.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-32 h-32 rounded-[2.5rem] theme-gradient-accent mx-auto flex items-center justify-center text-white text-5xl font-bold shadow-[0_0_50px_rgba(99,102,241,0.3)] ring-4 ring-indigo-500/10"
        >
          {profile?.name?.substring(0, 1).toUpperCase()}
        </motion.div>
        <div>
          <h1 className="text-4xl font-bold text-white italic serif">{profile?.name || 'Celestial Seeker'}</h1>
          <p className="text-indigo-400 font-medium tracking-wide">{profile?.email}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-bold text-white italic serif flex items-center gap-3">
                <Shield className="text-indigo-400" size={20} />
                Spiritual Identity
              </CardTitle>
              {!editingIdentity && (
                <Button variant="outline" onClick={() => setEditingIdentity(true)} className="border-slate-700 text-slate-300">
                  Edit Profile
                </Button>
              )}
            </div>
            <CardDescription className="text-slate-500">Your core cosmic parameters stored in the stars.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {!isProfileComplete && !editingIdentity && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Complete your profile to unlock insights
              </div>
            )}

            {editingIdentity ? (
              <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <IdentityField label="Full Name" error={identityErrors.name}>
                    <Input
                      value={identityForm.name}
                      onChange={e => setIdentityForm(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-slate-950/60 border-slate-800"
                    />
                  </IdentityField>

                  <IdentityField label="Date of Birth" error={identityErrors.dob}>
                    <Input
                      type="date"
                      value={identityForm.dob}
                      onChange={e => setIdentityForm(prev => ({ ...prev, dob: e.target.value }))}
                      className="bg-slate-950/60 border-slate-800 [color-scheme:dark]"
                    />
                  </IdentityField>

                  <IdentityField label="Time of Birth" error={identityErrors.birthTime}>
                    <Input
                      type="time"
                      value={identityForm.birthTime}
                      onChange={e => setIdentityForm(prev => ({ ...prev, birthTime: e.target.value }))}
                      className="bg-slate-950/60 border-slate-800 [color-scheme:dark]"
                    />
                  </IdentityField>

                  <IdentityField label="Gender (optional)">
                    <Select value={identityForm.gender || 'not-specified'} onValueChange={value => setIdentityForm(prev => ({ ...prev, gender: value === 'not-specified' ? '' : value }))}>
                      <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-specified">Prefer not to say</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                      </SelectContent>
                    </Select>
                  </IdentityField>
                </div>

                <IdentityField label="Birth Place (City, Country)" error={identityErrors.birthPlace}>
                  <LocationAutocomplete
                    value={identityForm.birthPlace}
                    onChange={value => setIdentityForm(prev => ({ ...prev, birthPlace: value }))}
                    placeholder="City, Country"
                    required
                  />
                </IdentityField>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSaveIdentity} disabled={savingIdentity} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {savingIdentity ? 'Saving...' : 'Save'}
                  </Button>
                  <Button onClick={handleCancelIdentityEdit} variant="outline" className="border-slate-700 text-slate-300">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ProfileItem icon={User} label="Full Name" value={profile?.name} />
                <ProfileItem icon={Calendar} label="Date of Birth" value={profile?.dob} />
                <ProfileItem icon={Clock} label="Time of Birth" value={profile?.birthTime} />
                <ProfileItem icon={MapPin} label="Birth Place (City, Country)" value={profile?.birthPlace} />
                <ProfileItem icon={Mail} label="Email" value={profile?.email} />
                <ProfileItem icon={User} label="Gender" value={profile?.gender || 'Prefer not to say'} />
                <ProfileItem icon={Sparkles} label="Ascendant" value={`${zodiac} (${zodiacInfo.symbol})`} />
              </div>
            )}
            
            <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
              <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">Aura Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed italic font-light">
                "{profile?.predictions?.personality || 'The universe is still deciphering your presence. Generate a detailed Kundli to reveal your core aura summary.'}"
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-xl font-bold text-white italic serif flex items-center gap-3">
              <Activity className="text-emerald-400" size={20} />
              Vitality Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
             <div className="space-y-4">
               <StatItem label="Cosmic Alignment" value="88%" color="bg-emerald-500" />
               <StatItem label="Spiritual Growth" value="65%" color="bg-indigo-500" />
               <StatItem label="Karmic Balance" value="92%" color="bg-amber-500" />
             </div>
             
             <div className="pt-6 border-t border-white/5">
                <Button 
                  onClick={() => auth.signOut()}
                  variant="destructive" 
                  className="w-full h-12 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                >
                  <LogOut size={18} className="mr-2" /> Sever Connection
                </Button>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-xl font-bold text-white italic serif flex items-center gap-3">
              <Gauge className="text-indigo-400" size={20} />
              Profile Completeness
            </CardTitle>
            <CardDescription className="text-slate-500">Complete details improve astrology precision and confidence labels.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Completeness Score</p>
                <p className="text-sm font-bold text-white">{completeness.score}%</p>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className={`h-full ${completeness.confidence === 'high' ? 'bg-emerald-500' : completeness.confidence === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${completeness.score}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 mb-2">Missing Details</p>
              {completeness.missing.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-300">
                  {completeness.missing.map(item => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-400">All key profile details are complete.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-xl font-bold text-white italic serif flex items-center gap-3">
              <Target className="text-indigo-400" size={20} />
              Personalization & Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Timezone</p>
              <Input value={preferences.timezone || ''} onChange={e => setPreferences(prev => ({ ...prev, timezone: e.target.value }))} className="bg-slate-950/50 border-slate-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Birth Time Accuracy</p>
                <Select value={preferences.birthTimeAccuracy || 'unknown'} onValueChange={value => setPreferences(prev => ({ ...prev, birthTimeAccuracy: value as any }))}>
                  <SelectTrigger className="w-full bg-slate-950/50 border-slate-800 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="approximate">Approximate</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">AI Tone</p>
                <Select value={preferences.answerTone || 'detailed'} onValueChange={value => setPreferences(prev => ({ ...prev, answerTone: value as any }))}>
                  <SelectTrigger className="w-full bg-slate-950/50 border-slate-800 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="spiritual">Spiritual</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Location Confidence</p>
                <span className="text-xs text-white font-bold">{preferences.locationConfidence}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={preferences.locationConfidence || 0}
                onChange={e => setPreferences(prev => ({ ...prev, locationConfidence: Number(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Goals / Memory Context</p>
              <Input
                value={preferences.userGoals || ''}
                onChange={e => setPreferences(prev => ({ ...prev, userGoals: e.target.value }))}
                className="bg-slate-950/50 border-slate-800"
                placeholder="Exam prep, marriage timeline, startup growth, health focus..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!!preferences.remindersEnabled}
                  onChange={e => setPreferences(prev => ({ ...prev, remindersEnabled: e.target.checked }))}
                  className="accent-indigo-500"
                />
                Enable Daily Reminder
              </label>
              <Input type="time" value={preferences.reminderTime || '08:00'} onChange={e => setPreferences(prev => ({ ...prev, reminderTime: e.target.value }))} className="bg-slate-950/50 border-slate-800" />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSavePreferences} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
              <Button onClick={requestNotificationPermission} variant="outline" className="border-slate-700 text-slate-300 rounded-xl">
                <Bell size={16} className="mr-2" /> Allow Notifications
              </Button>
            </div>

            {statusMessage && <p className="text-xs text-indigo-300">{statusMessage}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
           <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-white italic serif flex items-center gap-3">
                <Star className="text-amber-400" size={20} />
                Remedies
              </CardTitle>
           </CardHeader>
           <CardContent className="pt-6">
              <div className="space-y-4">
                {profile?.predictions?.remedies?.map((r: string, i: number) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{r}</p>
                  </div>
                ))}
                {!profile?.predictions?.remedies && (
                  <p className="text-xs text-slate-500 text-center py-4">No remedies assigned yet. Invoke the stars by generating a chart.</p>
                )}
              </div>
           </CardContent>
        </Card>

        <Card className="bg-[#0a0a14]/60 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-indigo-600/5 to-transparent">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-6 h-full">
            <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Shield size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white italic serif">Ascendant Soul</h3>
              <p className="text-slate-400 text-sm font-light">Your data is synchronized with the akashic records. All insights are calculated once for pure consistency.</p>
            </div>
            <Button onClick={handleExportData} variant="outline" className="rounded-full border-slate-700 text-slate-400">Export Cosmic Data</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-1.5 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 mt-1">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{label}</p>
        <p className="text-sm font-medium text-white">{value || '-'}</p>
      </div>
    </div>
  );
}

function IdentityField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{label}</p>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{label}</p>
        <span className="text-xs font-bold text-white">{value}</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: value }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
