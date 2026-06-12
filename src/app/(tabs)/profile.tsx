import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Alert, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
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
  const signingOut = useAuthStore((s) => s.signingOut);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const leagueCount = useLeagueStore((s) => s.leagues.length);
  const fetchLeagues = useLeagueStore((s) => s.fetchLeagues);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch leagues when Profile tab gains focus (don't rely solely on Home tab)
  const authReady = useAuthStore((s) => s.authReady);
  useFocusEffect(
    useCallback(() => {
      if (user && authReady) fetchLeagues(user.id);
    }, [user, authReady, fetchLeagues]),
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('Sign Out Failed', 'Something went wrong. Please try again.');
    }
  };

  const handleEditName = () => {
    setNameInput(profile?.display_name ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length > 30) {
      Alert.alert('Invalid Name', 'Display name must be 1-30 characters.');
      return;
    }
    setSaving(true);
    try {
      await updateDisplayName(trimmed);
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to update display name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Pressable style={styles.infoRow} onPress={handleEditName}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <View style={styles.editableValue}>
              <Text style={styles.infoValue}>
                {profile?.display_name || 'Set name'}
              </Text>
              <Ionicons name="pencil" size={14} color="#a0a0a0" style={{ marginLeft: 6 }} />
            </View>
          </Pressable>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>
              {profile?.username ?? 'Unknown'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {user.email}
            </Text>
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

        {authError ? (
          <Pressable style={styles.errorBanner} onPress={clearError}>
            <Ionicons name="alert-circle" size={16} color="#ff4757" />
            <Text style={styles.errorText}>{authError}</Text>
            <Ionicons name="close" size={16} color="#a0a0a0" />
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#ff4757" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={18} color="#ff4757" style={styles.deleteIcon} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingName(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit Display Name</Text>
            <Text style={styles.modalSubtitle}>
              This is how other players see you in leagues and leaderboards.
            </Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your display name"
              placeholderTextColor="#666"
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <Text style={styles.charCount}>{nameInput.trim().length}/30</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
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
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#ff4757',
    fontSize: 13,
  },
  signOutButton: {
    backgroundColor: '#2a2a4e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: '#ff4757',
    fontWeight: 'bold' as const,
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff4757',
    paddingVertical: 14,
    marginTop: 12,
  },
  deleteIcon: {
    marginRight: 8,
  },
  deleteText: {
    color: '#ff4757',
    fontWeight: 'bold' as const,
    fontSize: 16,
  },
  editableValue: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%' as const,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#ffffff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4e',
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right' as const,
    marginTop: 4,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    color: '#a0a0a0',
    fontWeight: '600' as const,
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold' as const,
    fontSize: 16,
  },
});
