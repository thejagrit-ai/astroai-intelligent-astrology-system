import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

type AnalyticsPayload = Record<string, unknown>;

function buildLocalEventKey(userId: string, eventName: string) {
  return `astro_guru_event_once_${userId}_${eventName}`;
}

export async function trackAnalyticsEvent(userId: string, eventName: string, payload: AnalyticsPayload = {}) {
  if (!userId || !eventName) return;
  if (import.meta.env.VITE_ALLOW_DEMO === 'true') return;

  await addDoc(collection(db, 'users', userId, 'analytics'), {
    eventName,
    payload,
    createdAt: serverTimestamp(),
  });
}

export async function trackFirstTimeEvent(userId: string, eventName: string, payload: AnalyticsPayload = {}) {
  if (!userId || !eventName || typeof window === 'undefined') return;
  if (import.meta.env.VITE_ALLOW_DEMO === 'true') return;

  const key = buildLocalEventKey(userId, eventName);
  if (window.localStorage.getItem(key)) {
    return;
  }

  await trackAnalyticsEvent(userId, eventName, payload);
  window.localStorage.setItem(key, '1');
}