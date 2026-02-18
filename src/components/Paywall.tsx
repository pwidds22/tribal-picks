import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useMonetizationStore } from '../stores/useMonetizationStore';

type PaywallProps = {
  visible: boolean;
  onClose: () => void;
};

export default function Paywall({ visible, onClose }: PaywallProps) {
  const { offerings, isLoading, error, isPremium, loadOfferings, purchase, restore, clearError } =
    useMonetizationStore();

  useEffect(() => {
    if (visible) {
      loadOfferings();
      clearError();
    }
  }, [visible, loadOfferings, clearError]);

  // Auto-close on successful purchase
  useEffect(() => {
    if (isPremium && visible) {
      onClose();
    }
  }, [isPremium, visible, onClose]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    await purchase(pkg);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>

        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>Remove all ads for a clean experience</Text>

        <View style={styles.features}>
          <Text style={styles.feature}>No banner ads</Text>
          <Text style={styles.feature}>No interstitial ads</Text>
          <Text style={styles.feature}>Support indie development</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#e94560" style={styles.loader} />
        ) : offerings.length > 0 ? (
          <View style={styles.packages}>
            {offerings.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                style={styles.packageButton}
                onPress={() => handlePurchase(pkg)}
              >
                <Text style={styles.packageTitle}>
                  {pkg.product.title}
                </Text>
                <Text style={styles.packagePrice}>
                  {pkg.product.priceString}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            No subscription options available right now.
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.restoreButton} onPress={restore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    padding: 24,
    paddingTop: 60,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  closeText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  features: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    gap: 12,
  },
  feature: {
    fontSize: 16,
    color: '#2ed573',
  },
  packages: {
    gap: 12,
  },
  packageButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  empty: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 20,
  },
  error: {
    fontSize: 14,
    color: '#ff4757',
    textAlign: 'center',
    marginTop: 16,
  },
  loader: {
    marginTop: 20,
  },
  restoreButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 12,
  },
  restoreText: {
    color: '#a0a0a0',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
