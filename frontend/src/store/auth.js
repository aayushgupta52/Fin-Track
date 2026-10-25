import { create } from 'zustand';

// Auth state lives in memory only — the access token is never persisted to
// localStorage (the refresh token is an httpOnly cookie). On reload we silently
// re-authenticate via the refresh endpoint (see App bootstrap).
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  status: 'loading', // 'loading' | 'authenticated' | 'anonymous'

  setSession: ({ user, accessToken }) =>
    set({ user, accessToken, status: 'authenticated' }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setUser: (user) => set({ user }),

  setStatus: (status) => set({ status }),

  clear: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
