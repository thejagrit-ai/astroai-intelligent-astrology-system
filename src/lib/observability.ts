import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

type ErrorContext = Record<string, unknown>;

export async function reportClientError(userId: string | null, error: unknown, context: ErrorContext = {}) {
  const safeMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;

  console.error('[Astro Guru Error]', { safeMessage, context, stack });

  if (!userId) return;

  try {
    await addDoc(collection(db, 'users', userId, 'errors'), {
      message: safeMessage,
      stack,
      context,
      createdAt: serverTimestamp(),
    });
  } catch (writeError) {
    console.error('[Astro Guru Error] Failed to persist error log', writeError);
  }
}

export function setupGlobalErrorListeners(getUserId: () => string | null) {
  const onError = (event: ErrorEvent) => {
    reportClientError(getUserId(), event.error || event.message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError(getUserId(), event.reason, {
      source: 'window.unhandledrejection',
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}