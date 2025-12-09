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
  name?: string;
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
  ownerId?: string; 
  unreadCount: number;
  online: boolean;
  rawData?: {
    push_notification?: boolean;
    top_notification?: boolean;
    show_nicknames?: boolean;
    // 你可以在这里加 ownerId
  };
  admins?: string[]; // 可选，保存管理员 ID
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
  setMessages: (chatId: string, messages: Message[]) => void; // ⭐ 新增
  addChat: (chat: ChatListItem) => void;
  setChats: (chats: ChatListItem[]) => void;
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

      // ⭐ addMessage 自动取 userStore 的用户
      addMessage: (chatId, text) => {
        const user = useUserStore.getState().user;
        if (!user) return;

        const newMessage: Message = {
          id: Math.random().toString(),
          text,
          createdAt: new Date().toISOString(),
          senderId: user.id,
          name: user.name,
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

      // ⭐ 新增：直接设置某个聊天的所有消息（用于 API 加载）
      setMessages: (chatId, messages) => {
        set({
          chats: {
            ...get().chats,
            [chatId]: messages,
          },
        });

        // 如果有消息，更新聊天列表的最后一条消息
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          get().updateChatLastMessage(chatId, lastMsg.text, lastMsg.createdAt);
        }
      },

      // ⭐ Add new chat to chat list (for groups or new conversations)
      addChat: (chat) => {
        const currentChatList = get().chatList;

        let processedChat = { ...chat };

        // Process group members to determine ownerId and admins if it's a group and members exist
        if (processedChat.isGroup && processedChat.members && processedChat.members.length > 0) {
            let ownerFound = false;
            let adminIds: string[] = [];
            
            // Assuming the API sends GroupMember type here, where isadmin: 2 is admin/owner
            for (const member of processedChat.members) {
                if (member.isadmin === 2) {
                    adminIds.push(member.user_id);
                    // For simplicity, let's assume the first isadmin:2 found is the owner if ownerId is not explicitly set
                    if (!processedChat.ownerId) {
                        processedChat.ownerId = member.user_id; // Assign first admin as owner if not specified
                    }
                }
            }
            // If ownerId was not set, and there are admins, assign the first admin as owner (heuristic)
            if (!processedChat.ownerId && adminIds.length > 0) {
                processedChat.ownerId = adminIds[0];
            }
            // Filter out the owner from admins if ownerId is distinct
            processedChat.admins = adminIds.filter(id => id !== processedChat.ownerId);

            // Also ensure rawData.ownerId is set if it's a group
            if (processedChat.isGroup && processedChat.ownerId && !processedChat.rawData?.ownerId) {
                processedChat.rawData = {
                    ...processedChat.rawData,
                    ownerId: processedChat.ownerId,
                };
            }
        }

        // Check if chat already exists
        const existingIndex = currentChatList.findIndex(c => c.id === processedChat.id);

        if (existingIndex !== -1) {
          // Update existing chat
          const updatedChatList = [...currentChatList];
          updatedChatList[existingIndex] = {
            ...updatedChatList[existingIndex],
            ...processedChat, // Use processedChat here
          };
          set({ chatList: updatedChatList });
        } else {
          // Add new chat to the top of the list
          set({
            chatList: [processedChat, ...currentChatList], // Use processedChat here
          });
        }
      },

      // ⭐ Set all chats (for API bulk updates)
      setChats: (chats) => {
        set({ chatList: chats });
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