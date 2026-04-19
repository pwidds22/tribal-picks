import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Start auto-refresh immediately so expired tokens get refreshed ASAP on app load.
// Cold starts don't fire AppState 'active', so this must be called eagerly.
supabase.auth.startAutoRefresh();

// NOTE: Do NOT call refreshSession() here — it races with the INITIAL_SESSION
// handler in useAuthStore and can consume the refresh token before the handler
// gets to use it. Token refresh is handled exclusively in useAuthStore.initialize().

// Listeners for app resume (foreground from background).
// Called AFTER token refresh completes so queries use a fresh token.
const appResumeListeners = new Set<() => void>();
export function onAppResume(listener: () => void) {
  appResumeListeners.add(listener);
  return () => { appResumeListeners.delete(listener); };
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
    // Force an immediate token refresh on resume, then notify listeners
    supabase.auth.refreshSession().then(() => {
      appResumeListeners.forEach((fn) => fn());
    }).catch(() => {});
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
