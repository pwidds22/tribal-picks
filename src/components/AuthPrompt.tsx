import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function AuthPrompt({ message, icon = 'flame' }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={40} color="#e94560" />
      </View>
      <Text style={styles.title}>Tribal Picks</Text>
      <Text style={styles.subtitle}>
        {message ?? 'Sign in to save your picks, join leagues, and compete with friends.'}
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
      >
        <Text style={styles.primaryButtonText}>Create Account</Text>
      </Pressable>
      <Pressable
        style={styles.signInButton}
        onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin' } })}
      >
        <Text style={styles.signInText}>
          Already have an account? <Text style={styles.signInLink}>Sign In</Text>
        </Text>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e94560',
  },
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
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signInButton: {
    paddingVertical: 8,
  },
  signInText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  signInLink: {
    color: '#e94560',
    fontWeight: '600',
  },
});
