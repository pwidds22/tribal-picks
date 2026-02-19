import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase/client';
import type { Castaway } from '../../core/types';

export default function CastawayProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [castaway, setCastaway] = useState<Castaway | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadCastaway();
  }, [id]);

  const loadCastaway = async () => {
    const { data, error } = await supabase
      .from('castaways')
      .select('*')
      .eq('id', Number(id))
      .single();

    if (!error) setCastaway(data);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!castaway) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Castaway not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {castaway.photo_url ? (
          <Image source={{ uri: castaway.photo_url }} style={styles.photo} />
        ) : (
          <Text style={styles.emoji}>🏝️</Text>
        )}
        <Text style={styles.name}>{castaway.name}</Text>
        {castaway.tribe && (
          <Text style={styles.tribe}>{castaway.tribe}</Text>
        )}
      </View>

      <View style={styles.details}>
        {castaway.age && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Age</Text>
            <Text style={styles.detailValue}>{castaway.age}</Text>
          </View>
        )}
        {castaway.hometown && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hometown</Text>
            <Text style={styles.detailValue}>{castaway.hometown}</Text>
          </View>
        )}
        {castaway.occupation && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Occupation</Text>
            <Text style={styles.detailValue}>{castaway.occupation}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Text
            style={[
              styles.detailValue,
              castaway.is_eliminated
                ? styles.eliminated
                : styles.active,
            ]}
          >
            {castaway.is_eliminated ? 'Eliminated' : 'Still in the game'}
          </Text>
        </View>
      </View>
    </View>
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
    backgroundColor: '#0f0f23',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#1a1a2e',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
    backgroundColor: '#16213e',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tribe: {
    fontSize: 16,
    color: '#e94560',
    marginTop: 4,
    fontWeight: '600',
  },
  details: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  detailLabel: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  eliminated: {
    color: '#ff4757',
  },
  active: {
    color: '#2ed573',
  },
});
