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
  type?: number; // 1=text, 2=voice, 3=images, 4=call/card
  imageUrls?: string[];
  voiceUrl?: string;
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
}

interface RouteParams {
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

  // ✅ 优化 1: 添加滚动控制 Ref 和 状态
  const flatListRef = useRef<FlatList>(null);
  const [isNearBottom, setIsNearBottom] = useState(true); // 默认在底部

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

  // ✅ 优化 2: 滚动到底部辅助函数
  // Inverted 模式下，offset 0 就是视觉上的底部
  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated });
    }
  };

  // ✅ 优化 3: 监听消息列表变化，智能滚动
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 获取最新的一条消息
    const latestMessage = messages[0];

    // 情况 A: 我自己发的消息 -> 必须强制滚到底部
    if (latestMessage.senderId === currentUserId) {
      scrollToBottom(true);
      return;
    }

    // 情况 B: 收到别人发的消息
    // 逻辑：如果我当前就在底部（isNearBottom），说明我在等消息，直接滚下去显示
    // 如果我在看上面的历史记录（isNearBottom = false），就不滚，避免打断阅读
    if (isNearBottom) {
      scrollToBottom(true);
    }
  }, [messages.length, messages[0]?.id]);


  // ✅ Use voice recorder hook
  const {
    isRecording,
    isUploading,
    playingVoice,
    voiceDurations,
    playbackPosition,
    startRecording,
    stopRecording,
    playAudio,
    stopAudio,
    formatTime,
  } = useVoiceRecorder({
    chatId,
    currentUserId,
    chatMembers,
    onMessageSent: () => {
        loadMessages(false, false);
        // ✅ 语音发送成功后，强制滚到底部
        scrollToBottom(true);
    },
  });

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
                if (Array.isArray(parsedMessage)) {
                  imageUrls = parsedMessage.map((url: string) => ensureFullImageUrl(url));
                }
                else if (parsedMessage.message && Array.isArray(parsedMessage.message)) {
                  imageUrls = parsedMessage.message.map((url: string) => ensureFullImageUrl(url));
                }
                else if (parsedMessage.message && typeof parsedMessage.message === 'string') {
                  const urls = parsedMessage.message.split(',').map((url: string) => url.trim());
                  imageUrls = urls.map((url: string) => ensureFullImageUrl(url));
                }
                messageText = `[${imageUrls.length} images]`;
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
      console.error("Error loading messages:", error);
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
        console.warn('⚠️ WebSocket disconnected!');
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
      const updatedMessages = existingMessages.map(msg => {
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
      useChatStore.getState().setMessages(chatId, updatedMessages);
      
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

  // Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [ChatRoom] Screen focused, reloading messages...');
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
      if (data.type && data.message) {
        if (!data.chat_id || data.chat_id === chatIdRef.current) {
          loadMessagesRef.current(false, false);
          // 注意：滚动逻辑已统一交给上面的 messages useEffect 监听
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
    const messageText = inputText.trim();
    setInputText('');

    // ✅ 优化 5: 发送时立即强制滚动到底部
    scrollToBottom(true);

    try {
      const receiver = chatMembers.filter(id => id !== currentUserId);
      const result = await sendChatMessage({
        sender: currentUserId,
        isreceive: receiver,
        chat_id: chatId,
        message: messageText,
      });

      if (result.success && result.data) {
        const actualReceivers = (result.data.isreceive && result.data.isreceive.length > 0)
          ? result.data.isreceive
          : receiver;

        if (actualReceivers.length > 0) {
          WebSocketManager.sendForwardMessage({
            type: result.data.type,
            message: messageText,
            message_id: result.data.message_id,
            sender: currentUserId,
            receiver: actualReceivers,
            chat_id: chatId
          });
        }
        await loadMessages(false, false);
      } else {
        Alert.alert('Send Failed', result.message || 'Message failed to send, please retry');
        setInputText(messageText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert('Send Failed', 'Network error, please retry');
      setInputText(messageText);
    }
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat History', 'Are you sure you want to clear all chat history with ' + chatName + '?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearChat(chatId);
          Alert.alert('Success', 'Chat history cleared');
        }
      }
    ]);
  };

  const handleOpenSettings = () => {
    const chat = getChatById(chatId);

    if (chat?.isGroup) {
      navigation.navigate('GroupSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        members: chat.members || [],
        memberIds: chat.memberIds || [],
      });
    } else {
      // 1. 尝试从当前页面状态获取
      let targetId = chatMembers.find(id => id !== currentUserId);

      // 2. 如果没找到，尝试从 Store 的聊天元数据里找
      if (!targetId && chat?.memberIds) {
        targetId = chat.memberIds.find((id: string) => id !== currentUserId);
      }

      // 3. 如果还是没有 (极少数情况)，做个防护
      if (!targetId) {
        console.warn('⚠️ 无法找到对方 ID，无法打开设置页');
        Alert.alert('提示', '数据加载中，请稍后再试');
        return;
      }

      console.log('⚙️ Opening ChatSettings for:', targetId);

      navigation.navigate('ChatSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        avatar: chat?.avatar || '',
        otherUserId: targetId, // ✅ 确保这里有值
      });
    }
  };

  const pickImage = async () => {
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
        // ✅ 优化 6: 发送图片时也滚动
        scrollToBottom(true);

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

  // ✅ 修正版：单聊和群聊分别跳转到正确的 Screen
  const handleStartCall = useCallback(async () => {
    // ===========================
    // 1. 群聊逻辑 (Group Call)
    // ===========================
    if (chat?.isGroup) {
      // A. 构造群通话邀请消息
      const callInviteData = JSON.stringify({
        type: 'GROUP_VIDEO_CALL',
        roomId: chatId,
        hostName: currentUserName,
        startTime: new Date().toISOString()
      });

      // B. 发送消息给群成员
      const result = await sendChatMessage({
        sender: currentUserId,
        isreceive: chatMembers.filter(id => id !== currentUserId),
        chat_id: chatId,
        message: callInviteData,
        type: 4, // 系统消息/卡片类型
      });

      // C. 发送成功后，自己跳转到群通话界面
      if (result.success) {
        // ❗ 注意：群聊是跳 GroupCallScreen
        navigation.navigate('GroupCallScreen', {
          chatId,
          isHost: true // 标记我是主持人
        });
      }
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

        console.log('📞 跳转单聊页面:', targetName);

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

          // ✅ 优化 7: 发送名片也滚动
          scrollToBottom(true);

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
          console.error('Error sending contact card:', error);
          Alert.alert('发送失败', '网络错误，请重试');
        }
      },
    });
  }, [chatMembers, currentUserId, chatId, navigation, loadMessages]);

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

  const renderItem = ({ item, index }: { item: DisplayMessage; index: number }) => (
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
  );

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
      { icon: 'play-circle-outline', label: '视频', onPress: pickImage },
      { icon: 'call-outline', label: '通话', onPress: handleStartCall },
      { icon: 'videocam-outline', label: '视频通话', onPress: handleStartCall },
    ],
    row2: [
      { icon: 'document-outline', label: '文件', onPress: () => Alert.alert('Coming Soon', 'File sharing is not yet implemented.') },
      // ✅ Added Contact Card Button
      { icon: 'card-outline', label: '个人名片', onPress: handleSendContactCard },
      { icon: 'trash-outline', label: '清除记录', onPress: handleClearChat },
      { icon: 'settings-outline', label: '设置', onPress: handleOpenSettings },
    ],
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
          {/* ✅ 优化 8: FlatList 配置 Ref 和 onScroll */}
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={roomStyles.chatList}
            inverted
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            
            // 核心：监听滚动位置，更新状态
            onScroll={(e) => {
              const { contentOffset } = e.nativeEvent;
              // Inverted 模式下，y=0 是视觉底部，<50 视为接近底部
              setIsNearBottom(contentOffset.y < 50);
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
          />

          <ChatInputBar
            inputText={inputText}
            setInputText={setInputText}
            isRecording={isRecording}
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
          />
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