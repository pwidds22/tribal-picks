import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Slide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const slides: Slide[] = [
  {
    id: '1',
    icon: 'flame',
    title: 'The Fantasy Game\nfor Survivor Fans',
    description:
      'Predict eliminations, draft castaways, and compete with friends all season long.',
  },
  {
    id: '2',
    icon: 'trophy',
    title: 'Two Ways to Play',
    description:
      'Elimination Bracket \u2014 predict the full boot order.\n\nSurvivor Pool \u2014 pick one castaway to survive each week. If they\u2019re voted out, you\u2019re out.',
  },
  {
    id: '3',
    icon: 'people',
    title: 'Create Leagues.\nCompete with Friends.',
    description:
      'Start a private league, invite your watch party, and see who comes out on top.',
  },
];

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Slide>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleGetStarted = () => {
    router.replace({ pathname: '/auth', params: { mode: 'signup' } });
  };

  const handleSignIn = () => {
    router.replace({ pathname: '/auth', params: { mode: 'signin' } });
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    }
  };

  const isLastSlide = activeIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={64} color="#e94560" />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Bottom CTAs */}
      <View style={styles.bottomContainer}>
        {isLastSlide ? (
          <>
            <Pressable style={styles.primaryButton} onPress={handleGetStarted}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
            <Pressable style={styles.signInButton} onPress={handleSignIn}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign In</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Next</Text>
            </Pressable>
            <Pressable style={styles.signInButton} onPress={handleSignIn}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign In</Text>
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#e94560',
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  slideDescription: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a2a4e',
  },
  dotActive: {
    backgroundColor: '#e94560',
    width: 24,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInButton: {
    alignItems: 'center',
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
});
