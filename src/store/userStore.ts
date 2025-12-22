// userStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type User = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  about?: string;
};

type UserStore = {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;

  setUser: (user: User, token: string) => void;
  logout: () => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoggedIn: false,

      setUser: (user, token) => {
        set({
          user,
          token,
          isLoggedIn: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isLoggedIn: false,
        });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
