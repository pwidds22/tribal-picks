import {
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from './client';

let interstitial: InterstitialAd | null = null;
let isLoaded = false;

function createInterstitial(): void {
  interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL);

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
  });

  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    isLoaded = false;
    // Preload next ad
    interstitial?.load();
  });

  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
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
