import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  getActiveAnnouncement,
  type Announcement,
} from '../services/supabase/queries';

const DISMISSED_KEY = 'dismissed_announcement_id';

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ann = await getActiveAnnouncement();
        if (!ann || cancelled) return;

        // Check if user already dismissed this specific announcement
        const dismissedId = await AsyncStorage.getItem(DISMISSED_KEY);
        if (dismissedId === ann.id) return;

        if (!cancelled) {
          setAnnouncement(ann);
          setVisible(true);
        }
      } catch {
        // Silently fail — announcement is non-critical
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    if (announcement) {
      await AsyncStorage.setItem(DISMISSED_KEY, announcement.id);
    }
  }, [announcement]);

  const handleLink = useCallback(() => {
    if (announcement?.link_url) {
      Linking.openURL(announcement.link_url);
    }
  }, [announcement]);

  if (!visible || !announcement) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="megaphone-outline" size={18} color="#ffa502" />
        <View style={styles.textContainer}>
          <Text style={styles.message}>{announcement.message}</Text>
          {announcement.link_text && announcement.link_url && (
            <Pressable onPress={handleLink}>
              <Text style={styles.linkText}>{announcement.link_text}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <Pressable onPress={handleDismiss} hitSlop={12} style={styles.close}>
        <Ionicons name="close" size={16} color="#888" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a0e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a1e',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 13,
    color: '#e0e0e0',
    lineHeight: 18,
  },
  linkText: {
    fontSize: 13,
    color: '#ffa502',
    fontWeight: '600',
  },
  close: {
    padding: 2,
    marginLeft: 8,
  },
});
