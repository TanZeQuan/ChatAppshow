// userStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatStore } from './chatStore';
import { useContactStore } from './contactStore';

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
        console.log('🔴 Logging out - clearing all stores');

        // Clear user store
        set({
          user: null,
          token: null,
          isLoggedIn: false,
        });

        // Clear chat store
        const { clearAllChats } = useChatStore.getState();
        clearAllChats();
        console.log('✅ Chat store cleared');

        // Clear contact store
        const { clearContacts, clearFriendRequests } = useContactStore.getState();
        clearContacts();
        clearFriendRequests();
        console.log('✅ Contact store cleared');

        console.log('✅ All stores cleared successfully');
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
