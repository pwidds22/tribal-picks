import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Bound EVERY Supabase HTTP call (token refresh included) at 15s.
// Without this, iOS lets a stalled socket hang for 60+ seconds, and because
// supabase-js serializes all queries behind in-flight auth operations, one
// hung refresh freezes every fetch in the app. An aborted refresh attempt is
// classified as retryable by auth-js and retried on a fresh connection.
const FETCH_TIMEOUT_MS = 15_000;
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort());
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
});

// Start auto-refresh immediately so expired tokens get refreshed ASAP on app load.
// Cold starts don't fire AppState 'active', so this must be called eagerly.
supabase.auth.startAutoRefresh();

// NOTE: Never call refreshSession() eagerly here or on app resume. getSession()
// already refreshes expired tokens on demand (deduped across callers) before any
// query goes out, so a forced refresh only adds a network round trip that every
// query must queue behind.

// Listeners for app resume (foreground from background).
const appResumeListeners = new Set<() => void>();
export function onAppResume(listener: () => void) {
  appResumeListeners.add(listener);
  return () => { appResumeListeners.delete(listener); };
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    // Restarting the ticker runs a tick immediately, which refreshes the token
    // only if it's near expiry. Listeners fire right away — their queries
    // self-heal via getSession()'s on-demand refresh.
    supabase.auth.startAutoRefresh();
    appResumeListeners.forEach((fn) => fn());
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
