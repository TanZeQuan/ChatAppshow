import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

type ChatStore = {
  chats: Record<string, Message[]>; // 保存每个用户/群的聊天记录

  addMessage: (chatId: string, message: Message) => void;
  clearChat: (chatId: string) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},

      addMessage: (chatId, message) => {
        const current = get().chats[chatId] || [];
        set({
          chats: {
            ...get().chats,
            [chatId]: [...current, message],
          },
        });
      },

      clearChat: (chatId) => {
        const chats = { ...get().chats };
        delete chats[chatId];
        set({ chats });
      },
    }),

    {
      name: 'chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
