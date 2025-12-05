// chatStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from './userStore';

export type Message = {
  id: string;
  text: string;
  createdAt: string;

  // Auto-fill
  senderId: string;
  username?: string;
  avatar?: string;
};

type ChatListItem = {
  id: string;
  name: string;
  avatar: string | null;
  isGroup: boolean;
  members?: any[];
  memberIds?: string[];
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
};

type Settings = {
  notifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showPreview: boolean;
};

type ChatStore = {
  chats: Record<string, Message[]>;
  chatList: ChatListItem[];
  settings: Settings;

  addMessage: (chatId: string, text: string) => void;
  addChat: (chat: ChatListItem) => void;
  updateChatLastMessage: (chatId: string, message: string, timestamp: string) => void;
  removeChat: (chatId: string) => void;
  getChatById: (chatId: string) => ChatListItem | undefined;
  clearChat: (chatId: string) => void;
  clearAllChats: () => void;
  updateSettings: (newSettings: Partial<Settings>) => void;
  getLastMessage: (chatId: string) => Message | null;
  getTotalMessages: () => number;
  markAsRead: (chatId: string) => void;
  incrementUnread: (chatId: string) => void;
  setMessagesForChat: (chatId: string, messages: Message[]) => void; // Add setMessagesForChat

};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},
      chatList: [],
      settings: {
        notifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
        showPreview: true,
      },

      setMessagesForChat: (chatId, messages) => { // Implementation for setMessagesForChat
        set(state => ({
          chats: {
            ...state.chats,
            [chatId]: messages,
          }
        }));
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

        // Update chat list with last message
        get().updateChatLastMessage(chatId, text, newMessage.createdAt);
      },

      // ⭐ Add new chat to chat list (for groups or new conversations)
      addChat: (chat) => {
        const currentChatList = get().chatList;
        
        // Check if chat already exists
        const existingIndex = currentChatList.findIndex(c => c.id === chat.id);
        
        if (existingIndex !== -1) {
          // Update existing chat
          const updatedChatList = [...currentChatList];
          updatedChatList[existingIndex] = {
            ...updatedChatList[existingIndex],
            ...chat,
          };
          set({ chatList: updatedChatList });
        } else {
          // Add new chat to the top of the list
          set({
            chatList: [chat, ...currentChatList],
          });
        }
      },

      // ⭐ Update last message in chat list
      updateChatLastMessage: (chatId, message, timestamp) => {
        const currentChatList = get().chatList;
        const chatIndex = currentChatList.findIndex(c => c.id === chatId);
        
        if (chatIndex !== -1) {
          const updatedChatList = [...currentChatList];
          const chat = updatedChatList[chatIndex];
          
          // Update chat
          updatedChatList[chatIndex] = {
            ...chat,
            lastMessage: message,
            timestamp: timestamp,
          };
          
          // Move to top of list
          const [movedChat] = updatedChatList.splice(chatIndex, 1);
          updatedChatList.unshift(movedChat);
          
          set({ chatList: updatedChatList });
        }
      },

      // ⭐ Remove chat from list
      removeChat: (chatId) => {
        const currentChatList = get().chatList;
        set({
          chatList: currentChatList.filter(c => c.id !== chatId),
        });
        
        // Also clear messages
        get().clearChat(chatId);
      },

      // ⭐ Get chat by ID
      getChatById: (chatId) => {
        return get().chatList.find(c => c.id === chatId);
      },

      // ⭐ Mark chat as read
      markAsRead: (chatId) => {
        const currentChatList = get().chatList;
        const chatIndex = currentChatList.findIndex(c => c.id === chatId);
        
        if (chatIndex !== -1) {
          const updatedChatList = [...currentChatList];
          updatedChatList[chatIndex] = {
            ...updatedChatList[chatIndex],
            unreadCount: 0,
          };
          set({ chatList: updatedChatList });
        }
      },

      // ⭐ Increment unread count
      incrementUnread: (chatId) => {
        const currentChatList = get().chatList;
        const chatIndex = currentChatList.findIndex(c => c.id === chatId);
        
        if (chatIndex !== -1) {
          const updatedChatList = [...currentChatList];
          updatedChatList[chatIndex] = {
            ...updatedChatList[chatIndex],
            unreadCount: updatedChatList[chatIndex].unreadCount + 1,
          };
          set({ chatList: updatedChatList });
        }
      },

      clearChat: (chatId) => {
        const chats = { ...get().chats };
        delete chats[chatId];
        set({ chats });
      },

      clearAllChats: () => set({ chats: {}, chatList: [] }),

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