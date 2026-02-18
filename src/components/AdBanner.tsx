import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useMonetizationStore } from '../stores/useMonetizationStore';

export default function AdBanner() {
  const isPremium = useMonetizationStore((s) => s.isPremium);
  const bannerUnitId = useMonetizationStore((s) => s.bannerUnitId);
  const [loaded, setLoaded] = useState(false);

  if (isPremium) return null;

  return (
    <View style={loaded ? styles.container : styles.hidden}>
      <BannerAd
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});
