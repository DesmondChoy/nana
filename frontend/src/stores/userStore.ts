import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, TopicMastery } from '../types';

interface UserState {
  profile: UserProfile | null;
  topicMastery: Record<string, TopicMastery>;

  // Actions
  setProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  updateTopicMastery: (topic: string, delta: number) => void;
  resetMastery: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      topicMastery: {},

      setProfile: (profile) => set({ profile }),

      clearProfile: () => set({ profile: null }),

      updateTopicMastery: (topic, delta) =>
        set((state) => {
          const existing = state.topicMastery[topic];
          const newScore = existing
            ? Math.max(0, Math.min(1, existing.score + delta))
            : Math.max(0, Math.min(1, 0.5 + delta)); // Default start at 0.5

          return {
            topicMastery: {
              ...state.topicMastery,
              [topic]: {
                score: newScore,
                attempts: (existing?.attempts ?? 0) + 1,
                last_updated: new Date().toISOString(),
              },
            },
          };
        }),

      resetMastery: () => set({ topicMastery: {} }),
    }),
    {
      name: 'nana-user-storage',
    }
  )
);
