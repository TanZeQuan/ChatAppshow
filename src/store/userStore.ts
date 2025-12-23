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
        console.log('💾 [userStore] Setting user:', JSON.stringify(user, null, 2));
        console.log('💾 [userStore] Setting token:', token ? '***' + token.slice(-10) : 'null');

        set({
          user,
          token,
          isLoggedIn: true,
        });
      },

      logout: async () => {
        console.log('🔴 [userStore] Logging out - clearing all stores');
        console.log('🔴 [userStore] Current user before logout:', useUserStore.getState().user);

        // 🔌 Disconnect WebSocket FIRST
        console.log('🔌 [userStore] Disconnecting WebSocket...');
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
        console.log('✅ [userStore] Chat store cleared');

        // Clear contact store
        const { clearContacts, clearFriendRequests } = useContactStore.getState();
        clearContacts();
        clearFriendRequests();
        console.log('✅ [userStore] Contact store cleared');

        // 🔍 Verify AsyncStorage was actually cleared
        try {
          const userStorageCheck = await AsyncStorage.getItem('user-storage');
          const chatStorageCheck = await AsyncStorage.getItem('chat-storage');
          console.log('🔍 [userStore] Verification after logout:');
          console.log('  - user-storage:', userStorageCheck ? 'STILL EXISTS ⚠️' : 'cleared ✅');
          console.log('  - chat-storage:', chatStorageCheck ? 'STILL EXISTS ⚠️' : 'cleared ✅');

          if (userStorageCheck) {
            console.log('  - user-storage content:', userStorageCheck);
          }
          if (chatStorageCheck) {
            console.log('  - chat-storage length:', chatStorageCheck.length, 'chars');
          }
        } catch (error) {
          console.error('❌ [userStore] Failed to verify storage cleanup:', error);
        }

        console.log('✅ [userStore] All stores cleared successfully');
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
