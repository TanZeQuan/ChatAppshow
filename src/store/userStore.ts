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
  onlineUsers: string[];

  setUser: (user: User, token: string) => void;
  logout: () => Promise<void>;
  setOnlineUsers: (userIds: string[]) => void;
  updateUserOnlineStatus: (userId: string, isOnline: boolean) => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      onlineUsers: [],

      setUser: (user, token) => {
        set({
          user,
          token,
          isLoggedIn: true,
        });
      },

      setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

      updateUserOnlineStatus: (userId, isOnline) => {
        console.log(`[userStore] Updating status for ${userId}: ${isOnline}`);
        const { onlineUsers } = get();
        const userExists = onlineUsers.includes(userId);

        if (isOnline && !userExists) {
          set({ onlineUsers: [...onlineUsers, userId] });
        } else if (!isOnline && userExists) {
          set({ onlineUsers: onlineUsers.filter(id => id !== userId) });
        }
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
          onlineUsers: [], 
        });

        // Clear chat store
        const { clearAllChats } = useChatStore.getState();
        clearAllChats();

        // Clear contact store
        const { clearContacts, clearFriendRequests } = useContactStore.getState();
        clearContacts();
        clearFriendRequests();

        // ✅ Method 1: Wait for Zustand persist middleware to finish
        await new Promise(resolve => setTimeout(resolve, 100));

        // ✅ Method 2: Manually clear AsyncStorage to ensure complete cleanup
        try {
          await AsyncStorage.multiRemove([
            'user-storage',
            'chat-storage',
            'contact-storage',
            'friend-request-storage'
          ]);
          console.log('✅ [userStore] All storage keys manually removed');
        } catch (error) {
          console.error('❌ [userStore] Failed to remove storage keys:', error);
        }

        // Verify AsyncStorage was actually cleared
        try {
          const userStorageCheck = await AsyncStorage.getItem('user-storage');
          const chatStorageCheck = await AsyncStorage.getItem('chat-storage');

          if (userStorageCheck || chatStorageCheck) {
            console.error('⚠️ [userStore] Storage not fully cleared', {
              userStorage: !!userStorageCheck,
              chatStorage: !!chatStorageCheck
            });
          } else {
            console.log('✅ [userStore] Storage verification passed - all cleared');
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
