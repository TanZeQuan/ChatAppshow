import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';
import { readChatMessages, sendChatMessage } from '../../api/Chat';
import { createFriendRequest, readFriends } from '../../api/Friend';
import { ensureFullImageUrl } from '../../api/service';
import { useSearchChatHistory } from '../../components/ChatHistory';
import { ChatInputBar } from '../../components/ChatInputBar';
import { MessageBubble } from '../../components/MessageBubble';
import { SearchHeader } from '../../components/SearchHeader';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { chatRoomSpecificStyles, createRoomStyles } from "../../styles/chatRoomStyles";

const { width, height } = Dimensions.get("window");

// Responsive scaling functions
const scaleWidth = (size: number) => (width / 375) * size;

interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number; // 1=text, 2=voice, 3=images, 4=call/card, 5=video
  imageUrls?: string[];
  voiceUrl?: string;
  videoUrl?: string; // ✅ 新增：视频消息 URL
  // ✅ New: For MessageBubble to identify contact cards
  cardData?: {
    userId: string;
    userName: string;
    userAvatar?: string;
  };
  createdAt: string;
  sender: 'me' | 'other';
  username?: string;
  avatar?: string;
  // ✅ FIX: Add readBy to interface to prevent type errors in UI
  readBy?: string[];
}

interface RouteParams {
  otherUserId?: string;
  chatId: string;
  chatName: string;
  searchMode?: boolean;
}

export default function ChatRoomScreen() {
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const params = route.params as RouteParams;
  const { chatId, chatName } = params;
  const [isFriendDeleted, setIsFriendDeleted] = useState(false);
  const [isCheckingFriendStatus, setIsCheckingFriendStatus] = useState(false);

  // Get current user info from store
  const currentUser = useUserStore((state) => state.user);
  const currentUserId = currentUser?.id || 'me';
  const currentUserName = currentUser?.name || 'Me';
  const currentUserAvatar = currentUser?.avatar || '';

  const { getChatById, clearChat } = useChatStore();

  // Get chat metadata from store
  const chat = getChatById(chatId);

  // Use selector to subscribe to messages for this chat (reactive)
  const messagesFromStore = useChatStore((state) => state.chats[chatId]);

  const storedMessages = useMemo(() => messagesFromStore || [], [messagesFromStore]);

  const [inputText, setInputText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatMembers, setChatMembers] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});


  // ✅ 优化 1: 添加滚动控制 Ref 和 状态
  const flatListRef = useRef<FlatList>(null);
  const [isNearBottom, setIsNearBottom] = useState(true); // 默认在底部
  const lastMessageIdRef = useRef<string | null>(null); // 记录最后一条消息ID，防止重复滚动

  // ✅ Search functionality
  const {
    searchMode,
    searchQuery,
    enableSearch,
    disableSearch,
    setSearchQuery,
    filterMessages,
    matchedMessageIds,
    currentMatchId,
    currentMatchNumber,
    totalMatches,
    goToNextMatch,
    goToPrevMatch
  } = useSearchChatHistory();

  const otherUserId = useMemo(() => {
    // 群聊不需要检测
    if (chat?.isGroup) return null;

    // 优先级1: 从路由参数获取（最准确）
    if (params.otherUserId) {
      // otherUserId from params
      return params.otherUserId;
    }

    // 优先级2: 从成员列表中找
    const foundInMembers = chatMembers.find(id => id !== currentUserId);
    if (foundInMembers) {
      // otherUserId from chatMembers
      return foundInMembers;
    }

    // 优先级3: 从 chat.memberIds 找
    if (chat?.memberIds) {
      const foundInChatMemberIds = chat.memberIds.find((id: string) => id !== currentUserId);
      if (foundInChatMemberIds) {
        // otherUserId from chat.memberIds
        return foundInChatMemberIds;
      }
    }

    // Could not find otherUserId
    return null;
  }, [chat, chatMembers, currentUserId, params.otherUserId]);

  // 新增：检查好友状态函数
  const checkFriendStatus = useCallback(async () => {
    // 群聊或没有对方ID，跳过检测
    if (!otherUserId || chat?.isGroup) {
      setIsFriendDeleted(false);
      return;
    }

    try {
      setIsCheckingFriendStatus(true);

      // 检查好友状态

      // 获取已接受的好友列表 (isstatus = 2)
      const result = await readFriends(2);

      if (result.success && result.data) {
        const allFriends = [
          ...(result.data.request || []),
          ...(result.data.approve || [])
        ];

        // 好友列表已加载

        // 检查对方是否还在好友列表中
        const friendExists = allFriends.some(
          (friend: any) => friend.user_id === otherUserId
        );

        setIsFriendDeleted(!friendExists);

        if (!friendExists) {
          // 对方已删除好友关系
        } else {
          // 好友关系正常
        }
      }
    } catch (error) {
      console.error('❌ [ChatRoom] Check friend status error');
      // 出错时保守处理，允许继续聊天
      setIsFriendDeleted(false);
    } finally {
      setIsCheckingFriendStatus(false);
    }
  }, [otherUserId, chat?.isGroup]);

  // ✅ 新增：重新添加好友的处理函数
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  
  const handleReAddFriend = useCallback(async () => {
    if (!otherUserId) {
      Alert.alert('错误', '无法获取用户信息');
      return;
    }

    setIsAddingFriend(true);

    try {
      // 发送好友请求
      
      const result = await createFriendRequest(otherUserId, '请求重新添加好友');

      if (result.success) {
        Alert.alert('成功', '好友请求已发送，等待对方确认');
      } else {
        // 检查是否是"已发送过请求"的情况
        const errorMessage = result.message || '';
        if (errorMessage.includes('已发送') || errorMessage.includes('already') || errorMessage.includes('pending')) {
          Alert.alert('提示', '好友请求已发送，请等待对方确认');
        } else {
          Alert.alert('发送失败', result.message || '请稍后重试');
        }
      }
    } catch (error: any) {
      console.error('❌ [ChatRoom] Send friend request error');
      Alert.alert('发送失败', '网络错误，请稍后重试');
    } finally {
      setIsAddingFriend(false);
    }
  }, [otherUserId]);

  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [ChatRoom] Focus | chatId:', chatId);
      loadMessages(false, false);

      // ✅ 同时检查好友状态
      if (otherUserId && !chat?.isGroup) {
        checkFriendStatus();
      }

      if (chatMembers && chatMembers.length > 0) {
        const otherMembers = chatMembers.filter(id => id !== currentUserId);
        if (otherMembers.length > 0) {
          WebSocketManager.sendReadSignal({
            receiver: otherMembers,
            chat_id: chatId
          });
        }
      }
    }, [otherUserId, chat?.isGroup, chatMembers, checkFriendStatus, currentUserId, chatId])
  );


  // ✅ Transform messages - logic enhanced to parse JSON for cards
  const messages: DisplayMessage[] = useMemo(() => {
    return storedMessages.map(msg => {
      let cardData = undefined;

      // Try to parse cardData (if Type 4 and contains userId)
      if (msg.type === 4 && typeof msg.text === 'string') {
        try {
          const parsed = JSON.parse(msg.text);
          // Simple check: if userId and userName exist, consider it a contact card
          if (parsed.userId && parsed.userName) {
            cardData = parsed;
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      return {
        ...msg,
        sender: msg.senderId === currentUserId ? 'me' : 'other',
        senderName: msg.senderId === currentUserId ? currentUserName : (msg.name || chatName),
        voiceUrl: msg.voiceUrl && typeof msg.voiceUrl === 'object' && (msg.voiceUrl as any).message
          ? String((msg.voiceUrl as any).message)
          : msg.voiceUrl,
        cardData: cardData, // Pass to Bubble
      };
    });
  }, [storedMessages, currentUserId, currentUserName, chatName]);

  // 🔧 Initialize chatMembers from store if available
  useEffect(() => {
    if (chat?.memberIds && chat.memberIds.length > 0) {
      setChatMembers(chat.memberIds);
    }
  }, [chat?.memberIds]);

  const offsetRef = useRef(0);

  // ✅ 优化 2: 改进的滚动到底部函数
  // 使用 setTimeout 确保消息已渲染到 DOM 后再滚动
  const scrollToBottom = useCallback((animated = true, delay = 0) => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToOffset({ offset: 0, animated });
      }
    }, delay);
  }, [messages.length]);

  // ✅ 优化 3: 更智能的消息监听和滚动逻辑
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[0];
    const latestMessageId = latestMessage.id;

    // 防止重复滚动：如果是同一条消息，不处理
    if (lastMessageIdRef.current === latestMessageId) {
      return;
    }

    // 更新最后一条消息 ID
    lastMessageIdRef.current = latestMessageId;

    // 情况 A: 我自己发的消息 -> 必须强制滚到底部（立即滚动，带动画）
    if (latestMessage.senderId === currentUserId) {
      scrollToBottom(true, 50); // 50ms 延迟确保消息已渲染
      return;
    }

    // 情况 B: 收到别人发的消息
    // 逻辑：如果我当前就在底部（isNearBottom），说明我在等消息，自动滚动显示
    // 如果我在看上面的历史记录（isNearBottom = false），就不滚，避免打断阅读
    if (isNearBottom) {
      scrollToBottom(true, 100); // 收到消息时稍长延迟，让动画更平滑
    }
    // 如果不在底部，可以考虑显示"新消息"提示（未实现）
  }, [messages.length, currentUserId, isNearBottom, scrollToBottom, messages]);


  // ✅ Use voice recorder hook
  const {
    isRecording,
    isPreparing,
    isUploading,
    playingVoice,
    voiceDurations,
    playbackPosition,
    startRecording,
    stopRecording,
    playAudio,
    stopAudio,
    formatTime,
    preloadVoiceDuration,
  } = useVoiceRecorder({
    chatId,
    currentUserId,
    chatMembers,
    onMessageSent: () => {
      loadMessages(false, false);
      scrollToBottom(true, 100);
    },
    // ✅ 传入好友删除状态
  });

  // ✅ 预加载语音消息时长
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.type === 2 && msg.voiceUrl && !voiceDurations[msg.id]) {
        preloadVoiceDuration(msg.voiceUrl, msg.id);
      }
    });
  }, [messages, voiceDurations, preloadVoiceDuration]);

  // Wrap loadMessages in useCallback
  const loadMessages = useCallback(async (loadMore = false, showLoading = true) => {
    if (!currentUserId) return;

    const user = useUserStore.getState().user;
    const userName = user?.name || 'Me';
    const userAvatar = user?.avatar || '';

    try {
      if (!loadMore && showLoading) {
        setIsLoading(true);
      }

      const currentOffset = loadMore ? offsetRef.current : 0;

      const result = await readChatMessages({
        chat_id: chatId,
        user_id: currentUserId,
        offset: currentOffset,
      });

      if (result.success && result.data) {
        const apiMessages = result.data.chat || [];
        const groupMembers = result.data.group || [];

        const memberInfoMap: Record<string, { name: string, avatar: string }> = {};

        if (groupMembers.length > 0) {
          const memberIds = groupMembers.map((member: any) => member.user_id);
          setChatMembers(prev => prev.length > 0 ? prev : memberIds);

          groupMembers.forEach((member: any) => {
            const memberAvatar = member.image || '';
            const fullAvatarUrl = ensureFullImageUrl(memberAvatar);

            memberInfoMap[member.user_id] = {
              name: member.name || 'Unknown',
              avatar: fullAvatarUrl,
            };
          });
        }

        if (apiMessages.length > 0) {
          const transformedMessages = apiMessages.map((msg: any) => {
            let messageText = '';
            let messageType = 1;
            let imageUrls: string[] = [];
            let voiceUrl: string = '';
            let videoUrl: string = ''; // ✅ 新增：视频 URL
            let cardData: any = null;

            try {
              let parsedMessage: any;

              if (typeof msg.message === 'string') {
                try {
                  parsedMessage = JSON.parse(msg.message);
                } catch {
                  parsedMessage = { message: msg.message };
                }
              } else if (typeof msg.message === 'object' && msg.message !== null) {
                parsedMessage = msg.message;
              } else {
                parsedMessage = { message: String(msg.message || '') };
              }

              if (msg.type) {
                messageType = msg.type;
              } else if (parsedMessage.type) {
                messageType = parsedMessage.type;
              }

              if (messageType === 3) {
                // ✅ 先提取 URL 列表
                let mediaUrls: string[] = [];
                if (Array.isArray(parsedMessage)) {
                  mediaUrls = parsedMessage;
                }
                else if (parsedMessage.message && Array.isArray(parsedMessage.message)) {
                  mediaUrls = parsedMessage.message;
                }
                else if (parsedMessage.message && typeof parsedMessage.message === 'string') {
                  mediaUrls = parsedMessage.message.split(',').map((url: string) => url.trim());
                }

                // ✅ 检测是否是视频文件（通过路径或扩展名判断）
                const isVideoFile = (url: string) => {
                  const lowerUrl = url.toLowerCase();
                  return lowerUrl.includes('/video/') || 
                         lowerUrl.endsWith('.mp4') || 
                         lowerUrl.endsWith('.mov') || 
                         lowerUrl.endsWith('.avi') ||
                         lowerUrl.endsWith('.webm');
                };

                // ✅ 如果第一个 URL 是视频，按视频处理
                if (mediaUrls.length > 0 && isVideoFile(mediaUrls[0])) {
                  videoUrl = ensureFullImageUrl(mediaUrls[0]);
                  messageType = 5; // 强制改为视频类型
                  messageText = '[Video]';
                } else {
                  // 正常图片处理
                  imageUrls = mediaUrls.map((url: string) => ensureFullImageUrl(url));
                  messageText = `[${imageUrls.length} images]`;
                }
              }
              else if (messageType === 2) {
                if (typeof parsedMessage === 'string') { // Direct URL
                  voiceUrl = ensureFullImageUrl(parsedMessage);
                  messageText = '[Voice Message]';
                } else if (parsedMessage.message) { // Nested message object
                  if (typeof parsedMessage.message === 'object' && parsedMessage.message.error === true) {
                    voiceUrl = '';
                    messageText = '[Voice upload failed]';
                  } else if (typeof parsedMessage.message === 'object' && parsedMessage.message.uri) {
                    voiceUrl = ensureFullImageUrl(parsedMessage.message.uri);
                    messageText = '[Voice Message]';
                  } else if (typeof parsedMessage.message === 'string') {
                    voiceUrl = ensureFullImageUrl(parsedMessage.message);
                    messageText = '[Voice Message]';
                  }
                }
              }
              // ✅ 处理视频消息 (type === 5)
              else if (messageType === 5) {
                if (typeof parsedMessage === 'string') {
                  videoUrl = ensureFullImageUrl(parsedMessage);
                } else if (Array.isArray(parsedMessage) && parsedMessage.length > 0) {
                  videoUrl = ensureFullImageUrl(parsedMessage[0]);
                } else if (parsedMessage.message && Array.isArray(parsedMessage.message) && parsedMessage.message.length > 0) {
                  videoUrl = ensureFullImageUrl(parsedMessage.message[0]);
                } else if (parsedMessage.message && typeof parsedMessage.message === 'string') {
                  const urls = parsedMessage.message.split(',').map((url: string) => url.trim());
                  if (urls.length > 0) {
                    videoUrl = ensureFullImageUrl(urls[0]);
                  }
                }
                messageText = '[Video]';
              }
              else {
                if (typeof parsedMessage === 'string') {
                  messageText = parsedMessage;
                } else if (parsedMessage.message) {
                  messageText = String(parsedMessage.message);
                } else {
                  messageText = String(parsedMessage);
                }
              }
            } catch (e) {
              messageText = typeof msg.message === 'string'
                ? msg.message
                : JSON.stringify(msg.message);
            }

            const senderInfo = memberInfoMap[msg.sender] || {
              name: msg.sender === currentUserId ? userName : undefined,
              avatar: msg.sender === currentUserId ? userAvatar : undefined,
            };

            return {
              id: msg.message_id,
              text: messageText,
              type: messageType,
              imageUrls: imageUrls,
              voiceUrl: voiceUrl,
              videoUrl: videoUrl, // ✅ 新增：视频 URL
              createdAt: msg.created_at,
              senderId: msg.sender,
              name: senderInfo.name,
              avatar: senderInfo.avatar,
            };
          });

          const { setMessages } = useChatStore.getState();
          const existingMessages = useChatStore.getState().chats[chatId] || [];

          if (loadMore) {
            const allMessages = [...existingMessages, ...transformedMessages];
            // ✅ 去重：使用 Map 确保 key 唯一
            const uniqueMessages = Array.from(
              new Map(allMessages.map((m: any) => [m.id, m])).values()
            ) as any[];
            setMessages(chatId, uniqueMessages);
            offsetRef.current += apiMessages.length;
          } else {
            // ✅ 合并新旧消息并去重
            const allMessages = [...transformedMessages, ...existingMessages];
            const uniqueMessages = Array.from(
              new Map(allMessages.map((m: any) => [m.id, m])).values()
            ) as any[];
            setMessages(chatId, uniqueMessages);
            offsetRef.current = Math.max(offsetRef.current, apiMessages.length);
          }
        }
      }

      if (showLoading) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("❌ [ChatRoom] Load messages error");
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [currentUserId, chatId]);

  // Load messages on mount
  useEffect(() => {
    offsetRef.current = 0;
    loadMessages();

    const connectionCheckInterval = setInterval(() => {
      const connected = WebSocketManager.isWebSocketConnected();
      if (!connected) {
        console.warn('⚠️ [ChatRoom] WebSocket disconnected');
      }
    }, 10000);

    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, [loadMessages]);

  // Listen for WebSocket read receipts
  useEffect(() => {
    const handleReadReceipt = (data: { chatId: string; readerId: string }) => {
      if (data.chatId !== chatId) return;

      // ✅ 1. 更新消息的 readBy 字段，让 MessageBubble 显示双勾
      const existingMessages = useChatStore.getState().chats[chatId] || [];
      const updatedMessages = existingMessages.map((msg: any) => {
        // 只更新「我发的消息」的 readBy 字段
        if (msg.senderId === currentUserId) {
          const currentReadBy = msg.readBy || [];
          // 如果对方还没在 readBy 列表中，添加进去
          if (!currentReadBy.includes(data.readerId)) {
            return { ...msg, readBy: [...currentReadBy, data.readerId] };
          }
        }
        return msg;
      });

      // ✅ FIX: Cast to any to bypass strict type checking in store
      useChatStore.getState().setMessages(chatId, updatedMessages as any);

      // ✅ 2. 同时更新 chatList 的状态（可选，用于聊天列表显示）
      const chatList = useChatStore.getState().chatList;
      const updatedChatList = chatList.map(c => {
        if (c.id === chatId) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      useChatStore.getState().setChats(updatedChatList);
    };

    WebSocketManager.addReadReceiptCallback(handleReadReceipt);
    return () => {
      WebSocketManager.removeReadReceiptCallback(handleReadReceipt);
    };
  }, [chatId, currentUserId]);

  // Listen for WebSocket typing indicators
  useEffect(() => {
    const handleTypingIndicator = (data: { chatId: string; userId: string; isTyping: boolean }) => {
      if (data.chatId !== chatId) return;

      setTypingUsers(prev => {
        const newTypingUsers = { ...prev };
        if (data.isTyping) {
          newTypingUsers[data.userId] = true;
        } else {
          delete newTypingUsers[data.userId];
        }
        return newTypingUsers;
      });
    };

    WebSocketManager.addTypingIndicatorCallback(handleTypingIndicator);
    return () => {
      WebSocketManager.removeTypingIndicatorCallback(handleTypingIndicator);
    };
  }, [chatId]);

  // Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      // Screen focused
      loadMessages(false, false);

      if (chatMembers && chatMembers.length > 0) {
        const otherMembers = chatMembers.filter(id => id !== currentUserId);
        if (otherMembers.length > 0) {
          WebSocketManager.sendReadSignal({
            receiver: otherMembers, // Pass otherMembers as an array
            chat_id: chatId
          });
        }
      }
    }, [loadMessages, chatId, chatMembers, currentUserId])
  );

  // Auto-enable search mode if navigated from settings (ONCE)
  const searchModeInitialized = useRef(false);
  useEffect(() => {
    if (params.searchMode === true && !searchModeInitialized.current) {
      enableSearch();
      searchModeInitialized.current = true;
    }
  }, [params.searchMode, enableSearch]);

  const typingIndicatorText = useMemo(() => {
    const usersTyping = Object.keys(typingUsers).filter(userId => typingUsers[userId] && userId !== currentUserId);
    if (usersTyping.length === 0) {
      return null;
    }

    // For 1-on-1 chat
    if (!chat?.isGroup) {
      return `${chatName} is typing...`;
    }

    // For group chat, we need to get names
    const memberNameMap = new Map<string, string>();
    if (chat?.members) {
      chat.members.forEach((m: any) => memberNameMap.set(m.user_id, m.name));
    }

    const typingNames = usersTyping.map(userId => memberNameMap.get(userId) || 'Someone');

    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    }
    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing...`;
    }
    return 'Several people are typing...';
  }, [typingUsers, chat, chatName, currentUserId]);

  const scrollToMatch = useCallback((messageId: string) => {
    // ✅ 优化 4: 使用 ref 滚动
    if (!messageId || !flatListRef.current) return;
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex >= 0) {
      flatListRef.current.scrollToIndex({ index: messageIndex, animated: true, viewPosition: 0.5 });
    }
  }, [messages]);

  const handleNextMatch = useCallback(() => {
    const nextMessageId = goToNextMatch(messages);
    if (nextMessageId) scrollToMatch(nextMessageId);
  }, [goToNextMatch, scrollToMatch, messages]);

  const handlePrevMatch = useCallback(() => {
    const prevMessageId = goToPrevMatch(messages);
    if (prevMessageId) scrollToMatch(prevMessageId);
  }, [goToPrevMatch, scrollToMatch, messages]);

  // WebSocket Handler
  const chatIdRef = useRef(chatId);
  const loadMessagesRef = useRef(loadMessages);

  useEffect(() => {
    chatIdRef.current = chatId;
    loadMessagesRef.current = loadMessages;
  }, [chatId, loadMessages]);

  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      // Ensure the message is for the current chat and is a valid message object
      if (data && data.message_id && data.chat_id === chatIdRef.current) {
        // --- Start of Optimization ---
        const { addMessage } = useChatStore.getState();

        // Construct the new message object from the WebSocket payload
        // Assumption: Backend includes sender_name, sender_avatar, and created_at
        // ✅ 修复：如果后端没返回 created_at，生成马来西亚时间格式（与后端 API 一致）
        let messageCreatedAt = data.created_at;
        if (!messageCreatedAt) {
          // 生成 GMT+8 马来西亚时间，格式 "YYYY-MM-DD HH:mm:ss"
          const now = new Date();
          const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          const gmt8 = new Date(utc + (8 * 60 * 60000));
          const year = gmt8.getFullYear();
          const month = String(gmt8.getMonth() + 1).padStart(2, '0');
          const day = String(gmt8.getDate()).padStart(2, '0');
          const hour = String(gmt8.getHours()).padStart(2, '0');
          const minute = String(gmt8.getMinutes()).padStart(2, '0');
          const second = String(gmt8.getSeconds()).padStart(2, '0');
          messageCreatedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
        
        const receivedMessage = {
          id: data.message_id,
          text: data.message,
          createdAt: messageCreatedAt,
          senderId: data.sender,
          type: data.type || 1,
          name: data.sender_name || 'Unknown User', // Use sender info from payload
          avatar: data.sender_avatar || '',
          readBy: [],
        };

        // Add the message to the store, UI will update automatically
        addMessage({ chatId: data.chat_id, ...receivedMessage });
        // --- End of Optimization ---
      } else if (data.type && data.message) {
        // Fallback for older message formats or system messages that still use reload
        if (!data.chat_id || data.chat_id === chatIdRef.current) {
          // Fallback to loadMessages
          loadMessagesRef.current(false, false);
        }
      }
    };
    WebSocketManager.addMessageCallback(handleWebSocketMessage);
    return () => {
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages(false, false);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoading) {
      loadMessages(true, true);
    }
  };

  useEffect(() => {
    if (searchMode && searchQuery.trim()) {
      filterMessages(messages);
    }
  }, [messages, searchMode, searchQuery, filterMessages]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      parent?.setOptions({
        tabBarStyle: getOriginalTabBarStyle(insets),
      });
    };
  }, [insets, navigation]);

  // Handle Send Text
  const handleSend = async () => {
    if (!inputText.trim()) return;

    // ✅ 如果对方已删除好友，阻止发送
    if (isFriendDeleted) {
      Alert.alert('无法发送', '对方已删除好友关系，无法发送消息');
      return;
    }

    const messageText = inputText.trim();
    setInputText('');

    scrollToBottom(true, 0);

    const { addMessage } = useChatStore.getState();

    try {
      const receiver = chatMembers.filter(id => id !== currentUserId);
      const result = await sendChatMessage({
        sender: currentUserId,
        isreceive: receiver,
        chat_id: chatId,
        message: messageText,
      });

      if (result.success && result.data && result.data.message_id) {
        const sentMessage = result.data;

        // ✅ 修复：如果后端没返回 created_at，生成马来西亚时间格式
        let sentCreatedAt = sentMessage.created_at;
        if (!sentCreatedAt) {
          const now = new Date();
          const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          const gmt8 = new Date(utc + (8 * 60 * 60000));
          const year = gmt8.getFullYear();
          const month = String(gmt8.getMonth() + 1).padStart(2, '0');
          const day = String(gmt8.getDate()).padStart(2, '0');
          const hour = String(gmt8.getHours()).padStart(2, '0');
          const minute = String(gmt8.getMinutes()).padStart(2, '0');
          const second = String(gmt8.getSeconds()).padStart(2, '0');
          sentCreatedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
        
        const newMessageForStore = {
          id: sentMessage.message_id,
          text: messageText,
          createdAt: sentCreatedAt,
          senderId: currentUserId,
          type: sentMessage.type || 1,
          name: currentUserName,
          avatar: currentUserAvatar,
          readBy: [],
        };

        addMessage({ chatId, ...newMessageForStore });

        const actualReceivers = (sentMessage.isreceive && sentMessage.isreceive.length > 0)
          ? sentMessage.isreceive
          : receiver;

        if (actualReceivers.length > 0) {
          WebSocketManager.sendForwardMessage({
            type: sentMessage.type,
            message: messageText,
            message_id: sentMessage.message_id,
            sender: currentUserId,
            receiver: actualReceivers,
            chat_id: chatId
          });
        }
      } else {
        // ✅ 检测后端返回的错误信息
        const errorMessage = result.message || '';
        if (errorMessage.includes('好友') ||
          errorMessage.includes('关系不存在') ||
          errorMessage.includes('Friend') ||
          errorMessage.includes('deleted')) {
          setIsFriendDeleted(true);
          Alert.alert('无法发送', '对方已删除好友关系');
          return;
        }

        Alert.alert('发送失败', result.message || '消息发送失败，请重试');
        setInputText(messageText);
      }
    } catch (error: any) {
      console.error("❌ [ChatRoom] Send error");

      // ✅ 检测异常中的错误信息
      const errorMessage = error.response?.data?.message || error.message || '';
      if (errorMessage.includes('好友') ||
        errorMessage.includes('关系不存在') ||
        errorMessage.includes('Friend')) {
        setIsFriendDeleted(true);
        Alert.alert('无法发送', '对方已删除好友关系');
        return;
      }

      Alert.alert('发送失败', '网络错误，请重试');
      setInputText(messageText);
    }
  };

  const handleClearChat = useCallback(() => {
    Alert.alert(
      '清空聊天记录', // Title
      '确定要清空此聊天记录吗？此操作仅删除您设备上的记录。', // Message (明确告知只删自己的)
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);

              // 1. 清除本地 Store (这是最快反应)
              clearChat(chatId);

              // 2. (可选) 如果有后端接口，在这里调用
              // 比如: await api.clearHistory(chatId); 

              // 3. 刷新 UI
              setRefreshing(true);
              // 模拟刷新一下空列表，或者直接清空当前 messages
              // 由于 clearChat 已经清空了 store，这里的 storedMessages 会自动更新变为空

              Alert.alert('成功', '聊天记录已清空');
            } catch (error) {
              console.error('❌ [ChatRoom] Clear chat error');
              Alert.alert('错误', '清空失败，请重试');
            } finally {
              setIsLoading(false);
              setRefreshing(false);
            }
          }
        }
      ]
    );
  }, [chatId, clearChat]);

  const handleOpenSettings = () => {
    const chat = getChatById(chatId);

    if (chat?.isGroup) {
      // 群聊逻辑不变
      navigation.navigate('GroupSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        members: chat.members || [],
        memberIds: chat.memberIds || [],
      });
    } else {
      // === 单聊逻辑 ===

      // 1. 尝试从 Store 的成员列表中找对方
      let targetId = chatMembers.find(id => id !== currentUserId);

      // 2. 如果 Store 里没找到 (比如是新发起的临时会话)，尝试从 Store 的 memberIds 找
      if (!targetId && chat?.memberIds) {
        targetId = chat.memberIds.find((id: string) => id !== currentUserId);
      }

      // 🔥🔥🔥 3. 核心修复：如果上面都找不到，使用路由传过来的参数 (params.otherUserId) 🔥🔥🔥
      if (!targetId && params.otherUserId) {
        // Using params.otherUserId fallback
        targetId = params.otherUserId;
      }

      // 4. 安全检查
      if (!targetId) {
        // 无法找到对方 ID
        Alert.alert('提示', '找不到用户信息，请重试');
        return;
      }

      // Opening ChatSettings

      // 跳转到私聊设置页 (即个人资料页)
      navigation.navigate('ChatSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        avatar: chat?.avatar || '',
        otherUserId: targetId, // ✅ 现在这里一定有值了
      });
    }
  };

  const pickImage = async () => {
    if (isFriendDeleted) {
      Alert.alert('无法发送', '对方已删除好友关系，无法发送图片');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setIsUploadingImage(true);
        // ✅ 发送图片时也滚动（稍长延迟等待上传）
        scrollToBottom(true, 0);

        try {
          const receiver = chatMembers.filter(id => id !== currentUserId);
          const files = result.assets.map(asset => {
            const fileName = asset.fileName || 'image.jpg';
            const extension = fileName.split('.').pop()?.toLowerCase();
            let mimeType = 'image/jpeg';
            if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
            else if (extension === 'gif') mimeType = 'image/gif';
            else if (extension === 'webp') mimeType = 'image/webp';
            return { uri: asset.uri, name: fileName, type: mimeType };
          });

          const apiResult = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            files: files
          });

          if (apiResult.success && apiResult.data) {
            const actualReceivers = (apiResult.data.isreceive && apiResult.data.isreceive.length > 0)
              ? apiResult.data.isreceive : receiver;

            if (actualReceivers.length > 0) {
              WebSocketManager.sendForwardMessage({
                type: apiResult.data.type,
                message: apiResult.data.message,
                message_id: apiResult.data.message_id,
                sender: currentUserId,
                receiver: actualReceivers,
                chat_id: chatId
              });
            }
            await loadMessages(false, false);
          } else {
            Alert.alert('Send Failed', apiResult.message || 'Image failed to send, please retry');
          }
        } catch (error: any) {
          Alert.alert('Send Failed', error.message || 'Network error, please retry');
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      Alert.alert('Selection Failed', 'Error selecting image');
    }
  };

  // ✅ 选择并发送视频
  const pickVideo = async () => {
    if (isFriendDeleted) {
      Alert.alert('无法发送', '对方已删除好友关系，无法发送视频');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '需要相册权限才能选择视频');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60, // 限制60秒
      });

      if (!result.canceled && result.assets.length > 0) {
        const videoAsset = result.assets[0];
        const fileName = videoAsset.fileName || 'video.mp4';
        const extension = fileName.split('.').pop()?.toLowerCase();
        
        // 检查视频格式
        if (extension !== 'mp4') {
          Alert.alert(
            '格式不支持',
            `当前视频格式为 ${extension?.toUpperCase()}，仅支持 MP4 格式。\n\n请选择 MP4 格式的视频，或使用其他工具转换后再上传。`,
            [{ text: '确定', style: 'default' }]
          );
          return;
        }

        setIsUploadingImage(true);
        scrollToBottom(true, 0);

        try {
          const receiver = chatMembers.filter(id => id !== currentUserId);
          const videoFile = {
            uri: videoAsset.uri,
            name: fileName,
            type: 'video/mp4',
          };

          const apiResult = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            files: [videoFile],
            type: 5, // type 5 = video
          });

          if (apiResult.success && apiResult.data) {
            const actualReceivers = (apiResult.data.isreceive && apiResult.data.isreceive.length > 0)
              ? apiResult.data.isreceive : receiver;

            if (actualReceivers.length > 0) {
              WebSocketManager.sendForwardMessage({
                type: apiResult.data.type || 5,
                message: apiResult.data.message,
                message_id: apiResult.data.message_id,
                sender: currentUserId,
                receiver: actualReceivers,
                chat_id: chatId
              });
            }
            await loadMessages(false, false);
          } else {
            Alert.alert('发送失败', apiResult.message || '视频发送失败，请重试');
          }
        } catch (error: any) {
          console.error('❌ [ChatRoom] Video upload error');
          Alert.alert('发送失败', error.message || '网络错误，请重试');
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('❌ [ChatRoom] Video picker error');
      Alert.alert('选择失败', '选择视频时出错');
    }
  };

  // ✅ 修正版：单聊和群聊分别跳转到正确的 Screen
  const handleStartCall = useCallback(async () => {
    // ===========================
    // 1. 群聊逻辑 (Group Call)
    // ===========================
    if (chat?.isGroup) {
      // 先跳转到群通话界面，让 GroupCallScreen 负责：
      // 1. 调用 API 获取 call_id
      // 2. 发送通话消息（包含 call_id）
      // 3. 通过 WebSocket 发送 JOIN_CALL 通知
      navigation.navigate('GroupCallScreen', {
        chatId,
        isHost: true // 标记我是主持人
      });
    }
    // ===========================
    // 2. 单聊逻辑 (1v1 Call)
    // ===========================
    else {
      const otherUserId = chatMembers.find(id => id !== currentUserId);

      if (otherUserId) {
        // 尝试获取对方名字/头像，确保传参准确
        const contact = getChatById(otherUserId);
        const targetName = contact?.name || chatName || '未知用户';
        const targetAvatar = contact?.avatar || chat?.avatar || '';

        // 跳转单聊页面

        // ❗ 注意：单聊是跳 CallScreen
        navigation.navigate('SingleCallScreen', {
          callerId: currentUserId,   // 传自己ID (备用)
          targetId: otherUserId,     // ❌ 必须传：你要打给谁
          chatId: chatId,
          isIncoming: false,         // ✅ 必须是 false (拨出状态)
          userName: targetName,      // 传名字给 CallScreen 显示
          userAvatar: targetAvatar   // 传头像给 CallScreen 显示
        });

        // ❌ 删除 WebSocketManager.startCall(...)
        // 原因：CallScreen 页面加载时会自动发起 startCall，这里再写就重复了
      } else {
        Alert.alert('错误', '无法找到对方信息');
      }
    }
  }, [chat, chatId, currentUserName, currentUserId, chatMembers, navigation, chatName, getChatById]);


  // ✅ Core Addition: Send Contact Card Logic
  // ✅ 发送名片逻辑 (已修复头像为空的情况)
  const handleSendContactCard = useCallback(() => {
    if (isFriendDeleted) {
      Alert.alert('无法发送', '对方已删除好友关系，无法发送名片');
      return;
    }
    // 跳转到联系人选择页
    (navigation as any).navigate('SelectContactForCard', {
      onSelectContact: async (contact: any) => {
        try {
          const receiver = chatMembers.filter(id => id !== currentUserId);

          // ✅ 1. 处理头像逻辑：如果为空或无效，设为 ''
          let safeAvatar = contact.avatar || '';

          // (可选) 过滤无效的 ngrok 链接，防止显示裂图
          if (safeAvatar.includes('ngrok-free.dev') && !safeAvatar.includes('/uploads/')) {
            safeAvatar = '';
          }

          // ✅ 2. 构造名片数据
          const cardData = {
            userId: contact.id,
            userName: contact.name || '未知用户', // 防止名字也为空
            userAvatar: safeAvatar,               // 如果是 ''，接收方会自动显示默认图
          };

          // 3. 发送消息 (Type 4)
          const result = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            message: JSON.stringify(cardData),
            type: 4,
          });

          // ✅ 发送名片后滚动
          scrollToBottom(true, 100);

          if (result.success && result.data) {
            const actualReceivers = (result.data.isreceive && result.data.isreceive.length > 0)
              ? result.data.isreceive
              : receiver;

            if (actualReceivers.length > 0) {
              WebSocketManager.sendForwardMessage({
                type: 4,
                message: JSON.stringify(cardData),
                message_id: result.data.message_id,
                sender: currentUserId,
                receiver: actualReceivers,
                chat_id: chatId
              });
            }

            await loadMessages(false, false);
          } else {
            Alert.alert('发送失败', result.message || '名片发送失败，请重试');
          }
        } catch (error) {
          console.error('❌ [ChatRoom] Contact card error');
          Alert.alert('发送失败', '网络错误，请重试');
        }
      },
    });
  }, [navigation, chatMembers, currentUserId, chatId, scrollToBottom, loadMessages]);

  const toggleToolbar = () => {
    setShowToolbar(!showToolbar);
    if (isEmojiPickerOpen) setIsEmojiPickerOpen(false);
  };

  const toggleEmojiPicker = () => {
    setIsEmojiPickerOpen(!isEmojiPickerOpen);
    if (showToolbar) setShowToolbar(false);
  };

  const handleEmojiSelect = (emoji: any) => {
    setInputText((prev) => prev + emoji.emoji);
  };

  // ✅ 性能优化：使用 useCallback 包装 renderItem，避免每次渲染都创建新函数
  const renderItem = useCallback(({ item, index }: { item: DisplayMessage; index: number }) => (
    <MessageBubble
      item={item}
      index={index}
      playingVoice={playingVoice}
      voiceDurations={voiceDurations}
      playbackPosition={playbackPosition}
      playAudio={playAudio}
      stopAudio={stopAudio}
      formatTime={formatTime}
      searchMode={searchMode}
      searchQuery={searchQuery}
      currentMatchId={currentMatchId}
      currentUserAvatar={currentUserAvatar}
      roomStyles={roomStyles}
      showSenderName={true}
      chatUnreadCount={chat?.unreadCount || 0}
    />
  ), [
    playingVoice, 
    voiceDurations, 
    playbackPosition, 
    playAudio, 
    stopAudio, 
    formatTime, 
    searchMode, 
    searchQuery, 
    currentMatchId, 
    currentUserAvatar,
    chat?.unreadCount
  ]);

  // ✅ 性能优化：为 FlatList 添加 keyExtractor
  const keyExtractor = useCallback((item: DisplayMessage) => item.id, []);

  const handleGoBack = useCallback(() => {
    const state = navigation.getState();
    const currentRouteName = state.routes[state.index].name;
    const currentIndex = state.index;

    if (currentIndex > 0) {
      const previousRoute = state.routes[currentIndex - 1];
      if (previousRoute.name === currentRouteName) {
        navigation.pop(2);
      } else {
        navigation.pop();
      }
    } else {
      navigation.navigate('ChatList');
    }
  }, [navigation]);

  const handleDisableSearch = useCallback(() => {
    disableSearch();
    setSearchQuery('');
  }, [disableSearch, setSearchQuery]);

  // ✅ Updated Toolbar configuration
  const toolbarButtons = {
    row1: [
      { icon: 'image-outline', label: '图片', onPress: pickImage },
      { icon: 'videocam-outline', label: '视频', onPress: pickVideo },
      { icon: 'call-outline', label: '通话', onPress: handleStartCall },
      { icon: 'document-outline', label: '文件', onPress: () => Alert.alert('即将推出，文件分享功能尚未开放') },
      // ✅ Added Contact Card Button
      { icon: 'card-outline', label: '个人名片', onPress: handleSendContactCard },
    ],
    // row2: [
    //   { icon: 'document-outline', label: '文件', onPress: () => Alert.alert('Coming Soon', 'File sharing is not yet implemented.') },
    //   // ✅ Added Contact Card Button
    //   { icon: 'card-outline', label: '个人名片', onPress: handleSendContactCard },
    //   // { icon: 'trash-outline', label: '清除记录', onPress: handleClearChat },
    //   // { icon: 'settings-outline', label: '设置', onPress: handleOpenSettings },
    // ],
  };

  // Loading screen
  if (isLoading && messages.length === 0) {
    return (
      <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={roomStyles.safeArea}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={roomStyles.header}>
            <TouchableOpacity style={roomStyles.backButton} onPress={handleGoBack}>
              <Ionicons name="chevron-back" size={scaleWidth(24)} color="#333" />
            </TouchableOpacity>
            <Text style={roomStyles.headerTitle}>{chatName}</Text>
            <TouchableOpacity style={roomStyles.moreButton} onPress={handleOpenSettings}>
              <Ionicons name="ellipsis-horizontal" size={scaleWidth(24)} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={roomStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD966" />
            <Text style={roomStyles.loadingText}>加载消息中...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFEFB0', '#FFF9E5']} style={roomStyles.safeArea}>
      <SafeAreaView style={{ flex: 1 }}>
        <SearchHeader
          searchMode={searchMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          disableSearch={handleDisableSearch}
          totalMatches={totalMatches}
          currentMatchNumber={currentMatchNumber}
          handlePrevMatch={handlePrevMatch}
          handleNextMatch={handleNextMatch}
          chatName={chatName}
          onBack={handleGoBack}
          onOpenSettings={handleOpenSettings}
          roomStyles={roomStyles}
        />

        <KeyboardAvoidingView
          style={roomStyles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {typingIndicatorText && (
            <Text style={roomStyles.typingIndicator}>{typingIndicatorText}</Text>
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={roomStyles.chatList}
            inverted
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}

            // ✅ 核心：监听滚动位置，更新状态
            onScroll={(e) => {
              const { contentOffset } = e.nativeEvent;
              // Inverted 模式下，y=0 是视觉底部，<100 视为接近底部
              // 增加阈值让"底部判定"更宽松，避免轻微滚动就判定离开底部
              setIsNearBottom(contentOffset.y < 100);
            }}
            scrollEventThrottle={16} // 提高滚动帧率

            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#FFD966']}
                tintColor="#FFD966"
              />
            }

            // ✅ 性能优化属性
            removeClippedSubviews={true}           // 移除屏幕外的组件
            maxToRenderPerBatch={10}               // 每批渲染的最大数量
            windowSize={10}                        // 渲染窗口大小
            initialNumToRender={15}                // 初始渲染数量
            updateCellsBatchingPeriod={50}         // 批量更新间隔
          />

         {isFriendDeleted && !chat?.isGroup ? (
            // ✅ 显示非好友提示和重新添加按钮
            <View style={roomStyles.disabledInputContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 , marginRight: 10 }}>
                <Ionicons name="person-remove-outline" size={20} color="#FF6B6B" />
                <Text style={[roomStyles.disabledInputText, { marginLeft: 8, color: '#FF6B6B' }]}>
                  你们已不是好友，无法发送消息
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: '#FFD860',
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={handleReAddFriend}
                disabled={isAddingFriend}
              >
                {isAddingFriend ? (
                  <ActivityIndicator size="small" color="#333" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#333" />
                    <Text style={{ marginLeft: 6, color: '#333', fontWeight: '600' }}>
                      添加好友
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // 正常的输入栏
            <ChatInputBar
              inputText={inputText}
              setInputText={setInputText}
              isRecording={isRecording}
              isPreparing={isPreparing}
              isUploading={isUploading}
              startRecording={startRecording}
              stopRecording={stopRecording}
              isEmojiPickerOpen={isEmojiPickerOpen}
              toggleEmojiPicker={toggleEmojiPicker}
              showToolbar={showToolbar}
              toggleToolbar={toggleToolbar}
              handleSend={handleSend}
              toolbarButtons={toolbarButtons}
              roomStyles={roomStyles}
              chatId={chatId}
              chatMembers={chatMembers}
            />
          )}
        </KeyboardAvoidingView>

        <EmojiPicker
          onEmojiSelected={handleEmojiSelect}
          open={isEmojiPickerOpen}
          onClose={() => setIsEmojiPickerOpen(false)}
          categoryPosition="top"
          enableSearchBar
          enableRecentlyUsed
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const roomStyles = createRoomStyles(chatRoomSpecificStyles);