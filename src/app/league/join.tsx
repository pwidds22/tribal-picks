import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { joinLeagueByCode } from '../../services/supabase/queries';

export default function JoinLeagueScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const handleJoin = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setIsLoading(true);
    try {
      const league = await joinLeagueByCode(code.trim(), user.id);
      Alert.alert('Joined!', `Welcome to ${league.name}`, [
        { text: 'OK', onPress: () => router.replace(`/league/${league.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Enter Invite Code</Text>
      <Text style={styles.subtext}>
        Get the 6-character code from your league commissioner
      </Text>

      <TextInput
        style={styles.input}
        placeholder="ABC123"
        placeholderTextColor="#666"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={6}
        autoCorrect={false}
      />

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Join League</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    padding: 20,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 20,
    fontSize: 28,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  button: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
