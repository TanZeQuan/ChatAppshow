import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
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
import { useChatStore } from '../../store/chatStore';
import { useContactStore } from '../../store/contactStore';
import { borders, colors, typography } from "../../styles";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createPrivateChat, readUserChats } from '../../api/Chat';
import { readFriends } from '../../api/Friend';
import WebSocketManager from '../../services/WebSocketManager';
import { useUserStore } from '../../store/userStore';

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { chatList, getLastMessage, addChat, setChats } = useChatStore();
  const { contacts, setContacts } = useContactStore();
  const { user } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');

  // 🔍 Diagnostic: Log current user info
  // console.log('📱 [ChatListScreen] Current user from store:', JSON.stringify(user, null, 2));

  const currentUserId = user?.id;

  if (!currentUserId || currentUserId === 'YOUR_CURRENT_USER_ID') {
    // console.error('❌ [ChatListScreen] Invalid user ID!');
    // console.error('user object:', user);
    // console.error('user.id:', user?.id);
  }

  // Refresh chat list when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Silently refresh data without showing refresh indicator
      silentRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Listen for WebSocket messages (GLOBAL - works even when not in chat room)
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      // console.log('🔔 [ChatList] WebSocket message received');
      // console.log('Message data:', data);

      // When ANY chat message is received, refresh the chat list
      // This ensures the chat list shows the latest message preview
      // 后端格式: {type: 1, message: "...", status: 1, ...}
      if (data.type && data.message) {
        // console.log('✅ [ChatList] New message detected - refreshing chat list');
        silentRefresh();
      }
    };
    WebSocketManager.addMessageCallback(handleWebSocketMessage);

    return () => {
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build comprehensive chat list - keeping only the LATEST chat for each unique contact/group
  const allChats = useMemo(() => {
    const chatMap = new Map<string, any>();

    // Process chatList first (these have actual message history)
    chatList.forEach(chat => {
      const membersWithSelf = [
        ...(chat.members || []),
        ...(currentUserId && !chat.members?.some(m => m.id === currentUserId)
          ? [{ id: currentUserId, name: '我', avatar: '' }]
          : [])
      ];

      const uniqueMembers = Array.from(new Map(membersWithSelf.map(m => [m.id, m])).values());
      
      // Create a unique key based on participants (sorted to ensure consistency)
      const participantKey = chat.isGroup 
        ? chat.id // Use chat ID for groups
        : uniqueMembers
            .map(m => m.id)
            .filter(id => id !== currentUserId)
            .sort()
            .join('-'); // Create key from other participants

      const existingChat = chatMap.get(participantKey);
      const chatTimestamp = new Date(chat.timestamp || 0).getTime();
      const existingTimestamp = existingChat ? new Date(existingChat.timestamp || 0).getTime() : 0;

      // Only keep the chat with the most recent timestamp
      if (!existingChat || chatTimestamp > existingTimestamp) {
        chatMap.set(participantKey, {
          ...chat,
          members: uniqueMembers,
          memberIds: uniqueMembers.map(m => m.id),
        });
      }
    });

    // Add contacts that don't have any chat history yet
    contacts.forEach(contact => {
      const participantKey = contact.id;
      
      // Only add if there's no existing chat with this contact
      if (!chatMap.has(participantKey)) {
        const lastMessage = getLastMessage(contact.id);
        chatMap.set(participantKey, {
          id: contact.id,
          name: contact.name.replace(/^用户/, ''),
          avatar: contact.avatar,
          isGroup: false,
          members: [contact],
          memberIds: [contact.id],
          lastMessage: lastMessage?.text || '开始聊天',
          timestamp: lastMessage?.createdAt || '',
          unreadCount: 0,
          online: contact.online || false,
        });
      }
    });

    // Sort by timestamp (most recent first)
    return Array.from(chatMap.values()).sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [chatList, contacts, getLastMessage, currentUserId]);

  // Filter chats based on search query
  const filteredChats = allChats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = async (chat: any) => {
    // ⚠️ Guard: Check if currentUserId exists
    if (!currentUserId) {
      console.error('❌ [handleChatPress] No currentUserId, cannot open chat');
      return;
    }

    // 如果是联系人（没有真正的聊天ID，只有用户ID），需要创建或查找私聊
    if (!chat.isGroup && !chat.id.startsWith('IMC')) {
      try {
        // // 🔍 Step 1: Check if chat already exists in frontend chatList
        // console.log('🔍 Checking if chat already exists with user:', chat.id);
        // console.log('📋 Current chatList:', chatList.map(c => ({
        //   id: c.id,
        //   name: c.name,
        //   isGroup: c.isGroup,
        //   memberIds: c.memberIds
        // })));

        // Look for existing private chat with this user
        const existingChat = chatList.find(c => {
          // Must be a private chat (not group) and have memberIds
          if (c.isGroup || !c.memberIds || c.memberIds.length === 0) {
            return false;
          }

          // Check if this chat includes both currentUserId and the target user (chat.id)
          const hasBothUsers = c.memberIds.includes(currentUserId) && c.memberIds.includes(chat.id);
          // console.log(`Checking chat ${c.id}: memberIds=${c.memberIds}, hasBothUsers=${hasBothUsers}`);
          return hasBothUsers;
        });

        if (existingChat) {
          // console.log('✅ Found existing chat:', existingChat.id);
          // Navigate to existing chat
          navigation.navigate('ChatRoom', {
            chatId: existingChat.id,
            chatName: existingChat.name,
            isGroup: false,
          });
          return;
        }

        // 🆕 Step 2: No existing chat found, create new one
        // console.log('🆕 No existing chat found, creating new chat with contact:', chat.id);

        // // 🔍 Diagnostic: Log API parameters
        // console.log('📤 [API] createPrivateChat parameters:');
        // console.log('  - user_id (current user):', currentUserId);
        // console.log('  - chat_with (target user):', chat.id);
        // console.log('  - name:', chat.name);
        // console.log('  - Full user object from store:', JSON.stringify(user, null, 2));

        const result = await createPrivateChat({
          name: chat.name,
          user_id: currentUserId, // TypeScript now knows this is not undefined
          chat_with: chat.id,
          group: []
        });

        // console.log('Create private chat result:', result);

        if (result.success && result.data?.response) {
          const chatId = result.data.response;
          // console.log('✅ Got new chat_id:', chatId);

          // 💾 Save chat info to store with memberIds for future lookup
          addChat({
            id: chatId,
            name: chat.name,
            avatar: chat.avatar || null,
            isGroup: false,
            members: [
              { id: chat.id, name: chat.name, avatar: chat.avatar },
              { id: currentUserId, name: user?.name || '我', avatar: user?.avatar || '' }
            ],
            memberIds: [chat.id, currentUserId], // ⭐ Critical for future lookups
            lastMessage: '开始聊天',
            timestamp: new Date().toISOString(),
            unreadCount: 0,
            online: chat.online || false,
          });

          navigation.navigate('ChatRoom', {
            chatId: chatId,
            chatName: chat.name,
            isGroup: false,
          });
          return;
        } else {
          console.error('Failed to create private chat:', result.message);
          return;
        }
      } catch (error) {
        console.error('Error creating private chat:', error);
        return;
      }
    }

    // 正常的群聊或已有聊天ID的私聊
    console.log('Opening existing chat_id:', chat.id);
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
    // ⚠️ Guard: Check if currentUserId exists
    if (!currentUserId || currentUserId === 'YOUR_CURRENT_USER_ID') {
      console.error('❌ [refreshData] Invalid currentUserId, skipping refresh');
      return;
    }

    try {
      // 🔍 Diagnostic: Verify user before API calls
      // console.log('🔄 [refreshData] Starting refresh...');
      // console.log('  - currentUserId:', currentUserId);
      // console.log('  - Full user object:', JSON.stringify(user, null, 2));

      // 1️⃣ Refresh chat list from API
      // console.log('📤 [API] Calling readUserChats with user_id:', currentUserId);
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

          return {
            id: chat.chat_id,
            name: chat.name || chat.chat_name || '未命名聊天',
            avatar: chat.image || chat.avatar || null,
            isGroup: chat.type === 2 || chat.isGroup || false,
            members: chat.members || [],
            memberIds: finalMemberIds, // ⭐ Preserve or update memberIds
            lastMessage: chat.last_message || '',
            timestamp: chat.last_message_time || chat.timestamp || new Date().toISOString(),
            unreadCount: chat.unread_count || 0,
            online: false,
            rawData: chat,
          };
        });

        console.log('✅ Formatted chat (first):', JSON.stringify(formattedChats[0]));

        // Update chat store
        setChats(formattedChats);
      }

      // 2️⃣ Refresh friends/contacts
      const friendsResult = await readFriends(2); // isstatus = 2 (accepted friends)
      if (friendsResult.success && friendsResult.data) {
        // Combine request and approve arrays (same as ContactsScreen)
        const allFriends = [
          ...(friendsResult.data.request || []),
          ...(friendsResult.data.approve || [])
        ];

        // Transform API response to contact format
        const formattedContacts = allFriends.map((friend: any) => {
          const userId = friend.user_id || friend.id || friend.userId || friend.approve_id || friend.request_id;
          const userName = friend.name || friend.username || friend.display_name || friend.user_name || `用户${userId}`;
          const userAvatar = friend.avatar || friend.profile_picture || friend.avatarUrl || friend.avatar_url || friend.photo || friend.image;

          return {
            id: userId,
            name: userName,
            avatar: userAvatar,
            online: friend.online || friend.is_online || false,
            listId: friend.list_id || friend.listId || 0,
            isFriend: true,
            rawData: friend,
          };
        });

        // Remove duplicates based on id
        const uniqueContacts = Array.from(
          new Map(formattedContacts.map(contact => [contact.id, contact])).values()
        );

        // Update contact store
        setContacts(uniqueContacts);
      }

      // 3️⃣ For each contact not in chatList, fetch last message
      contacts.forEach(contact => getLastMessage(contact.id));

    } catch (error) {
      console.error("Refresh error:", error);
    }
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

  const renderGroupAvatar = (members: any[]) => {
    // Show first 4 members in a grid for group avatar
    const displayMembers = members?.slice(0, 4) || [];

    if (displayMembers.length <= 1) {
      return (
        <View style={styles.groupAvatarPlaceholder}>
          <Ionicons name="people" size={24} color="#999" />
        </View>
      );
    }

    return (
      <View style={styles.groupAvatarContainer}>
        {displayMembers.map((member, index) => (
          <Image
            key={index}
            source={member.avatar ? { uri: member.avatar } : require('../../assets/images/anonymous.png')}
            style={[
              styles.groupAvatarImage,
              displayMembers.length === 2 && styles.groupAvatar2,
              displayMembers.length === 3 && styles.groupAvatar3,
              displayMembers.length === 4 && styles.groupAvatar4,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderChatItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.isGroup ? (
          renderGroupAvatar(item.members)
        ) : item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}

        {/* Online indicator for individual chats */}
        {!item.isGroup && item.online && (
          <View style={styles.onlineIndicator} />
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{item.name}</Text>
            {item.isGroup && (
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={12} color="#666" />
                <Text style={styles.groupBadgeText}>
                  {item.members?.length || 0}
                </Text>
              </View>
            )}
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
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
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
