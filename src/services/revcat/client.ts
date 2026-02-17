import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVCAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVCAT_IOS_API_KEY ?? '';

let initialized = false;

export function configureRevenueCat(userId?: string): void {
  if (initialized) return;
  if (!REVCAT_IOS_API_KEY) {
    console.warn('RevenueCat API key missing. Set EXPO_PUBLIC_REVCAT_IOS_API_KEY in .env');
    return;
  }

  if (Platform.OS !== 'ios') return;

  Purchases.configure({
    apiKey: REVCAT_IOS_API_KEY,
    appUserID: userId ?? undefined,
  });
  initialized = true;
}

export async function loginRevenueCat(userId: string): Promise<void> {
  if (!initialized) return;
  await Purchases.logIn(userId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!initialized) return;
  await Purchases.logOut();
}
