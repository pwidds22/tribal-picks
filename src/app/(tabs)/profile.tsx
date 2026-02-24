import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLeagueStore } from '../../stores/useLeagueStore';
import AuthPrompt from '../../components/AuthPrompt';

const PRIVACY_URL = 'https://peat-bow-b31.notion.site/Tribal-Picks-Privacy-Policy-30ca029843928019bbf8f0c48d82f5f3';
const TERMS_URL = 'https://peat-bow-b31.notion.site/Tribal-Picks-Terms-of-Use-30ca0298439280429aace6969ed81831';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const authLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const leagueCount = useLeagueStore((s) => s.leagues.length);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data (leagues, picks, scores). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This is your last chance. All data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (authLoading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <AuthPrompt icon="person" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>
              {profile?.username ?? 'Unknown'}
            </Text>
          </View>
          {profile?.display_name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{profile.display_name}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Leagues</Text>
            <Text style={styles.infoValue}>{leagueCount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={16} color="#a0a0a0" />
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            <Text style={styles.linkText}>Terms of Use</Text>
            <Ionicons name="open-outline" size={16} color="#a0a0a0" />
          </Pressable>
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  infoLabel: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  linkText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  signOutButton: {
    backgroundColor: '#2a2a4e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: '#ff4757',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  deleteText: {
    color: '#666',
    fontSize: 14,
  },
});
