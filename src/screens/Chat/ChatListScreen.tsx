import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readChatMessages, readUserChats } from '../../api/Chat';
import { ensureFullImageUrl } from '../../api/service';
import WebSocketManager from '../../services/WebSocketManager';
import { ChatListItem, useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

const formatLastMessagePreview = (message: string, type: number | undefined): string => {
  if (!message) {
    return '开始聊天';
  }
  if (type === 2) { // Voice
    return '【语音】';
  }
  if (type === 3) { // Image/Files
    return '【图片】';
  }
  return message; // Default to text
};

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { chatList, setChats, addChat, getChatById } = useChatStore();
  const { user } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');

  const currentUserId = user?.id;

  // ✅ Load chat list on mount and when user changes
  useEffect(() => {
    if (currentUserId) {
      console.log('📋 [ChatList] Loading initial chat list for user:', currentUserId);
      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ✅ Refresh when screen regains focus (user returns from chat room)
  // This syncs unread counts after backend clears them
  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        console.log('👁️ [ChatList] Screen focused, syncing unread counts...');
        silentRefresh();
      }
    }, [currentUserId])
  );

  // Listen for WebSocket messages (GLOBAL - works even when not in chat room)
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      // When ANY chat message is received, refresh the chat list
      // This ensures the chat list shows the latest message preview
      if (data.type && data.message) {
        silentRefresh();
      }
    };
    WebSocketManager.addMessageCallback(handleWebSocketMessage);

    return () => {
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ chatList is already sorted by timestamp in chatStore.setChats()
  // Just filter based on search query
  const filteredChats = chatList.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = (chat: any) => {
    // ✅ Get the latest chat data from store to avoid overwriting with stale data
    const latestChat = getChatById(chat.id);

    // ✅ Update only necessary fields (timestamp and unreadCount)
    // Preserve other fields from store (including latest avatar)
    const newTimestamp = new Date().toISOString();
    const updatedChat = {
      ...(latestChat || chat), // Use latest data from store, fallback to item data
      timestamp: newTimestamp,
      unreadCount: 0, // ✅ Optimistically clear unread count
    };

    console.log(`🔄 [ChatList] Updating chat "${chat.name}":`, {
      old: chat.timestamp,
      new: newTimestamp,
      isGroup: chat.isGroup,
      clearedUnread: chat.unreadCount,
      usingStoreData: !!latestChat,
    });

    addChat(updatedChat); // Update in store

    // ChatListScreen 只显示已有的聊天记录（从 /chats/read 获取）
    // 所有聊天都有真正的 chat_id，直接跳转即可
    // 创建新聊天的逻辑在 ContactsScreen 中处理

    if (chat.isGroup) {
      navigation.navigate('GroupRoom', {
        chatId: chat.id,
        chatName: chat.name,
        isGroup: true,
        members: chat.members || [],
        memberIds: chat.memberIds || [],
      });
    } else {
      navigation.navigate('ChatRoom', {
        chatId: chat.id,
        chatName: chat.name,
        isGroup: false,
      });
    }
  };

  const silentRefresh = async () => {
    // Refresh without showing the refresh indicator
    await refreshData();
  };

  const refreshData = async () => {
    const currentUserId = user?.id;

    // ⚠️ Guard: Check if currentUserId exists
    if (!currentUserId) {
      console.error('❌ [refreshData] Invalid currentUserId, skipping refresh');
      return;
    }

    try {
      // 1️⃣ Refresh chat list from API
      const chatsResult = await readUserChats(currentUserId);
      if (chatsResult.success && chatsResult.data) {
        // console.log('🔍 Full raw chat data from API:', JSON.stringify(chatsResult.data, null, 2));

        // Transform API data to chat list format
        const formattedChats = chatsResult.data.map((chat: any) => {
          // 🔍 Try to preserve existing memberIds from chatStore if available
          const existingChat = chatList.find(c => c.id === chat.chat_id);
          const existingMemberIds = existingChat?.memberIds || [];

          // Use backend memberIds if available, otherwise keep existing ones
          const backendMemberIds = chat.member_ids || chat.memberIds || chat.user_ids || [];
          const finalMemberIds = backendMemberIds.length > 0 ? backendMemberIds : existingMemberIds;

          // 🎯 Get avatar from API only
          const isGroup = chat.istype === 2 || chat.type === 2 || chat.isGroup || false;
          let finalAvatar = null;

          // Use API image if available
          const apiImage = chat.image || chat.avatar;
          if (apiImage && apiImage.trim() !== '') {
            // Convert relative path to full URL
            finalAvatar = ensureFullImageUrl(apiImage);
          }

          // Extract last message from message array or use existing data
          const lastMessageText = chat.message && chat.message.length > 0
            ? chat.message[chat.message.length - 1]?.message || ''
            : chat.last_message || '';

          const lastMessageType = chat.message && chat.message.length > 0
            ? chat.message[chat.message.length - 1]?.type
            : chat.last_message_type;

          // ✅ Preserve local timestamp if it's newer than backend timestamp
          // This ensures recently clicked chats stay at the top
          const backendTimestamp = chat.last_message_time || chat.timestamp || new Date().toISOString();
          const localTimestamp = existingChat?.timestamp;

          // Use local timestamp if it exists AND is newer than backend
          let finalTimestamp = backendTimestamp;
          if (localTimestamp) {
            const localTime = new Date(localTimestamp).getTime();
            const backendTime = new Date(backendTimestamp).getTime();
            if (localTime > backendTime) {
              finalTimestamp = localTimestamp; // Keep the newer local timestamp
              console.log(`✅ [ChatList] Preserving local timestamp for "${chat.name || chat.chat_name}":`, {
                backend: backendTimestamp,
                local: localTimestamp,
                kept: 'local'
              });
            }
          }

          // ✅ Get real online status from WebSocketManager (for private chats only)
          const otherUserId = !isGroup && finalMemberIds.length > 0 
            ? finalMemberIds.find((id: number | string) => id !== currentUserId) 
            : undefined;
          const isUserOnline = otherUserId ? WebSocketManager.isUserOnline(otherUserId) : false;

          return {
            id: chat.chat_id,
            name: chat.name || chat.chat_name || '未命名聊天',
            avatar: finalAvatar, // ✅ Use the corrected avatar
            isGroup: isGroup,
            members: chat.members || [],
            memberIds: finalMemberIds,
            lastMessage: formatLastMessagePreview(lastMessageText, lastMessageType),
            timestamp: finalTimestamp, // ✅ Use preserved timestamp
            unreadCount: chat.unread || chat.unread_count || 0,
            online: false,
            rawData: chat,
          };
        });

        console.log('✅ [ChatList] Formatted chats:', formattedChats.map((c: ChatListItem) => ({
          name: c.name,
          timestamp: c.timestamp,
          isGroup: c.isGroup,
        })));
        // console.log('📋 First chat:', JSON.stringify(formattedChats[0], null, 2));

        // Update chat store
        setChats(formattedChats);

        // ✅ Load group members for all group chats (with caching)
        loadGroupMembersForAllChats(formattedChats);
      }

      // 2️⃣ Refresh friends/contacts - REMOVED
      // 3️⃣ For each contact not in chatList, fetch last message - REMOVED

    } catch (error) {
      console.error("Refresh error:", error);
    }
  };

  // ✅ Load group members for all group chats (only if not already cached)
  const loadGroupMembersForAllChats = async (chats: ChatListItem[]) => {
    if (!currentUserId) return;

    const groupChats = chats.filter(chat => chat.isGroup);
    console.log(`📥 [ChatList] Found ${groupChats.length} group chats, checking cache...`);

    for (const chat of groupChats) {
      try {
        // ✅ Check if members are already cached
        const cachedChat = getChatById(chat.id);
        if (cachedChat?.members && cachedChat.members.length > 0) {
          console.log(`✅ [ChatList] Group "${chat.name}" already has ${cachedChat.members.length} cached members, skipping`);
          continue; // Skip if already cached
        }

        console.log(`📥 [ChatList] Loading members for group "${chat.name}"...`);

        // Load members from API
        const result = await readChatMessages({
          chat_id: chat.id,
          user_id: currentUserId,
          offset: 0,
        });

        if (result.success && result.data?.group && Array.isArray(result.data.group)) {
          // Extract member info
          const membersInfo = result.data.group.map((member: any) => {
            // Validate avatar URL
            let memberAvatar = member.image || member.avatar || '';
            const isInvalidAvatar = !memberAvatar ||
              memberAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
              memberAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/' ||
              (memberAvatar.startsWith('https://balkingly-hemitropic-lelah.ngrok-free.dev') &&
                !(memberAvatar.includes('/content/') || memberAvatar.includes('/coontent/') ||
                  memberAvatar.includes('/uploads/') || memberAvatar.includes('/uploadds/')));

            return {
              id: member.user_id,
              name: member.name || member.username || member.full_name || '未知',
              avatar: isInvalidAvatar ? '' : memberAvatar,
            };
          });

          const memberIds = result.data.group.map((member: any) => member.user_id);

          // Update chatStore with member info
          addChat({
            ...chat,
            members: membersInfo,
            memberIds: memberIds,
          });

          console.log(`✅ [ChatList] Cached ${membersInfo.length} members for group "${chat.name}"`);
        }
      } catch (error) {
        console.error(`❌ [ChatList] Failed to load members for group "${chat.name}":`, error);
        // Continue to next group even if this one fails
      }
    }

    console.log('✅ [ChatList] Finished loading all group members');
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 24) {
      // Show time for today
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffInDays < 2) {
      // Show "Yesterday" for yesterday
      return '昨天';
    } else if (diffInDays < 7) {
      // Show day of week for this week
      return date.toLocaleDateString('zh-CN', { weekday: 'short' });
    } else {
      // Show date for older messages
      return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
      });
    }
  };

  const renderChatItem = ({ item }: any) => {
    // ✅ Helper function to check if avatar is valid
    const isValidAvatar = (avatar: string | null | undefined): boolean => {
      if (!avatar) return false;
      const trimmed = avatar.trim();
      if (trimmed === '') return false;
      // Also check if it's the specific placeholder URL from the API backend
      if (trimmed === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
          trimmed === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/') return false;
      return true;
    };

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={
              isValidAvatar(item.avatar)
                ? { uri: item.avatar }
                : item.isGroup
                  ? require('../../assets/images/group.png') // Fallback for groups
                  : require('../../assets/images/personal.png') // Fallback for personal chats
            }
            style={styles.avatar}
          />

          {/* Online indicator for individual chats */}
          {!item.isGroup && item.online && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{item.name}</Text>
              {/* {item.isGroup && (
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={12} color="#666" />
                <Text style={styles.groupBadgeText}>
                  {item.members?.length || 0}
                </Text>
              </View>
            )} */}
            </View>

            <View style={styles.rightSection}>
              {item.timestamp && (
                <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
              )}
            </View>
          </View>

          <View style={styles.messageRow}>
            <Text style={styles.message} numberOfLines={1}>
              {item.lastMessage}
            </Text>

            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFD860', '#FFD860']}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>森通</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Chat List */}
      <View style={styles.listContainer}>
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          extraData={filteredChats.map(chat => chat.members?.length)}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>
                {searchQuery ? '未找到聊天' : '没有聊天记录'}
              </Text>
              <Text style={styles.emptySubtext}>
                开始与好友聊天或创建群组
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0],
  },
  gradientHeader: {
    paddingBottom: scaleHeight(16),
  },
  header: {
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    textAlign: 'center',
    color: colors.text.black,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.white,
    marginHorizontal: scaleWidth(16),
    marginTop: scaleHeight(8),
    borderRadius: borders.radius20,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
  },
  searchIcon: {
    marginRight: scaleWidth(8),
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize15,
    color: colors.text.dark,
    padding: 0,
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0],
    paddingTop: scaleHeight(12),
  },
  listContent: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(10),
    paddingBottom: scaleHeight(100), // 给底部留出空间，避免被 tab bar 遮挡
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    padding: scaleWidth(12),
    marginBottom: scaleHeight(8),
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    marginRight: scaleWidth(12),
    position: 'relative',
  },
  avatar: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    borderRadius: borders.radius8,
  },
  avatarPlaceholder: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: colors.background.grayLight,
    borderRadius: borders.radius8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scaleWidth(12),
    height: scaleWidth(12),
    borderRadius: scaleWidth(6),
    backgroundColor: colors.functional.green,
    borderWidth: 2,
    borderColor: colors.background.white,
  },
  groupAvatarContainer: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: borders.radius8,
    overflow: 'hidden',
  },
  groupAvatarPlaceholder: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: colors.background.grayLight,
    borderRadius: borders.radius8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarImage: {
    width: scaleWidth(24),
    height: scaleWidth(24),
  },
  groupAvatar2: {
    width: scaleWidth(24),
    height: scaleWidth(48),
  },
  groupAvatar3: {
    width: scaleWidth(24),
    height: scaleWidth(24),
  },
  groupAvatar4: {
    width: scaleWidth(24),
    height: scaleWidth(24),
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(4),
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.grayLight,
    paddingHorizontal: scaleWidth(6),
    paddingVertical: scaleHeight(2),
    borderRadius: borders.radius10,
    marginLeft: scaleWidth(6),
  },
  groupBadgeText: {
    fontSize: typography.fontSize11,
    color: colors.text.grayMedium,
    marginLeft: scaleWidth(2),
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: colors.functional.red,
    borderRadius: borders.radius10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.text.white,
    fontSize: typography.fontSize11,
    fontWeight: typography.fontWeight600,
  },
  name: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight500,
    color: colors.text.dark,
  },
  time: {
    fontSize: typography.fontSize12,
    color: colors.text.grayMedium,
  },
  message: {
    fontSize: typography.fontSize14,
    color: colors.text.grayMedium,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleHeight(60),
  },
  emptyText: {
    fontSize: typography.fontSize16,
    color: colors.text.grayMedium,
    marginTop: scaleHeight(12),
  },
  emptySubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
    marginTop: scaleHeight(6),
  },
});
