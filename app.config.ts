import { ExpoConfig, ConfigContext } from 'expo/config';

const ADMOB_IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const ADMOB_ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tribal Picks: Survivor Fantasy',
  slug: 'tribal-picks',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  scheme: 'tribal-picks',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a2e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tribalpicks.survivorfantasy',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-apple-authentication',
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_APP_ID || ADMOB_ANDROID_TEST_APP_ID,
        iosAppId: process.env.ADMOB_APP_ID || ADMOB_IOS_TEST_APP_ID,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '77491817-6fed-4197-9e2d-28c74bcb8d8a',
    },
  },
  owner: 'pwidds',
});
