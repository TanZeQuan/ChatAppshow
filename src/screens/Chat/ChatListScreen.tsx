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
import { ensureFullImageUrl } from '../../api/service';
import WebSocketManager from '../../services/WebSocketManager';
import { ChatListItem, useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (Dimensions.get("window").height / 812) * size;

// ✅ 优化：消息内容预览 - 支持更多类型
const formatLastMessagePreview = (message: string, type: number | undefined): string => {
  if (!message && type === undefined) return '开始聊天吧~';
  
  // 🔥 处理通话相关的消息
  if (message && typeof message === 'string') {
    // 检测语音通话消息
    if (message.includes('SINGLE_VOICE_CALL') || message.includes('GROUP_VOICE_CALL')) {
      return '[语音通话]';
    }
    // 检测其他可能的 JSON 格式消息
    if (message.startsWith('{') && message.includes('type')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type) {
          // 根据 type 字段返回友好提示
          if (parsed.type.includes('VOICE_CALL')) return '[语音通话]';
          if (parsed.type.includes('VIDEO_CALL')) return '[视频通话]';
        }
      } catch (e) {
        // JSON 解析失败，继续正常流程
      }
    }
  }
  
  // 根据消息类型返回
  switch (type) {
    case 2:
      return '[语音消息]';
    case 3:
      return '[图片]';
    case 4:
      return '[文件]';
    case 5:
      return '[视频]';
    default:
      return message || '新消息';
  }
};

// ✅ 优化：头像有效性验证
const isValidAvatar = (avatar: string | null | undefined): boolean => {
  if (!avatar) return false;
  const trimmed = avatar.trim();
  if (trimmed === '') return false;
  if (trimmed.includes('ngrok-free.dev') && !trimmed.includes('/content/')) return false;
  return true;
};

// ✅ 优化：智能时间格式化 - 更人性化的显示
const formatTime = (timestamp: string): string => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  
  // 处理无效日期
  if (isNaN(date.getTime())) return '';
  
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  // 判断是否是同一天
  const isSameDay = 
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  // 判断是否是昨天
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = 
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  // 1分钟内 → "刚刚"
  if (diffInMins < 1) {
    return '刚刚';
  }
  
  // 1小时内 → "X分钟前"
  if (diffInMins < 60) {
    return `${diffInMins}分钟前`;
  }
  
  // 今天 → 显示时间 "14:30"
  if (isSameDay) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // 昨天 → "昨天"
  if (isYesterday) {
    return '昨天';
  }
  
  // 一周内 → "星期X"
  if (diffInDays < 7) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  }
  
  // 今年内 → "MM/DD"
  if (date.getFullYear() === now.getFullYear()) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  }
  
  // 更早 → "YY/MM/DD"
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
};

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  
  const { chatList, setChats, addChat, getChatById } = useChatStore();
  const { user, onlineUsers } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUserId = user?.id;

  // 初始化加载
  useEffect(() => {
    if (currentUserId) {
      refreshData();
    }
  }, [currentUserId]);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        refreshData();
      }
    }, [currentUserId])
  );

  // 🔥 WebSocket 实时消息处理 - 优化版
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      // 只处理聊天消息
      if (!data.type || !data.chat_id) return;
      
      console.log('⚡️ [ChatList] 收到实时消息，置顶聊天:', {
        chatId: data.chat_id,
        message: data.message,
        type: data.type
      });
      
      const existingChat = getChatById(data.chat_id);
      
      // 🔥 使用当前时间作为时间戳，确保排在最前面
      const nowTimestamp = new Date().toISOString();
      
      const updatedChat: ChatListItem = {
        id: data.chat_id,
        name: existingChat?.name || data.sender || '新消息',
        avatar: existingChat?.avatar || null,
        isGroup: existingChat?.isGroup || false,
        members: existingChat?.members || [],
        memberIds: existingChat?.memberIds || [],

        // 更新消息预览
        lastMessage: formatLastMessagePreview(data.message, data.type),

        // 🔥 关键：使用最新时间戳，确保排序时在最前面
        timestamp: nowTimestamp,

        // 如果不是当前打开的聊天，增加未读数
        unreadCount: (existingChat?.unreadCount || 0) + 1,

        rawData: existingChat?.rawData || {},
        type: 0,
        online: false
      };

      // 更新聊天列表
      addChat(updatedChat);
    };

    WebSocketManager.addMessageCallback(handleWebSocketMessage);
    
    return () => {
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
  }, [addChat, getChatById]);

  // ✅ 优化：排序和搜索逻辑
  const sortedAndFilteredChats = useMemo(() => {
    let result = [...chatList];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(chat => 
        chat.name.toLowerCase().includes(query) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
      );
    }

    // 🔥 按时间戳降序排序（最新的在最前面）
    result.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [chatList, searchQuery]);

  // 点击进入聊天
  const handleChatPress = useCallback((chat: ChatListItem) => {
    // 获取最新的聊天数据
    const latestChat = getChatById(chat.id);
    
    // 清除未读计数
    addChat({ 
      ...(latestChat || chat), 
      unreadCount: 0 
    });

    // 导航到聊天室
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

  // 刷新数据
  const refreshData = async () => {
    if (!currentUserId) return;

    setIsRefreshing(true);

    try {
      const chatsResult = await readUserChats(currentUserId);
      
      if (chatsResult.success && chatsResult.data) {
        const formattedChats: ChatListItem[] = chatsResult.data.map((chat: any) => {
          const existingChat = getChatById(chat.chat_id);
          
          // 处理成员ID
          const existingMemberIds = existingChat?.memberIds || [];
          const backendMemberIds = chat.member_ids || chat.memberIds || chat.user_ids || [];
          const finalMemberIds = backendMemberIds.length > 0 ? backendMemberIds : existingMemberIds;

          // 判断是否是群聊
          const isGroup = chat.istype === 2 || chat.type === 2 || chat.isGroup || false;
          
          // 处理头像
          let finalAvatar = null;
          const apiImage = chat.image || chat.avatar;
          if (apiImage && apiImage.trim() !== '') {
            finalAvatar = ensureFullImageUrl(apiImage);
          }

          // 获取最后一条消息
          const lastMsgObj = (chat.message && chat.message.length > 0) 
            ? chat.message[chat.message.length - 1] 
            : null;
          const lastMessageText = lastMsgObj?.message || chat.last_message || '';
          const lastMessageType = lastMsgObj?.type || chat.last_message_type;

          // 🔥 时间戳处理：优先使用本地时间（如果更新）
          const backendTimestamp = chat.last_message_time || chat.timestamp || new Date().toISOString();
          const localTimestamp = existingChat?.timestamp;
          
          let finalTimestamp = backendTimestamp;
          if (localTimestamp) {
            const localTime = new Date(localTimestamp).getTime();
            const backendTime = new Date(backendTimestamp).getTime();
            if (localTime > backendTime) {
              finalTimestamp = localTimestamp;
            }
          }

          return {
            id: chat.chat_id,
            name: chat.name || chat.chat_name || '未命名聊天',
            avatar: finalAvatar,
            isGroup: isGroup,
            members: chat.members || [],
            memberIds: finalMemberIds,
            lastMessage: formatLastMessagePreview(lastMessageText, lastMessageType),
            timestamp: finalTimestamp,
            unreadCount: chat.unread || chat.unread_count || 0,
            rawData: chat,
          };
        });

        setChats(formattedChats);
        
        // 异步加载群组成员信息
        loadGroupMembersForAllChats(formattedChats);
      }
    } catch (error) {
      console.error("刷新聊天列表失败:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 加载群组成员信息
  const loadGroupMembersForAllChats = async (chats: ChatListItem[]) => {
    if (!currentUserId) return;
    
    const groupChats = chats.filter(chat => chat.isGroup);

    for (const chat of groupChats) {
      const cachedChat = getChatById(chat.id);
      
      // 如果已有成员信息，跳过
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

  // 渲染聊天项
  const renderChatItem = useCallback(({ item }: { item: ChatListItem }) => {
    // 判断对方是否在线（仅私聊）
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
        {/* 头像区域 */}
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
          {/* 在线状态指示器（仅私聊） */}
          {!item.isGroup && isOnline && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        {/* 聊天内容区域 */}
        <View style={styles.chatContent}>
          {/* 第一行：名称 + 时间 */}
          <View style={styles.chatHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
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

          {/* 第二行：消息预览 + 未读徽章 */}
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
      {/* 渐变头部 */}
      <LinearGradient colors={['#FFD860', '#FFD860']} style={styles.gradientHeader}>
        <SafeAreaView edges={['top']}>
          {/* 标题 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>森通</Text>
          </View>
          
          {/* 搜索框 */}
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

      {/* 聊天列表 */}
      <View style={styles.listContainer}>
        <FlatList
          data={sortedAndFilteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          extraData={[onlineUsers, searchQuery]}
          showsVerticalScrollIndicator={false}
          onRefresh={refreshData}
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

// 样式定义
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