import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useMonetizationStore } from '../stores/useMonetizationStore';
import { AD_UNIT_IDS } from '../services/admob/client';

export default function AdBanner() {
  const isPremium = useMonetizationStore((s) => s.isPremium);

  if (isPremium) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_IDS.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
});
