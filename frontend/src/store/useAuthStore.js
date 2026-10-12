import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,

      login: (token, user) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isAdmin: Boolean(user?.is_staff || user?.is_superuser),
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isAdmin: false,
        });
      },

      updateUser: (user) => {
        set({
          user,
          isAdmin: Boolean(user?.is_staff || user?.is_superuser),
        });
      },
    }),
    {
      name: 'ecommerce-auth',
    }
  )
);
