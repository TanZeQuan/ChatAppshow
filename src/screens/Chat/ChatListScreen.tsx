import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../store/chatStore';
import { colors, borders, typography } from "../../styles";
import { useContactStore } from '../../store/contactStore';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { readUserChats, readChatMessages, createPrivateChat } from '../../api/Chat';
import { readFriends } from '../../api/Friend';
import { useUserStore } from '../../store/userStore';

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { chatList, getLastMessage } = useChatStore();
  const { contacts } = useContactStore();
  const { user } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = user?.id || 'YOUR_CURRENT_USER_ID';

  // Refresh chat list when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Silently refresh data without showing refresh indicator
      silentRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

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
    // 如果是联系人（没有真正的聊天ID，只有用户ID），先创建私聊
    if (!chat.isGroup && !chat.id.startsWith('IMC')) {
      try {
        console.log('Creating private chat with contact:', chat.id);

        const result = await createPrivateChat({
          name: chat.name,
          user_id: currentUserId,
          chat_with: chat.id,  // 联系人ID
          group: []
        });

        console.log('Create private chat result:', result);

        if (result.success && result.data?.response) {
          // 使用返回的真正的 chat_id（response 直接就是 chat_id 字符串）
          navigation.navigate('ChatRoom', {
            chatId: result.data.response,
            chatName: chat.name,
            isGroup: false,
          });
          return;
        } else {
          // 如果创建失败，显示错误
          console.error('Failed to create private chat:', result.message);
          return;
        }
      } catch (error) {
        console.error('Error creating private chat:', error);
        return;
      }
    }

    // 正常的群聊或已有聊天ID的私聊
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const silentRefresh = async () => {
    // Refresh without showing the refresh indicator
    await refreshData();
  };

  const refreshData = async () => {
    try {
      // 1️⃣ Refresh chat list from API
      if (currentUserId && currentUserId !== 'YOUR_CURRENT_USER_ID') {
        const chatsResult = await readUserChats(currentUserId);
        if (chatsResult.success) {
          // Update your chat store here if needed
        }

        // 2️⃣ Refresh friends/contacts
        const friendsResult = await readFriends(2); // isstatus = 2 (accepted friends)
        if (friendsResult.success) {
          // Update your contact store here if needed
        }
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#FFD966']}
              tintColor="#FFD966"
            />
          }
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
