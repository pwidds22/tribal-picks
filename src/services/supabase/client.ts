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
// Without this, the restored session may have an expired access token and queries
// will fail/hang until the first AppState 'active' event fires.
supabase.auth.startAutoRefresh();

// Proactively refresh the session token on app start. This fires immediately
// (before INITIAL_SESSION even fires in the auth store), so by the time screens
// start fetching data, the token is already fresh.
supabase.auth.refreshSession().catch(() => {});

// When the app moves to background, stop refreshing. On foreground, restart.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
