import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../supabase/client';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Ask for permission (iOS only prompts once) and store this device's Expo
 * push token for the signed-in user. Safe to call on every launch.
 * Never throws — push is a nice-to-have and must not break app start.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    registeredToken = token;

    // RPC (not a table upsert) so a device can move between accounts
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  } catch {
    // Simulator, denied permission, or network — try again next launch
  }
}

/** Stop pushes to this device for the current user (call before sign-out). */
export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await supabase.from('push_tokens').delete().eq('token', token);
}

/** Route to open when a notification is tapped (set as data.route when sending). */
export function addNotificationTapListener(onRoute: (route: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === 'string') onRoute(route);
  });
  return () => sub.remove();
}
