import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

type Props = {
  message?: string;
};

export default function AuthPrompt({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔥</Text>
      <Text style={styles.title}>Welcome to Tribal Picks</Text>
      <Text style={styles.subtitle}>
        {message ?? 'Sign in to save your picks, join leagues, and compete with friends'}
      </Text>
      <Pressable style={styles.button} onPress={() => router.push('/auth')}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});
