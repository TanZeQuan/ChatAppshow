// chatStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from './userStore';

type Message = {
  id: string;
  text: string;
  createdAt: string;

  // Auto-fill
  senderId: string;
  username?: string;
  avatar?: string;
};

type Settings = {
  notifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showPreview: boolean;
};

type ChatStore = {
  chats: Record<string, Message[]>;
  settings: Settings;

  addMessage: (chatId: string, text: string) => void;
  clearChat: (chatId: string) => void;
  clearAllChats: () => void;
  updateSettings: (newSettings: Partial<Settings>) => void;
  getLastMessage: (chatId: string) => Message | null;
  getTotalMessages: () => number;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},
      settings: {
        notifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
        showPreview: true,
      },

      // ⭐ addMessage 自动取 userStore 的用户
      addMessage: (chatId, text) => {
        const user = useUserStore.getState().user;
        if (!user) return;

        const newMessage: Message = {
          id: Math.random().toString(),
          text,
          createdAt: new Date().toISOString(),
          senderId: user.id,
          username: user.username,
          avatar: user.avatar,
        };

        const current = get().chats[chatId] || [];

        set({
          chats: {
            ...get().chats,
            [chatId]: [...current, newMessage],
          },
        });
      },

      clearChat: (chatId) => {
        const chats = { ...get().chats };
        delete chats[chatId];
        set({ chats });
      },

      clearAllChats: () => set({ chats: {} }),

      updateSettings: (newSettings) =>
        set({
          settings: {
            ...get().settings,
            ...newSettings,
          },
        }),

      getLastMessage: (chatId) => {
        const messages = get().chats[chatId] || [];
        return messages.length ? messages[messages.length - 1] : null;
      },

      getTotalMessages: () => {
        return Object.values(get().chats).reduce(
          (total, arr) => total + arr.length,
          0
        );
      },
    }),

    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
