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
  type?: number; // 1=text, 2=voice, 3=images
  imageUrls?: string[]; // For type 3 messages
  voiceUrl?: string; // For type 2 messages
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
  console.log('🆔 ChatRoomScreen chatId:', chatId);

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
    onMessageSent: () => loadMessages(false, false),
  });

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

                messageText = `[${imageUrls.length}张图片]`;
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
        console.warn('⚠️ WebSocket disconnected!');
      }
    }, 10000);

    const pollingInterval = setInterval(() => {
      loadMessages(false, false);
    }, 3000);

    return () => {
      clearInterval(connectionCheckInterval);
      clearInterval(pollingInterval);
    };
  }, [loadMessages]);

  // ✅ Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [ChatRoom] Screen focused, reloading messages...');
      loadMessages(false, false);
    }, [loadMessages])
  );

  // ✅ Auto-enable search mode if navigated from settings (ONCE)
  const searchModeInitialized = useRef(false);
  useEffect(() => {
    if (params.searchMode === true && !searchModeInitialized.current) {
      console.log('🔍 [Search] Auto-enabling search from params');
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
        console.log('Failed to scroll to match:', error);
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
        console.error("Failed to send message:", result.message);
        Alert.alert('发送失败', result.message || '消息发送失败，请重试');
        setInputText(messageText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
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
            console.error("❌ [Pick Image] Failed to send image:", apiResult.message);
            Alert.alert('发送失败', apiResult.message || '图片发送失败，请重试');
          }
        } catch(error: any) {
          console.error('Failed to send image', error);
          Alert.alert('发送失败', error.message || '网络错误，请重试');
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('选择图片错误:', error);
      Alert.alert('选择失败', '选择图片时出错');
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
      showSenderName={false}
    />
  );

  // ✅ Handle start call
  const handleStartCall = useCallback(() => {
    if (chat?.isGroup) {
      Alert.alert("提示", "群聊暂不支持通话功能");
      return;
    }

    const otherUserId = chatMembers.find(id => id !== currentUserId);
    if (otherUserId) {
      WebSocketManager.startCall(otherUserId);
    } else {
      Alert.alert("错误", "无法找到通话对象");
    }
  }, [chat?.isGroup, chatMembers, currentUserId]);

  // ✅ CRITICAL FIX: Define handleGoBack BEFORE any conditional returns
  const handleGoBack = useCallback(() => {
    console.log('🔙 [Back] Button clicked');
    
    // 🔑 检查导航堆栈
    const state = navigation.getState();
    console.log('🔙 [Back] Navigation Stack:');
    state.routes.forEach((route: any, index: number) => {
      console.log(`  [${index}] ${route.name} ${index === state.index ? '← CURRENT' : ''}`);
    });
    
    const currentRouteName = state.routes[state.index].name;
    const currentIndex = state.index;
    
    // 🔑 关键修复：如果下一个屏幕也是 ChatRoom，连续 pop 两次
    if (currentIndex > 0) {
      const previousRoute = state.routes[currentIndex - 1];
      console.log(`🔙 [Back] Previous route: ${previousRoute.name}`);
      
      if (previousRoute.name === currentRouteName) {
        // 下一个也是相同的屏幕，pop 两次直接回到 ChatList
        console.log('🔙 [Back] ⚠️ Duplicate route detected! Popping twice...');
        navigation.pop(2); // 一次性 pop 两个屏幕
      } else {
        console.log('🔙 [Back] Normal pop');
        navigation.pop();
      }
    } else {
      console.log('🔙 [Back] At top, navigating to ChatList');
      navigation.navigate('ChatList');
    }
  }, [navigation]);

  // ✅ CRITICAL FIX: Wrap disableSearch to ensure state cleanup
  const handleDisableSearch = useCallback(() => {
    console.log('❌ [Search] Disabling search mode');
    disableSearch();
    setSearchQuery('');
  }, [disableSearch, setSearchQuery]);

  // Toolbar buttons configuration
  const toolbarButtons = {
    row1: [
      { icon: 'image-outline', label: '图片', onPress: pickImage },
      { icon: 'play-circle-outline', label: '视频', onPress: pickImage },
      { icon: 'call-outline', label: '通话', onPress: handleStartCall },
      { icon: 'videocam-outline', label: '视频通话' },
    ],
    row2: [
      { icon: 'document-outline', label: '文件' },
      { icon: 'card-outline', label: '个人名片' },
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

// Use shared room styles with ChatRoom-specific styles
const roomStyles = createRoomStyles(chatRoomSpecificStyles);