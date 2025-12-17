// userStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSocketManager from '../services/WebSocketManager';

type User = {
  about: string | undefined;
  id: string;          
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
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

        // Initialize WebSocket connection after login
        console.log('🔌 Initializing WebSocket connection for user:', user.id);
        WebSocketManager.connect(user.id)
          .then(() => {
            console.log('✅ WebSocket connected successfully');
          })
          .catch((error) => {
            console.error('❌ WebSocket connection failed:', error);
          });
      },

      logout: () => {
        // Disconnect WebSocket before logout
        console.log('🔌 Disconnecting WebSocket');
        WebSocketManager.logout()
          .then(() => {
            console.log('✅ WebSocket disconnected successfully');
          })
          .catch((error) => {
            console.error('❌ WebSocket disconnect failed:', error);
          });

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
