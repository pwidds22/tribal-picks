import {
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from './client';

let interstitial: InterstitialAd | null = null;
let isLoaded = false;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5_000;

function scheduleRetry(): void {
  if (retryCount >= MAX_RETRIES) return;
  const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
  retryCount++;
  retryTimeout = setTimeout(() => {
    interstitial?.load();
  }, delay);
}

function createInterstitial(): void {
  interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL);

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
    retryCount = 0;
  });

  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    isLoaded = false;
    retryCount = 0;
    interstitial?.load();
  });

  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
    scheduleRetry();
  });

  interstitial.load();
}

export function preloadInterstitial(): void {
  if (!interstitial) {
    createInterstitial();
  }
}

export function showInterstitial(): boolean {
  if (isLoaded && interstitial) {
    interstitial.show();
    return true;
  }
  return false;
}
