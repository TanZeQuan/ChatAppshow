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
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number; // 1=text, 2=voice, 3=images, 5=video
  imageUrls?: string[]; // For type 3 messages
  voiceUrl?: string; // For type 2 messages
  videoUrl?: string; // ✅ 新增：视频消息 URL (type 5)
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
  console.log('🆔 [GroupRoom] chatId:', chatId, '| userId:', currentUser?.id);

  // Get current user info from store
  const currentUser = useUserStore((state) => state.user);
  const currentUserId = currentUser?.id || 'me';
  const currentUserAvatar = currentUser?.avatar || '';
  const currentUserName = currentUser?.name || '我';

  const { getChatById, addMessage, clearChat } = useChatStore();

  // Get chat metadata from store
  const chat = getChatById(chatId);

  // Use selector to subscribe to messages for this chat (reactive)
  const messagesFromStore = useChatStore((state) => state.chats[chatId]);
  // Use useMemo to avoid creating new array reference on every render
  const storedMessages = useMemo(() => messagesFromStore || [], [messagesFromStore]);

  const [inputText, setInputText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatMembers, setChatMembers] = useState<string[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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

  // ✅ FlatList ref for scrolling to matched messages
  const flatListRef = useRef<FlatList>(null);

  // ✅ Transform messages - must be declared before using in callbacks
  const messages: DisplayMessage[] = useMemo(() => {
    return storedMessages.map(msg => ({
      ...msg,
      sender: msg.senderId === currentUserId ? 'me' : 'other',
      senderName: msg.senderId === currentUserId ? currentUserName : (msg.name || chatName),
      voiceUrl: msg.voiceUrl && typeof msg.voiceUrl === 'object' && (msg.voiceUrl as any).message
        ? String((msg.voiceUrl as any).message)
        : msg.voiceUrl,
    }));
  }, [storedMessages, currentUserId, currentUserName, chatName]);

  // 🔧 Initialize chatMembers from store if available
  useEffect(() => {
    if (chat?.memberIds && chat.memberIds.length > 0) {
      setChatMembers(chat.memberIds);
    }
  }, [chat?.memberIds]);

  // Use ref instead of state for offset to avoid unnecessary re-renders
  const offsetRef = useRef(0);

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
    onMessageSent: () => loadMessages(false, false),
  });

  // ✅ 预加载语音消息时长
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.type === 2 && msg.voiceUrl && !voiceDurations[msg.id]) {
        preloadVoiceDuration(msg.voiceUrl, msg.id);
      }
    });
  }, [messages, voiceDurations, preloadVoiceDuration]);

  // Wrap loadMessages in useCallback to prevent closure issues
  const loadMessages = useCallback(async (loadMore = false, showLoading = true) => {
    if (!currentUserId) return;

    const user = useUserStore.getState().user;
    const userName = user?.name || '我';
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
              name: member.name || '未知',
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
                  messageText = '[视频]';
                } else {
                  // 正常图片处理
                  imageUrls = mediaUrls.map((url: string) => ensureFullImageUrl(url));
                  messageText = `[${imageUrls.length}张图片]`;
                }
              }
              else if (messageType === 2) {
                if (typeof parsedMessage === 'string') {
                  voiceUrl = ensureFullImageUrl(parsedMessage);
                  messageText = '[语音消息]';
                } else if (parsedMessage.message) {
                  if (typeof parsedMessage.message === 'object' && parsedMessage.message.error === true) {
                    voiceUrl = '';
                    messageText = '[语音上传失败]';
                  }
                  else if (typeof parsedMessage.message === 'object' && parsedMessage.message.uri) {
                    voiceUrl = ensureFullImageUrl(parsedMessage.message.uri);
                    messageText = '[语音消息]';
                  }
                  else if (typeof parsedMessage.message === 'string') {
                    voiceUrl = ensureFullImageUrl(parsedMessage.message);
                    messageText = '[语音消息]';
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
                messageText = '[视频]';
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
            const uniqueMessages = Array.from(
              new Map(allMessages.map((m: any) => [m.id, m])).values()
            ) as any[];
            setMessages(chatId, uniqueMessages);
            offsetRef.current += apiMessages.length;
          } else {
            if (existingMessages.length === 0) {
              const uniqueMessages = Array.from(
                new Map(transformedMessages.map((m: any) => [m.id, m])).values()
              ) as any[];
              setMessages(chatId, uniqueMessages);
              offsetRef.current = uniqueMessages.length;
            } else {
              const existingIds = new Set(existingMessages.map(m => m.id));
              const newMessages = transformedMessages.filter(
                (msg: any) => !existingIds.has(msg.id)
              );

              if (newMessages.length > 0) {
                const allMessages = [...newMessages, ...existingMessages];
                const uniqueMessages = Array.from(
                  new Map(allMessages.map((m: any) => [m.id, m])).values()
                ) as any[];
                setMessages(chatId, uniqueMessages);
              }
            }
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
        console.warn('⚠️ [GroupRoom] WebSocket disconnected');
      }
    }, 10000);

    // const pollingInterval = setInterval(() => {
    //   loadMessages(false, false);
    // }, 3000);

    return () => {
      clearInterval(connectionCheckInterval);
      // clearInterval(pollingInterval);
    };
  }, [loadMessages]);

  // ✅ 监听 WebSocket 已读回执，实时更新 unreadCount
  useEffect(() => {
    const handleReadReceipt = (data: { chatId: string; readerId: string }) => {
      // 只处理当前聊天室的已读回执
      if (data.chatId !== chatId) return;

      // 对方读了消息，将 unreadCount 设为 0
      const chatList = useChatStore.getState().chatList;
      const updatedChatList = chatList.map(c => {
        if (c.id === chatId) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      useChatStore.getState().setChats(updatedChatList);
    };

    // 注册回调
    WebSocketManager.addReadReceiptCallback(handleReadReceipt);

    // 清理
    return () => {
      WebSocketManager.removeReadReceiptCallback(handleReadReceipt);
    };
  }, [chatId]);

  // ✅ Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [GroupRoom] Focus | chatId:', chatId);
      loadMessages(false, false);

      // ✅ 发送已读回执给所有群成员
      if (chatMembers && chatMembers.length > 0) {
        const otherMembers = chatMembers.filter(id => id !== currentUserId);
        if (otherMembers.length > 0) {
          WebSocketManager.sendReadSignal({
            receiver: otherMembers,
            chat_id: chatId
          });
        }
      }
    }, [loadMessages, chatId, chatMembers, currentUserId])
  );

  // ✅ Auto-enable search mode if navigated from settings (ONCE)
  const searchModeInitialized = useRef(false);
  useEffect(() => {
    if (params.searchMode === true && !searchModeInitialized.current) {
      console.log('🔍 [GroupRoom] Search enabled');
      enableSearch();
      searchModeInitialized.current = true;
    }
  }, [params.searchMode, enableSearch]);

  // ✅ Scroll to matched message by ID
  const scrollToMatch = useCallback((messageId: string) => {
    if (!messageId || !flatListRef.current) return;

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex >= 0) {
      try {
        flatListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (error) {
        // Scroll to match failed silently
      }
    }
  }, [messages]);

  // ✅ Handle next match navigation
  const handleNextMatch = useCallback(() => {
    const nextMessageId = goToNextMatch(messages);
    if (nextMessageId) {
      scrollToMatch(nextMessageId);
    }
  }, [goToNextMatch, scrollToMatch, messages]);

  // ✅ Handle previous match navigation
  const handlePrevMatch = useCallback(() => {
    const prevMessageId = goToPrevMatch(messages);
    if (prevMessageId) {
      scrollToMatch(prevMessageId);
    }
  }, [goToPrevMatch, scrollToMatch, messages]);

  // ✅ Auto-scroll to first match when search query changes
  const prevSearchQueryRef = useRef('');
  useEffect(() => {
    if (searchMode && searchQuery.trim() && searchQuery !== prevSearchQueryRef.current) {
      if (matchedMessageIds.length > 0) {
        scrollToMatch(matchedMessageIds[0]);
      }
      prevSearchQueryRef.current = searchQuery;
    } else if (!searchMode || !searchQuery.trim()) {
      prevSearchQueryRef.current = '';
    }
  }, [searchMode, searchQuery, matchedMessageIds, scrollToMatch]);

  // ✅ Handle scroll to detect if user is near bottom
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const distanceFromTop = contentOffset.y;
    const nearBottom = distanceFromTop < 100;
    setIsNearBottom(nearBottom);
  }, []);

  // ✅ Auto-scroll to bottom when new messages arrive
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isNearBottom && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 0,
          animated: true,
          viewPosition: 0
        });
      }, 100);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  // Use refs to store stable references for WebSocket callback
  const chatIdRef = useRef(chatId);
  const loadMessagesRef = useRef(loadMessages);

  useEffect(() => {
    chatIdRef.current = chatId;
    loadMessagesRef.current = loadMessages;
  }, [chatId, loadMessages]);

  // Listen for WebSocket message notifications
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      if (data.type && data.message) {
        if (!data.chat_id || data.chat_id === chatIdRef.current) {
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

  // ✅ Handle loading more old messages when scrolling to top
  const handleLoadMore = () => {
    if (!isLoading) {
      loadMessages(true, true);
    }
  };

  // ✅ Calculate search matches separately in useEffect
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

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');

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
        console.error("❌ [GroupRoom] Send failed:", result.message);
        Alert.alert('发送失败', result.message || '消息发送失败，请重试');
        setInputText(messageText);
      }
    } catch (error) {
      console.error("❌ [GroupRoom] Send error");
      Alert.alert('发送失败', '网络错误，请重试');
      setInputText(messageText);
    }
  };

  const handleClearChat = () => {
    Alert.alert('清除聊天记录', '确定要清除与 ' + chatName + ' 的所有聊天记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          clearChat(chatId);
          Alert.alert('成功', '聊天记录已清除');
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
      const otherUserId = chatMembers.find(id => id !== currentUserId);
      navigation.navigate('ChatSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        avatar: chat?.avatar || '',
        otherUserId: otherUserId,
      });
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '需要相册权限才能选择图片');
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

            return {
              uri: asset.uri,
              name: fileName,
              type: mimeType
            };
          });

          const apiResult = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            files: files
          });

          if (apiResult.success && apiResult.data) {
            const actualReceivers = (apiResult.data.isreceive && apiResult.data.isreceive.length > 0)
              ? apiResult.data.isreceive
              : receiver;

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
            console.error("❌ [GroupRoom] Image send failed");
            Alert.alert('发送失败', apiResult.message || '图片发送失败，请重试');
          }
        } catch (error: any) {
          console.error('❌ [GroupRoom] Image error');
          Alert.alert('发送失败', error.message || '网络错误，请重试');
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('❌ [GroupRoom] Pick image error');
      Alert.alert('选择失败', '选择图片时出错');
    }
  };

  // ✅ 选择并发送视频
  const pickVideo = async () => {
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
          console.error('❌ [GroupRoom] Video upload error');
          Alert.alert('发送失败', error.message || '网络错误，请重试');
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('❌ [GroupRoom] Video picker error');
      Alert.alert('选择失败', '选择视频时出错');
    }
  };

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

  // ✅ Handle start call
  // Inside ChatRoomScreen component
  const handleStartCall = useCallback(async () => {
    if (chat?.isGroup) {
      // 群聊：直接跳转到 GroupCallScreen
      // 通话卡片在 GroupCallScreen 获取到 call_id 后才发送
      // 避免发送没有 call_id 的通话卡片（导致其他人无法加入）
      navigation.navigate('GroupCallScreen', {
        chatId,
        isHost: true
      });
    } else {
      // 单聊：只跳转，不 startCall
      const otherUserId = chatMembers.find(id => id !== currentUserId);
      if (otherUserId) {
        navigation.navigate('CallScreen', {
          targetUserId: otherUserId,
          isIncoming: false
        });
      }
    }
  }, [chat, chatId, currentUserName, currentUserId, chatMembers, navigation]);


  // ✅ CRITICAL FIX: Define handleGoBack BEFORE any conditional returns
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

  // Handle send contact card
  const handleSendContactCard = useCallback(() => {
    (navigation as any).navigate('SelectContactForCard', {
      onSelectContact: async (contact: any) => {
        try {
          const receiver = chatMembers.filter(id => id !== currentUserId);

          // Create contact card message data
          const cardData = {
            userId: contact.id,
            userName: contact.name,
            userAvatar: contact.avatar,
          };

          const result = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            message: JSON.stringify(cardData),
            type: 4, // Type 4 for contact card
          });

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
          console.error('❌ [GroupRoom] Contact card error');
          Alert.alert('发送失败', '网络错误，请重试');
        }
      },
    });
  }, [chatMembers, currentUserId, chatId, navigation, loadMessages]);

  // Toolbar buttons configuration
  const toolbarButtons = {
    row1: [
      { icon: 'image-outline', label: '图片', onPress: pickImage },
      { icon: 'videocam-outline', label: '视频', onPress: pickVideo },
      { icon: 'call-outline', label: '通话', onPress: handleStartCall },
       { icon: 'document-outline', label: '文件', onPress: () => Alert.alert('即将推出，文件分享功能尚未开放') },
       { icon: 'card-outline', label: '个人名片', onPress: handleSendContactCard },
    ],
    // row2: [
    //   { icon: 'document-outline', label: '文件' },
    //   { icon: 'card-outline', label: '个人名片', onPress: handleSendContactCard },
    //   { icon: 'trash-outline', label: '清除记录', onPress: handleClearChat },
    //   { icon: 'settings-outline', label: '设置', onPress: handleOpenSettings },
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

  // Main screen
  return (
    <LinearGradient colors={['#FFEFB0', '#FFF9E5']} style={roomStyles.safeArea}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ✅ Dynamic Header: Search mode vs Normal mode */}
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
          showCallButton={!chat?.isGroup}
          onStartCall={handleStartCall}
        />

        <KeyboardAvoidingView
          style={roomStyles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={roomStyles.chatList}
            inverted
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                }
              }, 100);
            }}
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
            roomStyles={roomStyles} chatId={''} chatMembers={[]}          />
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

// Use shared room styles with ChatRoom-specific styles
const roomStyles = createRoomStyles(chatRoomSpecificStyles);