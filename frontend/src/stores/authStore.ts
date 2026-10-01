import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          const { user, token } = response.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: unknown) {
          const apiError =
            error && typeof error === 'object' && 'response' in error
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : null;
          set({
            error: apiError || 'Login failed',
            isLoading: false,
          });
        }
      },

      refreshUser: async () => {
        try {
          const response = await authApi.getMe();
          const user = response.data?.user;
          if (user) {
            set({ user });
          }
        } catch (error) {
          console.error('Failed to refresh current user profile', error);
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

window.addEventListener('smartlab:session-invalid', () => useAuthStore.getState().logout());
