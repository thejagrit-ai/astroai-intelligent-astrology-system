import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { KundliData } from './astrology';

type CacheRecord<T> = {
  cacheType: 'kundli' | 'matching';
  cacheKey: string;
  payload: Record<string, string>;
  value: T;
  createdAt: unknown;
};

type MatchingResult = {
  score: number;
  percentage: number;
  explanation: string;
  gunaMilan: number;
};

function normalize(input: string) {
  return (input || '').trim().toLowerCase();
}

function hashKey(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function buildKundliCacheId(name: string, dob: string, time: string, place: string) {
  const key = [name, dob, time, place].map(normalize).join('|');
  return `k_${hashKey(key)}`;
}

function buildMatchingCacheId(
  boyName: string,
  boyDob: string,
  boyTime: string,
  boyPlace: string,
  girlName: string,
  girlDob: string,
  girlTime: string,
  girlPlace: string,
) {
  const left = [boyName, boyDob, boyTime, boyPlace].map(normalize).join('|');
  const right = [girlName, girlDob, girlTime, girlPlace].map(normalize).join('|');
  const sorted = [left, right].sort();
  return `m_${hashKey(`${sorted[0]}::${sorted[1]}`)}`;
}

async function getOrCreateCacheValue<T>(
  userId: string,
  cacheId: string,
  cacheType: CacheRecord<T>['cacheType'],
  payload: Record<string, string>,
  factory: () => Promise<T> | T,
) {
  const cacheRef = doc(db, 'users', userId, 'kundlis', cacheId);
  try {
    const existing = await getDoc(cacheRef);

    if (existing.exists()) {
      const data = existing.data() as Partial<CacheRecord<T>>;
      if (data.value) {
        return data.value;
      }
    }
  } catch (err) {
    console.error('Failed to read cache from Firestore:', err);
    // Fall back to deterministic generation when the cache cannot be read.
  }

  const value = await Promise.resolve(factory());

  try {
    await setDoc(cacheRef, {
      cacheType,
      cacheKey: cacheId,
      payload,
      value,
      createdAt: serverTimestamp(),
    } as CacheRecord<T>);
  } catch (err) {
    console.error('Failed to write cache to Firestore:', err);
    const retry = await getDoc(cacheRef);
    if (retry.exists()) {
      const data = retry.data() as Partial<CacheRecord<T>>;
      if (data.value) {
        return data.value;
      }
    }
  }

  return value;
}

export async function getOrCreateKundliCache(
  userId: string,
  input: { name: string; dob: string; time: string; place: string },
  factory: () => Promise<KundliData> | KundliData,
) {
  const cacheId = buildKundliCacheId(input.name, input.dob, input.time, input.place);
  return getOrCreateCacheValue<KundliData>(
    userId,
    cacheId,
    'kundli',
    {
      name: input.name,
      dob: input.dob,
      time: input.time,
      place: input.place,
    },
    factory,
  );
}

export async function getOrCreateMatchingCache(
  userId: string,
  input: {
    boyName: string;
    boyDob: string;
    boyTime: string;
    boyPlace: string;
    girlName: string;
    girlDob: string;
    girlTime: string;
    girlPlace: string;
  },
  factory: () => Promise<MatchingResult> | MatchingResult,
) {
  const cacheId = buildMatchingCacheId(
    input.boyName,
    input.boyDob,
    input.boyTime,
    input.boyPlace,
    input.girlName,
    input.girlDob,
    input.girlTime,
    input.girlPlace,
  );

  return getOrCreateCacheValue<MatchingResult>(
    userId,
    cacheId,
    'matching',
    {
      boyName: input.boyName,
      boyDob: input.boyDob,
      boyTime: input.boyTime,
      boyPlace: input.boyPlace,
      girlName: input.girlName,
      girlDob: input.girlDob,
      girlTime: input.girlTime,
      girlPlace: input.girlPlace,
    },
    factory,
  );
}