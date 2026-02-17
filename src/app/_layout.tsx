import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/useAuthStore';
import { useMonetizationStore } from '../stores/useMonetizationStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const initMonetization = useMonetizationStore((s) => s.initialize);
  const syncUser = useMonetizationStore((s) => s.syncUser);
  const syncLogout = useMonetizationStore((s) => s.syncLogout);

  useEffect(() => {
    const unsubscribe = initialize();
    initMonetization();
    return unsubscribe;
  }, [initialize]);

  // Sync RevenueCat user when auth changes
  useEffect(() => {
    if (user) {
      syncUser(user.id);
    } else {
      syncLogout();
    }
  }, [user?.id]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#e94560',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0f0f23' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{ title: 'Sign In', headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="league/create"
          options={{ title: 'Create League', presentation: 'modal' }}
        />
        <Stack.Screen
          name="league/join"
          options={{ title: 'Join League', presentation: 'modal' }}
        />
        <Stack.Screen name="league/[id]" options={{ title: 'League' }} />
        <Stack.Screen
          name="game/bracket"
          options={{ title: 'Elimination Bracket' }}
        />
        <Stack.Screen name="game/pool" options={{ title: 'Survivor Pool' }} />
        <Stack.Screen
          name="castaway/[id]"
          options={{ title: 'Castaway', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
