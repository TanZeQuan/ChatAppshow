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
  console.log('🆔 ChatRoomScreen chatId:', chatId);

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
                if (typeof parsedMessage === 'string') {
                  voiceUrl = ensureFullImageUrl(parsedMessage);
                  messageText = '[Voice Message]';
                } else if (parsedMessage.message) {
                  if (typeof parsedMessage.message === 'object' && parsedMessage.message.uri) {
                    voiceUrl = ensureFullImageUrl(parsedMessage.message.uri);
                    messageText = '[Voice Message]';
                  } else {
                    voiceUrl = ensureFullImageUrl(String(parsedMessage.message));
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
            const uniqueMessages = Array.from(
              new Map(allMessages.map((m: any) => [m.id, m])).values()
            ) as any[];
            setMessages(chatId, uniqueMessages);
            offsetRef.current += apiMessages.length;
          } else {
            const existingIds = new Set(existingMessages.map(m => m.id));
            const newMessages = transformedMessages.filter(
              (msg: any) => !existingIds.has(msg.id)
            );
            if (newMessages.length > 0 || existingMessages.length === 0) {
              const allMessages = [...newMessages, ...existingMessages];
              setMessages(chatId, allMessages);
            }
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

    const pollingInterval = setInterval(() => {
      loadMessages(false, false);
    }, 3000);

    return () => {
      clearInterval(connectionCheckInterval);
      clearInterval(pollingInterval);
    };
  }, [loadMessages]);

  // ✅ Listen for WebSocket read receipts, update unreadCount in real-time
  useEffect(() => {
    const handleReadReceipt = (data: { chatId: string; readerId: string }) => {
      if (data.chatId !== chatId) return;
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
  }, [chatId]);

  // ✅ Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [ChatRoom] Screen focused, reloading messages...');
      loadMessages(false, false);

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
      enableSearch();
      searchModeInitialized.current = true;
    }
  }, [params.searchMode, enableSearch]);

  const scrollToMatch = useCallback((messageId: string) => {
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

  // Use refs for WebSocket callback
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

  // ✅ Handle start call
  const handleStartCall = useCallback(async () => {
    if (chat?.isGroup) {
      const callInviteData = JSON.stringify({
        type: 'GROUP_VIDEO_CALL',
        roomId: chatId,
        hostName: currentUserName,
        startTime: new Date().toISOString()
      });

      const result = await sendChatMessage({
        sender: currentUserId,
        isreceive: chatMembers.filter(id => id !== currentUserId),
        chat_id: chatId,
        message: callInviteData,
        type: 4,
      });

      if (result.success) {
        navigation.navigate('GroupCallScreen', { chatId, isHost: true });
      }
    } else {
      const otherUserId = chatMembers.find(id => id !== currentUserId);
      if (otherUserId) {
        WebSocketManager.startCall(otherUserId);
      }
    }
  }, [chat?.isGroup, chatId, currentUserName, currentUserId, chatMembers, navigation]);

  // ✅ Core Addition: Send Contact Card Logic
  const handleSendContactCard = useCallback(() => {
    // Assuming you have a contact selection screen, ensure 'SelectContactForCard' route exists
    (navigation as any).navigate('SelectContactForCard', {
      onSelectContact: async (contact: any) => {
        try {
          const receiver = chatMembers.filter(id => id !== currentUserId);

          // Construct contact card JSON data
          const cardData = {
            userId: contact.id,
            userName: contact.name,
            userAvatar: contact.avatar,
          };

          // Send message Type 4 (shared with call card, distinguished by content)
          const result = await sendChatMessage({
            sender: currentUserId,
            isreceive: receiver,
            chat_id: chatId,
            message: JSON.stringify(cardData),
            type: 4,
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
            Alert.alert('Send Failed', result.message || 'Contact card failed to send, please retry');
          }
        } catch (error) {
          console.error('Error sending contact card:', error);
          Alert.alert('Send Failed', 'Network error, please retry');
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
      { icon: 'document-outline', label: '文件' },
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
        >
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={roomStyles.chatList}
            inverted
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            onScroll={(e) => {
              const { contentOffset } = e.nativeEvent;
              setIsNearBottom(contentOffset.y < 100);
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

const roomStyles = createRoomStyles(chatRoomSpecificStyles);