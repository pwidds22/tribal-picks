import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.cardDetail}>Sign in to save your picks and leagues</Text>
          <Pressable style={styles.signInButton}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          <Text style={styles.cardDetail}>Free (with ads)</Text>
          <Pressable style={styles.upgradeButton}>
            <Text style={styles.upgradeText}>Remove Ads</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#e94560',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  signInText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  upgradeButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#e94560',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeText: {
    color: '#e94560',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
