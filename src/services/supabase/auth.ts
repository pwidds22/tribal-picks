import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './client';

// ============================================
// Email Auth
// ============================================

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) throw error;

  // Create profile after signup
  if (data.user) {
    await ensureProfile(data.user.id, username);
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ============================================
// Apple Sign-In (iOS)
// ============================================

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }

  // Generate raw nonce, then hash it for Apple
  const rawNonce = Array.from(Crypto.getRandomBytes(32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No identity token received from Apple');
  }

  // Supabase expects the raw nonce — it hashes internally to verify
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;

  // Create profile for Apple user
  if (data.user) {
    const name =
      credential.fullName?.givenName ??
      data.user.email?.split('@')[0] ??
      'Player';
    await ensureProfile(data.user.id, name);
  }

  return data;
}

// ============================================
// Google Sign-In
// ============================================

export async function signInWithGoogle() {
  // Use Supabase OAuth flow — opens browser for Google sign-in
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'tribal-picks://auth/callback',
      skipBrowserRedirect: false,
    },
  });

  if (error) throw error;
  return data;
}

// ============================================
// Common
// ============================================

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export function onAuthStateChange(
  callback: (event: string, session: { user: { id: string; email?: string } } | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================
// Account Deletion
// ============================================

export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}

// ============================================
// Profile Updates
// ============================================

export async function updateDisplayName(userId: string, displayName: string) {
  const trimmed = displayName.trim();
  if (trimmed.length === 0 || trimmed.length > 30) {
    throw new Error('Display name must be 1-30 characters');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Helpers
// ============================================

async function ensureProfile(userId: string, displayName: string) {
  // Use upsert to avoid duplicates (e.g., if profile trigger already created one)
  const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') +
    Math.floor(Math.random() * 1000);

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username,
      display_name: displayName,
    },
    { onConflict: 'id' }
  );

  if (error) {
    // Username collision — try with more random digits
    const fallback = 'player' + Math.floor(Math.random() * 100000);
    await supabase.from('profiles').upsert(
      {
        id: userId,
        username: fallback,
        display_name: displayName,
      },
      { onConflict: 'id' }
    );
  }
}
