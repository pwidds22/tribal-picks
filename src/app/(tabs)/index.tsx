import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tribal Picks</Text>
        <Text style={styles.subtitle}>Survivor Fantasy</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Season 50</Text>
          <Text style={styles.cardSubtitle}>In the Hands of the Fans</Text>
          <Text style={styles.cardDetail}>Premieres February 25, 2026</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Leagues</Text>
          <Text style={styles.cardDetail}>
            Join or create a league to get started!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e94560',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#e94560',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 14,
    color: '#a0a0a0',
  },
});
