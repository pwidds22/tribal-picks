import { TestIds } from 'react-native-google-mobile-ads';

const envBannerId = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? '';
const envInterstitialId = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? '';

// Use test IDs in dev, real IDs in production
const isDev = __DEV__;

export const AD_UNIT_IDS = {
  BANNER: isDev || !envBannerId ? TestIds.BANNER : envBannerId,
  INTERSTITIAL: isDev || !envInterstitialId ? TestIds.INTERSTITIAL : envInterstitialId,
} as const;
