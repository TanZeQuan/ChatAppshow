import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type User = {
  email: string;
  name: string;
  id: string;
  username: string;
  avatar?: string;
};

type UserStore = {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;

  // actions
  setUser: (user: User, token: string) => void;
  logout: () => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoggedIn: false,

      setUser: (user, token) =>
        set({
          user,
          token,
          isLoggedIn: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isLoggedIn: false,
        }),
    }),

    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
