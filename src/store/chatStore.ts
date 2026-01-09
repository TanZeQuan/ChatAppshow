// chatStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useUserStore } from './userStore';

type Message = {
  readBy: never[];
  id: string;
  text: string;
  createdAt: string;
  type?: number; // 1: text, 2: voice, 3: image/files
  imageUrls?: string[]; // For type 3 messages
  voiceUrl?: string; // For type 2 messages

  // Sender info
  senderId: string;
  name?: string;  // ⚠️ Deprecated: Use memberCache instead
  avatar?: string; // ⚠️ Deprecated: Use memberCache instead
};

// ✅ Member info cache type
type MemberInfo = {
  name: string;
  avatar: string;
  cachedAt: number; // Timestamp when cached
};

export type ChatListItem = {
  type: number;
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
  online: boolean; // ⚠️ Not currently used - can be removed if not needed
  rawData?: {
    push_notification?: boolean;
    top_notification?: boolean;
    show_nicknames?: boolean;
    ownerId?: string;
  };
  admins?: string[];
};

type ChatStore = {
  chats: Record<string, Message[]>;
  chatList: ChatListItem[];
  memberCache: Record<string, MemberInfo>; // ✅ Global member info cache

  addMessage: (message: Partial<Message> & { chatId: string }) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addChat: (chat: ChatListItem) => void;
  setChats: (chats: ChatListItem[]) => void;
  updateChatLastMessage: (chatId: string, message: Message) => void;
  removeChat: (chatId: string) => void;
  getChatById: (chatId: string) => ChatListItem | undefined;
  clearChat: (chatId: string) => void;
  clearAllChats: () => void;
  getLastMessage: (chatId: string) => Message | null;
  // ❌ Removed: markAsRead and incrementUnread (now API-driven)

  // ✅ Member cache management
  getMemberInfo: (userId: string) => MemberInfo | undefined;
  setMemberInfo: (userId: string, info: Omit<MemberInfo, 'cachedAt'>) => void;
  clearMemberCache: () => void;
  clearExpiredMemberCache: (maxAgeMs?: number) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},
      chatList: [],
      memberCache: {}, // ✅ Initialize member cache

      // ⭐ Refactored addMessage to accept a message object
      addMessage: (message) => {
        const user = useUserStore.getState().user;
        if (!user) return;

        const { chatId, ...messageData } = message;

        const newMessage: Message = {
          id: messageData.id || Math.random().toString(),
          text: messageData.text || '',
          createdAt: messageData.createdAt || new Date().toISOString(),
          type: messageData.type, // Add type here
          senderId: messageData.senderId || user.id,
          name: messageData.name || user.name,
          avatar: messageData.avatar || user.avatar,
          readBy: []
        };

        const current = get().chats[chatId] || [];

        set({
          chats: {
            ...get().chats,
            [chatId]: [newMessage, ...current],
          },
        });

        // Update chat list with last message
        get().updateChatLastMessage(chatId, newMessage); // Pass the whole message object
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
          get().updateChatLastMessage(chatId, lastMsg); // Pass the whole message object
        }
      },

      // ⭐ Add new chat to chat list (for groups or new conversations)
      addChat: (chat) => {
        const currentChatList = get().chatList;

        let processedChat = { ...chat };

        // Process group members to determine ownerId and admins if it's a group and members exist
        if (processedChat.isGroup && processedChat.members && processedChat.members.length > 0) {
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
          // Update existing chat and move to top
          const updatedChatList = [...currentChatList];
          updatedChatList[existingIndex] = {
            ...updatedChatList[existingIndex],
            ...processedChat, // Use processedChat here
          };

          console.log(`📌 [chatStore] addChat - updating "${processedChat.name}":`, {
            oldTimestamp: updatedChatList[existingIndex].timestamp,
            newTimestamp: processedChat.timestamp,
            isGroup: processedChat.isGroup,
          });

          // ✅ Move updated chat to top of list
          const [movedChat] = updatedChatList.splice(existingIndex, 1);
          updatedChatList.unshift(movedChat);

          set({ chatList: updatedChatList });
        } else {
          // Add new chat to the top of the list
          console.log(`➕ [chatStore] addChat - adding new "${processedChat.name}"`);
          set({
            chatList: [processedChat, ...currentChatList], // Use processedChat here
          });
        }
      },

      // ⭐ Set all chats (for API bulk updates)
      setChats: (chats) => {
        // ✅ Always sort by timestamp (most recent first) before setting
        const sortedChats = [...chats].sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        console.log('📊 [chatStore] setChats - sorted order:', sortedChats.map(c => ({
          name: c.name,
          timestamp: c.timestamp,
          isGroup: c.isGroup,
        })));

        set({ chatList: sortedChats });
      },

      // ⭐ Update last message in chat list
      updateChatLastMessage: (chatId, message) => {
        const currentChatList = get().chatList;
        const chatIndex = currentChatList.findIndex(c => c.id === chatId);

        if (chatIndex !== -1) {
          const updatedChatList = [...currentChatList];
          const chat = updatedChatList[chatIndex];

          let formattedLastMessage = '';
          if (message.type === 2) { // Voice message
            formattedLastMessage = '【语音】';
          } else if (message.type === 3) { // Image/File message
            formattedLastMessage = '【图片】';
          } else { // Default to text message or if type is not recognized
            formattedLastMessage = message.text;
          }

          // Update chat
          updatedChatList[chatIndex] = {
            ...chat,
            lastMessage: formattedLastMessage,
            timestamp: message.createdAt,
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

      // ❌ Removed markAsRead and incrementUnread
      // unreadCount is now fully managed by backend API (/chats/read)
      // ChatList refreshes via polling (3s) + WebSocket

      clearChat: (chatId) => {
        const chats = { ...get().chats };
        delete chats[chatId];
        set({ chats });
      },

      clearAllChats: () => set({ chats: {}, chatList: [] }),

      // ✅ Member cache management functions
      getMemberInfo: (userId) => {
        return get().memberCache[userId];
      },

      setMemberInfo: (userId, info) => {
        set({
          memberCache: {
            ...get().memberCache,
            [userId]: {
              ...info,
              cachedAt: Date.now(),
            },
          },
        });
      },

      clearMemberCache: () => {
        set({ memberCache: {} });
      },

      clearExpiredMemberCache: (maxAgeMs = 24 * 60 * 60 * 1000) => {
        // Default: 24 hours
        const now = Date.now();
        const cache = get().memberCache;
        const filteredCache: Record<string, MemberInfo> = {};

        Object.entries(cache).forEach(([userId, info]) => {
          if (now - info.cachedAt < maxAgeMs) {
            filteredCache[userId] = info;
          }
        });

        set({ memberCache: filteredCache });
      },

      getLastMessage: (chatId) => {
        const messages = get().chats[chatId] || [];
        return messages.length ? messages[messages.length - 1] : null;
      },
    }),

    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);