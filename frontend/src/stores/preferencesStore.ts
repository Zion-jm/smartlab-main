import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserPreferences = {
  ribbonControlsHiddenByDefault: boolean;
  sidebarCollapsedByDefault: boolean;
};

const defaultPreferences: UserPreferences = {
  ribbonControlsHiddenByDefault: false,
  sidebarCollapsedByDefault: false,
};

type PreferencesState = {
  preferencesByUser: Record<string, UserPreferences>;
  setPreference: <K extends keyof UserPreferences>(userId: string, key: K, value: UserPreferences[K]) => void;
  resetPreferences: (userId: string) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferencesByUser: {},
      setPreference: (userId, key, value) =>
        set((state) => ({
          preferencesByUser: {
            ...state.preferencesByUser,
            [userId]: {
              ...defaultPreferences,
              ...state.preferencesByUser[userId],
              [key]: value,
            },
          },
        })),
      resetPreferences: (userId) =>
        set((state) => {
          const nextPreferences = { ...state.preferencesByUser };
          delete nextPreferences[userId];
          return { preferencesByUser: nextPreferences };
        }),
    }),
    {
      name: 'smartlab-preferences',
    },
  ),
);

export const getUserPreferences = (
  preferencesByUser: Record<string, UserPreferences>,
  userId: string,
): UserPreferences => ({
  ...defaultPreferences,
  ...preferencesByUser[userId],
});