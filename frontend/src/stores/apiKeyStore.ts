import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeyState {
  apiKey: string | null;
  isValidated: boolean;

  // Actions
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setValidated: (validated: boolean) => void;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: null,
      isValidated: false,

      setApiKey: (key) => set({ apiKey: key, isValidated: true }),

      clearApiKey: () => set({ apiKey: null, isValidated: false }),

      setValidated: (validated) => set({ isValidated: validated }),
    }),
    {
      name: 'nana-api-key-storage',
    }
  )
);
