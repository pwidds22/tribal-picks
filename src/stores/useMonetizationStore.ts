import { create } from 'zustand';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  configureRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
} from '../services/revcat/client';
import {
  checkPremiumStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../services/revcat/subscriptions';
import { preloadInterstitial, showInterstitial } from '../services/admob/ads';

type MonetizationState = {
  isPremium: boolean;
  offerings: PurchasesPackage[];
  isLoading: boolean;
  error: string | null;
  initialize: (userId?: string) => Promise<void>;
  syncUser: (userId: string) => Promise<void>;
  syncLogout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  showAd: () => boolean;
  clearError: () => void;
};

export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  isPremium: false,
  offerings: [],
  isLoading: false,
  error: null,

  initialize: async (userId) => {
    configureRevenueCat(userId);
    const isPremium = await checkPremiumStatus();
    set({ isPremium });

    // Preload interstitial for free users
    if (!isPremium) {
      preloadInterstitial();
    }
  },

  syncUser: async (userId) => {
    await loginRevenueCat(userId);
    const isPremium = await checkPremiumStatus();
    set({ isPremium });
    if (!isPremium) {
      preloadInterstitial();
    }
  },

  syncLogout: async () => {
    await logoutRevenueCat();
    set({ isPremium: false, offerings: [] });
  },

  refreshStatus: async () => {
    const isPremium = await checkPremiumStatus();
    set({ isPremium });
  },

  loadOfferings: async () => {
    set({ isLoading: true, error: null });
    try {
      const offerings = await getOfferings();
      set({ offerings, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  purchase: async (pkg) => {
    set({ isLoading: true, error: null });
    try {
      const isPremium = await purchasePackage(pkg);
      set({ isPremium, isLoading: false });
      return isPremium;
    } catch (err: any) {
      // User cancelled purchase is not an error
      if (err.userCancelled) {
        set({ isLoading: false });
        return false;
      }
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  restore: async () => {
    set({ isLoading: true, error: null });
    try {
      const isPremium = await restorePurchases();
      set({ isPremium, isLoading: false });
      return isPremium;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  showAd: () => {
    if (get().isPremium) return false;
    return showInterstitial();
  },

  clearError: () => set({ error: null }),
}));
