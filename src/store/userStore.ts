// userStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatStore } from './chatStore';
import { useContactStore } from './contactStore';
import WebSocketManager from '../services/WebSocketManager';

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
  logout: () => Promise<void>; // ⭐ Changed to async
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

      logout: async () => {
        console.log('🔴 [userStore] Logging out - clearing all stores');

        // 🔌 Disconnect WebSocket FIRST
        WebSocketManager.disconnect();

        // Clear user store
        set({
          user: null,
          token: null,
          isLoggedIn: false,
        });

        // Clear chat store
        const { clearAllChats } = useChatStore.getState();
        clearAllChats();

        // Clear contact store
        const { clearContacts, clearFriendRequests } = useContactStore.getState();
        clearContacts();
        clearFriendRequests();

        // Verify AsyncStorage was actually cleared
        try {
          const userStorageCheck = await AsyncStorage.getItem('user-storage');
          const chatStorageCheck = await AsyncStorage.getItem('chat-storage');

          if (userStorageCheck || chatStorageCheck) {
            console.error('⚠️ [userStore] Storage not fully cleared', {
              userStorage: !!userStorageCheck,
              chatStorage: !!chatStorageCheck
            });
          }
        } catch (error) {
          console.error('❌ [userStore] Failed to verify storage cleanup:', error);
        }
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
