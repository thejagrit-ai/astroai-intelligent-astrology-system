import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type AnswerTone = 'concise' | 'detailed' | 'spiritual' | 'practical';
export type ConfidenceLabel = 'high' | 'medium' | 'low';

export interface UserPreferences {
  timezone?: string;
  birthTimeAccuracy?: 'exact' | 'approximate' | 'unknown';
  locationConfidence?: number;
  answerTone?: AnswerTone;
  userGoals?: string;
  remindersEnabled?: boolean;
  reminderTime?: string;
}

export interface ReadingEntry {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  zodiac: string;
  insight: string;
  report: {
    insight: string;
    focus: string;
    avoid: string;
    career: string;
    love: string;
    money: string;
    health: string;
    remedies: string[];
  };
  cameTrue?: boolean | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeProfileCompleteness(profile: any): { score: number; missing: string[]; confidence: ConfidenceLabel } {
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'birthTime', label: 'Birth Time' },
    { key: 'birthPlace', label: 'Birth Place' },
    { key: 'timezone', label: 'Timezone' },
  ];

  const missing = requiredFields
    .filter(field => !String(profile?.[field.key] || '').trim())
    .map(field => field.label);

  const baseScore = ((requiredFields.length - missing.length) / requiredFields.length) * 100;
  const locationConfidence = Number(profile?.locationConfidence || 0);
  const birthAccuracy = profile?.birthTimeAccuracy || 'unknown';

  let weighted = baseScore;
  weighted += clamp(locationConfidence, 0, 100) * 0.15;
  weighted += birthAccuracy === 'exact' ? 10 : birthAccuracy === 'approximate' ? 5 : 0;

  const score = Math.round(clamp(weighted, 0, 100));
  const confidence: ConfidenceLabel = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';

  return { score, missing, confidence };
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences) {
  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      ...preferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveReadingTimelineEntry(userId: string, entry: Omit<ReadingEntry, 'id'>) {
  const id = `reading_${Date.now()}`;
  const readingRef = doc(db, 'users', userId, 'readings', id);
  await setDoc(readingRef, {
    ...entry,
    cameTrue: entry.cameTrue ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listReadingTimeline(userId: string): Promise<ReadingEntry[]> {
  const q = query(collection(db, 'users', userId, 'readings'), orderBy('createdAt', 'desc'), limit(20));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(document => ({ id: document.id, ...(document.data() as Omit<ReadingEntry, 'id'>) }));
}

export async function markReadingOutcome(userId: string, readingId: string, cameTrue: boolean) {
  const readingRef = doc(db, 'users', userId, 'readings', readingId);
  await updateDoc(readingRef, {
    cameTrue,
    updatedAt: serverTimestamp(),
  });
}

export async function exportUserCosmicData(userId: string) {
  const userRef = doc(db, 'users', userId);
  const [userDoc, readings, messages, kundlis] = await Promise.all([
    getDoc(userRef),
    getDocs(collection(db, 'users', userId, 'readings')),
    getDocs(collection(db, 'users', userId, 'messages')),
    getDocs(collection(db, 'users', userId, 'kundlis')),
  ]);

  const data = {
    profile: userDoc.exists() ? userDoc.data() : null,
    readings: readings.docs.map(item => ({ id: item.id, ...item.data() })),
    messages: messages.docs.map(item => ({ id: item.id, ...item.data() })),
    kundlis: kundlis.docs.map(item => ({ id: item.id, ...item.data() })),
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `astro-guru-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
