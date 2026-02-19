import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/useAuthStore';

export default function AuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const {
    signIn,
    signUp,
    signInApple,
    signInGoogle,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const handleEmailSubmit = async () => {
    if (isSignUp) {
      if (!username.trim()) return;
      await signUp(email.trim(), password, username.trim());
    } else {
      await signIn(email.trim(), password);
    }

    const user = useAuthStore.getState().user;
    if (user) {
      router.replace('/(tabs)');
    }
  };

  const handleApple = async () => {
    await signInApple();
    const user = useAuthStore.getState().user;
    if (user) {
      router.replace('/(tabs)');
    }
  };

  const handleGoogle = async () => {
    await signInGoogle();
    // Google OAuth redirects — auth state change handles navigation
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.title}>Tribal Picks</Text>
          <Text style={styles.subtitle}>Survivor Fantasy</Text>
        </View>

        {/* Social Sign-In Buttons */}
        <View style={styles.socialButtons}>
          {Platform.OS === 'ios' && (
            <Pressable
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleApple}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>
                {isSignUp ? 'Sign up with Apple' : 'Sign in with Apple'}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogle}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.socialButtonText}>
              {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email Form */}
        <View style={styles.form}>
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.emailButton, isLoading && styles.buttonDisabled]}
            onPress={handleEmailSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.emailButtonText}>
                {isSignUp ? 'Create Account' : 'Sign In with Email'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={toggleMode} style={styles.toggleButton}>
            <Text style={styles.toggleText}>
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
    marginTop: 4,
  },
  socialButtons: {
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  socialButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a4e',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  emailButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emailButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#ff4757',
    fontSize: 14,
    textAlign: 'center',
  },
  toggleButton: {
    alignItems: 'center',
    padding: 12,
  },
  toggleText: {
    color: '#e94560',
    fontSize: 14,
  },
});
