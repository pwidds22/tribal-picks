// AdMob disabled for v1.0 launch — will re-enable post-release with ATT prompt

export async function initializeAds(): Promise<void> {
  // no-op: AdMob not active
}

export async function preloadInterstitial(): Promise<void> {
  // no-op: AdMob not active
}

export function showInterstitial(): boolean {
  return false;
}
