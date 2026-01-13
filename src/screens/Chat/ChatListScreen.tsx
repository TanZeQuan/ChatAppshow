import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { readFriends } from '../../api/Friend'; // ✅ 引入 API
import { ensureFullImageUrl } from '../../api/service';
import WebSocketManager from '../../services/WebSocketManager';
import { ChatListItem, useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { useContactStore } from '../../store/contactStore'; // ✅ 引入 ContactStore 用于同步更新
import { borders, colors, typography } from "../../styles";

const { width } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (Dimensions.get("window").height / 812) * size;

// --- 辅助函数 ---

const formatLastMessagePreview = (message: string, type: number | undefined): string => {
  if (!message && type === undefined) return '开始聊天吧~';
  if (message && typeof message === 'string') {
    if (message.includes('SINGLE_VOICE_CALL') || message.includes('GROUP_VOICE_CALL')) return '[语音通话]';
    if (message.startsWith('{') && message.includes('type')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type) {
          if (parsed.type.includes('VOICE_CALL')) return '[语音通话]';
          if (parsed.type.includes('VIDEO_CALL')) return '[视频通话]';
        }
      } catch (e) {}
    }
  }
  switch (type) {
    case 2: return '[语音消息]';
    case 3: return '[图片]';
    case 4: return '[个人名片]';
    case 5: return '[视频]';
    default: return message || '新消息';
  }
};

const isValidAvatar = (avatar: string | null | undefined): boolean => {
  if (!avatar) return false;
  const trimmed = avatar.trim();
  if (trimmed === '') return false;
  if (trimmed.includes('ngrok-free.dev') && !trimmed.includes('/content/')) return false;
  return true;
};

// ✅ 简单格式化：直接从后端时间字符串提取，不做时区转换
// 今天显示 HH:mm，其他日期显示 日期/月份，不是今年显示 日期/月份/年份
const formatTime = (timestamp: string): string => {
  if (!timestamp) return '';
  
  // 提取日期和时间部分 "2026-01-13 17:12:27"
  const dateTimeMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!dateTimeMatch) return '';
  
  const [, year, month, day, hour, minute] = dateTimeMatch;
  
  // 获取今天的日期（从后端视角，假设后端是马来西亚时间 GMT+8）
  const now = new Date();
  // 转换为 GMT+8 时间
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt8 = new Date(utc + (8 * 60 * 60000));
  
  const todayYear = gmt8.getFullYear().toString();
  const todayMonth = (gmt8.getMonth() + 1).toString().padStart(2, '0');
  const todayDay = gmt8.getDate().toString().padStart(2, '0');
  
  // 判断是否是今天
  const isToday = year === todayYear && month === todayMonth && day === todayDay;
  
  if (isToday) {
    // 今天：显示 HH:mm
    return `${hour}:${minute}`;
  } else if (year !== todayYear) {
    // 不是今年：显示 日期/月份/年份
    return `${day}/${month}/${year}`;
  } else {
    // 今年其他日期：显示 日期/月份
    return `${day}/${month}`;
  }
};

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  
  const { chatList, setChats, addChat, getChatById } = useChatStore();
  const { user, onlineUsers } = useUserStore();
  const { setContacts } = useContactStore(); // ✅ 获取 setContacts 方法
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // ✅ 标记首次加载

  const currentUserId = user?.id;

  // 初始化加载（首次进入显示 loading）
  useEffect(() => {
    if (currentUserId) {
      refreshData(true); // 首次加载显示 loading
    }
  }, [currentUserId]);

  // 页面聚焦时静默刷新（不显示 loading，不会跳动）
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && !isInitialLoad) {
        refreshData(false); // ✅ 静默刷新
      }
    }, [currentUserId, isInitialLoad])
  );

  // WebSocket 实时消息处理 - 收到新消息时静默刷新 API 获取最新数据
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      if (!data.type || !data.chat_id) return;
      
      console.log('⚡️ [ChatList] 收到实时消息，触发静默刷新:', { chatId: data.chat_id });
      
      // ✅ 完全依赖 API：收到 WebSocket 消息时，静默刷新列表获取最新数据
      refreshData(false);
    };

    WebSocketManager.addMessageCallback(handleWebSocketMessage);
    return () => {
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
  }, []);

  // 排序和搜索逻辑
  const sortedAndFilteredChats = useMemo(() => {
    let result = [...chatList];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(chat => 
        (chat.name && chat.name.toLowerCase().includes(query)) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [chatList, searchQuery]);

  // 点击进入聊天
  const handleChatPress = useCallback((chat: ChatListItem) => {
    const latestChat = getChatById(chat.id);
    addChat({ ...(latestChat || chat), unreadCount: 0 });

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
  }, [addChat, getChatById, navigation]);

  // ✅✅✅ 核心逻辑：双重校验刷新 ✅✅✅
  // showLoading: true = 显示下拉刷新动画, false = 静默刷新
  const refreshData = async (showLoading: boolean = false) => {
    if (!currentUserId) return;

    if (showLoading) {
      setIsRefreshing(true);
    }

    try {
      // 1. 并行请求：获取聊天记录 + 获取最新好友列表
      const [chatsResult, friendsResult] = await Promise.all([
        readUserChats(currentUserId),
        readFriends(2) // status 2 = 已添加的好友
      ]);
      
      // 2. 构建有效好友白名单
      const validFriendIds = new Set<string>();
      
      if (friendsResult.success && friendsResult.data) {
        const allFriends = [
          ...(friendsResult.data.approve || []),
          ...(friendsResult.data.request || [])
        ];
        
        // 🛠️ 顺便更新 ContactStore (优化：保持通讯录页面数据也是最新的)
        const contactsForStore = allFriends.map((friend: any) => ({
            id: friend.user_id || friend.id || friend.userId,
            name: friend.name || friend.username || `用户${friend.user_id}`,
            avatar: friend.avatar || friend.image,
            online: friend.online || false,
            // ... 需要根据 ContactStore 的类型补全其他字段
            listId: friend.list_id || 0,
            isFriend: true,
            rawData: friend
        }));
        // 注意：这里需要确保 setContacts 接受的数据格式与你的 Store 定义一致
        // 如果格式复杂，可以注释掉这行，只保留下面的 ID 收集
        setContacts(contactsForStore);

        // 收集 ID
        allFriends.forEach((friend: any) => {
          const fid = friend.user_id || friend.id || friend.userId;
          if (fid) validFriendIds.add(String(fid));
        });
      }

      if (chatsResult.success && chatsResult.data) {
        // 3. 处理聊天列表
        const formattedChats: ChatListItem[] = chatsResult.data
          .map((chat: any) => {
            const existingChat = getChatById(chat.chat_id);
            const backendMemberIds = chat.member_ids || chat.memberIds || chat.user_ids || [];
            const finalMemberIds = backendMemberIds.length > 0 ? backendMemberIds : (existingChat?.memberIds || []);

            const isGroup = chat.istype === 2 || chat.type === 2 || chat.isGroup || false;
            
            // 🔥 过滤逻辑：如果是私聊，且对方不在好友白名单中 -> 返回 null
            if (!isGroup) {
              const otherId = finalMemberIds.find((id: any) => String(id) !== String(currentUserId));
              if (otherId && !validFriendIds.has(String(otherId))) {
                 return null; // 标记为无效
              }
            }

            // ... 常规数据映射 ...
            let finalAvatar = null;
            const apiImage = chat.image || chat.avatar;
            if (apiImage && apiImage.trim() !== '') {
              finalAvatar = ensureFullImageUrl(apiImage);
            }

            // ✅ 处理新的 message 格式（对象）和旧格式（数组）的兼容
            let lastMsgObj = null;
            if (chat.message) {
              if (Array.isArray(chat.message) && chat.message.length > 0) {
                // 旧格式：message 是数组
                lastMsgObj = chat.message[chat.message.length - 1];
              } else if (typeof chat.message === 'object' && chat.message.message_id) {
                // 新格式：message 是对象
                lastMsgObj = chat.message;
              }
            }
            const lastMessageText = lastMsgObj?.message || chat.last_message || '';
            const lastMessageType = lastMsgObj?.type || chat.last_message_type;

            // ✅ 完全依赖 API 返回的时间，优先使用 message.created_at
            const messageTimestamp = lastMsgObj?.created_at;
            const finalTimestamp = messageTimestamp || chat.last_message_time || chat.timestamp || '';

            let chatName = chat.name || chat.chat_name;
            if (!chatName && isGroup) chatName = '未命名群组';
            
            // 如果没名字，尝试从 members 补全
            if (!isGroup && (!chatName || chatName.trim() === '')) {
               if (chat.members && Array.isArray(chat.members)) {
                  const otherMember = chat.members.find((m: any) => m.user_id !== currentUserId && m.id !== currentUserId);
                  if (otherMember) {
                    chatName = otherMember.name || otherMember.username;
                    if (!finalAvatar && otherMember.avatar) finalAvatar = ensureFullImageUrl(otherMember.avatar);
                  }
               }
            }
            if (!chatName) chatName = '';

            return {
              id: chat.chat_id,
              name: chatName,
              avatar: finalAvatar,
              isGroup: isGroup,
              members: chat.members || [],
              memberIds: finalMemberIds,
              lastMessage: formatLastMessagePreview(lastMessageText, lastMessageType),
              timestamp: finalTimestamp,
              unreadCount: chat.unread || chat.unread_count || 0,
              rawData: chat,
            };
          })
          // 🔥 修复 TS 错误：明确告诉 TS 过滤后的数组里只有 ChatListItem
          .filter((item: ChatListItem | null): item is ChatListItem => item !== null);

        setChats(formattedChats);
        loadGroupMembersForAllChats(formattedChats);
      }
    } catch (error) {
      console.error("刷新聊天列表失败:", error);
    } finally {
      setIsRefreshing(false);
      if (isInitialLoad) {
        setIsInitialLoad(false); // ✅ 首次加载完成后，后续都用静默刷新
      }
    }
  };

  const loadGroupMembersForAllChats = async (chats: ChatListItem[]) => {
    if (!currentUserId) return;
    
    const groupChats = chats.filter(chat => chat.isGroup);

    for (const chat of groupChats) {
      const cachedChat = getChatById(chat.id);
      if (cachedChat?.members && cachedChat.members.length > 0) continue;

      try {
        const result = await readChatMessages({
          chat_id: chat.id,
          user_id: currentUserId,
          offset: 0,
        });
        
        if (result.success && result.data?.group) {
          const membersInfo = result.data.group.map((m: any) => ({
            id: m.user_id,
            name: m.name || '未知用户',
            avatar: ensureFullImageUrl(m.image || m.avatar)
          }));
          
          addChat({ 
            ...chat, 
            members: membersInfo, 
            memberIds: membersInfo.map((m: any) => m.id) 
          });
        }
      } catch (e) {
        console.error(`加载群组 ${chat.id} 成员失败:`, e);
      }
    }
  };

  const renderChatItem = useCallback(({ item }: { item: ChatListItem }) => {
    const otherUserId = !item.isGroup && item.memberIds
      ? item.memberIds.find(id => id !== currentUserId)
      : undefined;
    const isOnline = otherUserId ? onlineUsers.includes(otherUserId) : false;

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
                ? { uri: item.avatar! }
                : item.isGroup
                  ? require('../../assets/images/group.png')
                  : require('../../assets/images/personal.png')
            }
            style={styles.avatar}
          />
          {!item.isGroup && isOnline && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name && item.name.trim() !== '' ? item.name : '未知用户'}
              </Text>
            </View>
            <View style={styles.rightSection}>
              {item.timestamp && (
                <Text style={styles.time}>
                  {formatTime(item.timestamp)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.messageRow}>
            <Text 
              style={[
                styles.message,
                item.unreadCount > 0 && styles.unreadMessage
              ]} 
              numberOfLines={1}
            >
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
  }, [handleChatPress, currentUserId, onlineUsers]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFD860', '#FFD860']} style={styles.gradientHeader}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>森通</Text>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索聊天"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.listContainer}>
        <FlatList
          data={sortedAndFilteredChats}
          // ✅ 明确指定 keyExtractor 的参数类型
          keyExtractor={(item: ChatListItem) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          extraData={[onlineUsers, searchQuery]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => refreshData(true)}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#DDD" />
              <Text style={styles.emptyText}>
                {searchQuery ? '未找到相关聊天' : '暂无聊天记录'}
              </Text>
              {!searchQuery && (
                <Text style={styles.emptySubText}>
                  开始一段新的对话吧~
                </Text>
              )}
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
    paddingVertical: scaleHeight(10),
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    paddingBottom: scaleHeight(100),
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    padding: scaleWidth(12),
    marginBottom: scaleHeight(10),
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    marginRight: scaleWidth(12),
    position: 'relative',
  },
  avatar: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: borders.radius12,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: scaleWidth(12),
    height: scaleWidth(12),
    borderRadius: scaleWidth(6),
    backgroundColor: colors.functional.green,
    borderWidth: 2,
    borderColor: colors.background.white,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(6),
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scaleWidth(8),
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: colors.functional.red,
    borderRadius: borders.radius10,
    paddingHorizontal: scaleWidth(7),
    paddingVertical: scaleHeight(3),
    marginLeft: scaleWidth(8),
    minWidth: scaleWidth(20),
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
    fontWeight: typography.fontWeight600,
    color: colors.text.dark,
    flex: 1,
  },
  time: {
    fontSize: typography.fontSize12,
    color: colors.text.grayMedium,
    fontWeight: typography.fontWeight400,
  },
  message: {
    fontSize: typography.fontSize14,
    color: colors.text.grayMedium,
    flex: 1,
    lineHeight: 20,
  },
  unreadMessage: {
    color: colors.text.dark,
    fontWeight: typography.fontWeight500,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleHeight(80),
  },
  emptyText: {
    fontSize: typography.fontSize16,
    color: colors.text.grayMedium,
    marginTop: scaleHeight(16),
    fontWeight: typography.fontWeight500,
  },
  emptySubText: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
    marginTop: scaleHeight(8),
  },
});