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
import { useContactStore } from '../../store/contactStore';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { readUserChats, readChatMessages } from '../../api/Chat';
import { readFriends } from '../../api/Friend';
import { useUserStore } from '../../store/userStore';

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

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

  // Build comprehensive chat list combining chatList and contacts
  const allChats = useMemo(() => {
    const chatMap = new Map<string, any>();

    chatList.forEach(chat => {
      const membersWithSelf = [
        ...(chat.members || []),
        ...(currentUserId && !chat.members?.some(m => m.id === currentUserId)
          ? [{ id: currentUserId, name: '我', avatar: '' }]
          : [])
      ];

      const uniqueMembers = Array.from(new Map(membersWithSelf.map(m => [m.id, m])).values());

      chatMap.set(chat.id, {
        ...chat,
        members: uniqueMembers,
        memberIds: uniqueMembers.map(m => m.id),
      });
    });

    contacts.forEach(contact => {
      if (!chatMap.has(contact.id)) {
        const lastMessage = getLastMessage(contact.id);
        chatMap.set(contact.id, {
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

  const handleChatPress = (chat: any) => {
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
          console.log("Refreshed chats:", chatsResult.data);
          // Update your chat store here if needed
        }

        // 2️⃣ Refresh friends/contacts
        const friendsResult = await readFriends(2); // isstatus = 2 (accepted friends)
        if (friendsResult.success) {
          console.log("Refreshed friends:", friendsResult.data);
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
            source={{ uri: member.avatar || `https://i.pravatar.cc/150?img=${index}` }}
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
        colors={['#FFD966', '#FFB84D']}
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
    backgroundColor: '#F5F5F5'
  },
  gradientHeader: {
    paddingBottom: scaleHeight(16)
  },
  header: {
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#333'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: scaleWidth(16),
    marginTop: scaleHeight(8),
    borderRadius: 20,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8)
  },
  searchIcon: {
    marginRight: scaleWidth(8)
  },
  searchInput: {
    flex: 1,
    fontSize: scaleFont(15),
    color: '#333',
    padding: 0
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: scaleHeight(12)
  },
  listContent: {
    paddingHorizontal: scaleWidth(16)
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: scaleWidth(12),
    marginBottom: scaleHeight(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
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
    borderRadius: scaleWidth(8)
  },
  avatarPlaceholder: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: '#E8E8E8',
    borderRadius: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center'
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scaleWidth(12),
    height: scaleWidth(12),
    borderRadius: scaleWidth(6),
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  groupAvatarContainer: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: scaleWidth(8),
    overflow: 'hidden',
  },
  groupAvatarPlaceholder: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: '#E8E8E8',
    borderRadius: scaleWidth(8),
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
    justifyContent: 'center'
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(4)
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
    backgroundColor: '#F0F0F0',
    paddingHorizontal: scaleWidth(6),
    paddingVertical: scaleHeight(2),
    borderRadius: 10,
    marginLeft: scaleWidth(6),
  },
  groupBadgeText: {
    fontSize: scaleFont(10),
    color: '#666',
    marginLeft: scaleWidth(2),
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: '#FFF',
    fontSize: scaleFont(11),
    fontWeight: '600'
  },
  name: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: '#333'
  },
  time: {
    fontSize: scaleFont(12),
    color: '#999'
  },
  message: {
    fontSize: scaleFont(14),
    color: '#999',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleHeight(60)
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: '#999',
    marginTop: scaleHeight(12)
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: '#CCC',
    marginTop: scaleHeight(6),
  },
});