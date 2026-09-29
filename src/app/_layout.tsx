import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/useAuthStore';
import {
  addNotificationTapListener,
  registerForPushNotifications,
} from '../services/notifications/push';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authReady = useAuthStore((s) => s.authReady);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // Register for pushes once signed in (fire-and-forget; never blocks the UI)
  useEffect(() => {
    if (userId && authReady) registerForPushNotifications();
  }, [userId, authReady]);

  useEffect(
    () => addNotificationTapListener((route) => router.push(route as never)),
    [],
  );

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
          name="welcome"
          options={{ headerShown: false, animation: 'fade' }}
        />
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
        <Stack.Screen
          name="league/[id]"
          options={{
            title: 'League',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Ionicons name="chevron-back" size={28} color="#e94560" />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="game/bracket"
          options={{
            title: 'Elimination Bracket',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Ionicons name="chevron-back" size={28} color="#e94560" />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="game/pool"
          options={{
            title: 'Survivor Pool',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Ionicons name="chevron-back" size={28} color="#e94560" />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="game/user-picks"
          options={{
            title: 'Player Picks',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Ionicons name="chevron-back" size={28} color="#e94560" />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="castaway/[id]"
          options={{ title: 'Castaway', presentation: 'modal' }}
        />
        <Stack.Screen
          name="join/[code]"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}
