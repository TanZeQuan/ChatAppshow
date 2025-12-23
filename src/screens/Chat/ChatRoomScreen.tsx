import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet as RNStyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';
import { readChatMessages, sendChatMessage } from '../../api/Chat';
import { ensureFullImageUrl } from '../../api/service';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { borders, colors, typography } from "../../styles";

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

  // 🔧 Initialize chatMembers from store if available
  useEffect(() => {
    if (chat?.memberIds && chat.memberIds.length > 0) {
      setChatMembers(chat.memberIds);
    }
  }, [chat?.memberIds]);

  // Use ref instead of state for offset to avoid unnecessary re-renders
  const offsetRef = useRef(0);

  // Voice message state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Wrap loadMessages in useCallback to prevent closure issues
  const loadMessages = useCallback(async (loadMore = false, showLoading = true) => {
    if (!currentUserId) return;

    // Get current user info inside the function to avoid dependency issues
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

        // Extract member user IDs and store them (only if not already set from store)
        if (groupMembers.length > 0) {
          const memberIds = groupMembers.map((member: any) => member.user_id);
          setChatMembers(prev => prev.length > 0 ? prev : memberIds);
        }

        if (apiMessages.length > 0) {
          // Transform API messages to store format
          const transformedMessages = apiMessages.map((msg: any) => {
            let messageText = '';
            let messageType = 1; // Default to text
            let imageUrls: string[] = [];
            let voiceUrl: string = '';

            try {
              // 🔍 Check if msg.message is already an object or a string
              let parsedMessage: any;

              if (typeof msg.message === 'string') {
                try {
                  parsedMessage = JSON.parse(msg.message);
                } catch {
                  // If parsing fails, treat as plain text
                  parsedMessage = { message: msg.message };
                }
              } else if (typeof msg.message === 'object' && msg.message !== null) {
                parsedMessage = msg.message; // Already an object
              } else {
                parsedMessage = { message: String(msg.message || '') };
              }

              console.log('📦 [Message Parse] msg.type:', msg.type, 'parsedMessage:', parsedMessage);

              // Extract type: try msg.type first, then parsedMessage.type
              if (msg.type) {
                messageType = msg.type;
              } else if (parsedMessage.type) {
                messageType = parsedMessage.type; // ✅ 从 parsedMessage 获取类型
              }

              console.log('📦 [Message Parse] Final messageType:', messageType);

              // For type 3 (images/files), extract image URLs
              if (messageType === 3) {
                console.log('🖼️ [Image Message] Detected type 3, parsedMessage:', parsedMessage);

                // Check if parsedMessage is an array (direct image URLs)
                if (Array.isArray(parsedMessage)) {
                  console.log('🖼️ [Image Message] parsedMessage is array:', parsedMessage);
                  imageUrls = parsedMessage.map((url: string) => {
                    const fullUrl = ensureFullImageUrl(url);
                    console.log(`🖼️ [Image Message] ${url} → ${fullUrl}`);
                    return fullUrl;
                  });
                }
                // Check if parsedMessage.message is an array
                else if (parsedMessage.message && Array.isArray(parsedMessage.message)) {
                  console.log('🖼️ [Image Message] parsedMessage.message is array:', parsedMessage.message);
                  imageUrls = parsedMessage.message.map((url: string) => {
                    const fullUrl = ensureFullImageUrl(url);
                    console.log(`🖼️ [Image Message] ${url} → ${fullUrl}`);
                    return fullUrl;
                  });
                }
                // Check if parsedMessage.message is a comma-separated string
                else if (parsedMessage.message && typeof parsedMessage.message === 'string') {
                  console.log('🖼️ [Image Message] parsedMessage.message is string:', parsedMessage.message);
                  const urls = parsedMessage.message.split(',').map((url: string) => url.trim());
                  imageUrls = urls.map((url: string) => {
                    const fullUrl = ensureFullImageUrl(url);
                    console.log(`🖼️ [Image Message] ${url} → ${fullUrl}`);
                    return fullUrl;
                  });
                }

                console.log('🖼️ [Image Message] Final imageUrls:', imageUrls);
                messageText = `[${imageUrls.length}张图片]`; // Display text
              }
              // For type 2 (voice), ensure full URL
              else if (messageType === 2) {
                if (typeof parsedMessage === 'string') {
                  voiceUrl = ensureFullImageUrl(parsedMessage);
                  messageText = '[语音消息]';
                } else if (parsedMessage.message) {
                  voiceUrl = ensureFullImageUrl(String(parsedMessage.message));
                  messageText = '[语音消息]';
                }
              }
              // For type 1 (text), extract text content
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
              console.error('Failed to parse message:', msg.message, 'Error:', e);
              // Fallback: convert to string safely
              messageText = typeof msg.message === 'string'
                ? msg.message
                : JSON.stringify(msg.message);
            }

            return {
              id: msg.message_id,
              text: messageText, // ✅ Always a string
              type: messageType, // ✅ Save message type
              imageUrls: imageUrls, // ✅ Save image URLs with full domain
              voiceUrl: voiceUrl, // ✅ Save voice URL with full domain
              createdAt: msg.created_at,
              senderId: msg.sender,
              name: msg.sender === currentUserId ? userName : undefined,
              avatar: msg.sender === currentUserId ? userAvatar : undefined,
            };
          });

          // Store messages in chatStore
          const { setMessages } = useChatStore.getState();
          setMessages(chatId, transformedMessages);
        }

        if (loadMore) {
          offsetRef.current = currentOffset + apiMessages.length;
        } else {
          offsetRef.current = apiMessages.length;
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
    offsetRef.current = 0; // Reset offset when entering new chat
    loadMessages();

    // Periodic WebSocket connection check (every 10 seconds)
    const connectionCheckInterval = setInterval(() => {
      const connected = WebSocketManager.isWebSocketConnected();
      if (!connected) {
        console.warn('⚠️ WebSocket disconnected!');
      }
    }, 10000);

    // Polling fallback: Check for new messages every 3 seconds (silent, no loading animation)
    const pollingInterval = setInterval(() => {
      loadMessages(false, false); // loadMore=false, showLoading=false
    }, 3000);

    return () => {
      clearInterval(connectionCheckInterval);
      clearInterval(pollingInterval);
    };
  }, [loadMessages]);

  // Use refs to store stable references for WebSocket callback
  const chatIdRef = useRef(chatId);
  const loadMessagesRef = useRef(loadMessages);

  // Update refs when values change
  useEffect(() => {
    chatIdRef.current = chatId;
    loadMessagesRef.current = loadMessages;
  }, [chatId, loadMessages]);

  // Listen for WebSocket message notifications (registered only once)
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      if (data.type && data.message) {
        // If chat_id is not provided by backend, refresh anyway (safer approach)
        if (!data.chat_id || data.chat_id === chatIdRef.current) {
          loadMessagesRef.current(false, false); // Silent refresh, no loading animation
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
    await loadMessages(false, false); // No loading spinner, just refresh control
    setRefreshing(false);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission not granted', 'Failed to get recording permissions');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    setIsRecording(false);
    setIsUploading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        const receiver = chatMembers.filter(id => id !== currentUserId);
        const filename = uri.split('/').pop();
        const result = await sendChatMessage({
          sender: currentUserId,
          isreceive: receiver,
          chat_id: chatId,
          voice: {
            uri: uri,
            name: filename || 'voice.m4a',
            type: 'audio/m4a', // This might need to be adjusted based on platform
          },
        });

        if (result.success && result.data) {
          const actualReceivers = (result.data.isreceive && result.data.isreceive.length > 0)
            ? result.data.isreceive
            : receiver;

          if (actualReceivers.length > 0) {
            WebSocketManager.sendForwardMessage({
              type: result.data.type,
              message: result.data.message, // This should be the URL of the voice message
              message_id: result.data.message_id,
              sender: currentUserId,
              receiver: actualReceivers,
              chat_id: chatId
            });
          }

          await loadMessages(false, false); // Silent refresh after sending
        } else {
          console.error("Failed to send voice message:", result.message);
          Alert.alert('发送失败', result.message || '语音消息发送失败，请重试');
        }
      }
    } catch (error: any) {
      console.error('Failed to send voice message', error);
      Alert.alert('发送失败', error.message || '网络错误，请重试');
    } finally {
      setIsUploading(false);
      setRecording(null);
    }
  };

  const messages: DisplayMessage[] = storedMessages.map(msg => ({
    ...msg,
    sender: msg.senderId === currentUserId ? 'me' : 'other',
    senderName: msg.senderId === currentUserId ? currentUserName : (msg.name || chatName),
  }));

  useLayoutEffect(() => {
    const parent = navigation.getParent();

    // Hide TabBar
    parent?.setOptions({ tabBarStyle: { display: "none" } });

    return () => {
      // Restore TabBar
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

        await loadMessages(false, false); // Silent refresh after sending
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
      navigation.navigate('ChatSettingScreen', {
        chatId: chatId,
        chatName: chatName,
        avatar: chat?.avatar || ''
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setIsUploading(true);
        try {
            console.log('📤 [Pick Image] Selected assets:', result.assets.length);

            const receiver = chatMembers.filter(id => id !== currentUserId);
            const files = result.assets.map(asset => ({
                uri: asset.uri,
                name: asset.fileName || 'image.jpg',
                type: asset.type || 'image/jpeg'
            }));

            console.log('📤 [Pick Image] Files to send:', files);
            console.log('📤 [Pick Image] Receiver:', receiver);
            console.log('📤 [Pick Image] Calling sendChatMessage...');

            const apiResult = await sendChatMessage({
                sender: currentUserId,
                isreceive: receiver,
                chat_id: chatId,
                files: files
            });

            console.log('📤 [Pick Image] API Result:', apiResult);

            if (apiResult.success && apiResult.data) {
                console.log('✅ [Pick Image] Success! Data:', apiResult.data);

                const actualReceivers = (apiResult.data.isreceive && apiResult.data.isreceive.length > 0)
                    ? apiResult.data.isreceive
                    : receiver;

                if (actualReceivers.length > 0) {
                    console.log('📨 [Pick Image] Sending WebSocket forward...');
                    WebSocketManager.sendForwardMessage({
                        type: apiResult.data.type,
                        message: apiResult.data.message, // This should be the URLs of the images
                        message_id: apiResult.data.message_id,
                        sender: currentUserId,
                        receiver: actualReceivers,
                        chat_id: chatId
                    });
                }

                console.log('🔄 [Pick Image] Refreshing messages...');
                await loadMessages(false, false); // Silent refresh after sending
            } else {
                console.error("❌ [Pick Image] Failed to send image:", apiResult.message);
                Alert.alert('发送失败', apiResult.message || '图片发送失败，请重试');
            }
        } catch(error: any) {
            console.error('Failed to send image', error);
            Alert.alert('发送失败', error.message || '网络错误，请重试');
        } finally {
            setIsUploading(false);
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

  const renderItem = ({ item }: { item: DisplayMessage }) => {
    // 🔍 Safety check: ensure text is a string
    const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

    return (
      <View style={[
        roomStyles.messageRow,
        item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft,
      ]}>
        {item.sender === 'other' && (
          <View style={roomStyles.avatar}>
            <Image
              source={item.avatar ? { uri: item.avatar } : require('../../assets/images/anonymous.png')}
              style={roomStyles.avatarImage}
            />
          </View>
        )}
        <View style={[
          roomStyles.bubble,
          item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
        ]}>
          {/* Type 1: Text Message */}
          {item.type === 1 && messageText && (
            <Text style={roomStyles.messageText}>{messageText}</Text>
          )}

          {/* Type 2: Voice Message */}
          {item.type === 2 && (
            <View style={roomStyles.voiceMessageContainer}>
              <Ionicons name="play-circle" size={24} color="#333" />
              <Text style={roomStyles.voiceMessageText}>语音消息</Text>
            </View>
          )}

          {/* Type 3: Image Message */}
          {item.type === 3 && item.imageUrls && item.imageUrls.length > 0 && (
            <View style={roomStyles.imageGridContainer}>
              {item.imageUrls.map((url, index) => (
                <TouchableOpacity key={index} activeOpacity={0.8}>
                  <Image
                    source={{ uri: url }}
                    style={roomStyles.messageImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={roomStyles.timestamp}>
            {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {item.sender === 'me' && (
          <View style={roomStyles.avatar}>
            <Image
              source={currentUserAvatar ? { uri: currentUserAvatar } : require('../../assets/images/anonymous.png')}
              style={roomStyles.avatarImage}
            />
          </View>
        )}
      </View>
    );
  };

  const ToolbarButton = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
      <View style={roomStyles.toolbarIconContainer}>
        <Ionicons name={icon} size={scaleWidth(24)} color="#333" />
      </View>
      <Text style={roomStyles.toolbarLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (isLoading && messages.length === 0) {
    return (
      <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={roomStyles.safeArea}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={roomStyles.header}>
            <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
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
        <View style={roomStyles.header}>
          <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={scaleWidth(24)} color="#333" />
          </TouchableOpacity>
          <Text style={roomStyles.headerTitle}>{chatName}</Text>
          <TouchableOpacity style={roomStyles.moreButton} onPress={handleOpenSettings}>
            <Ionicons name="ellipsis-horizontal" size={scaleWidth(24)} color="#333" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={roomStyles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            data={[...messages]}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={roomStyles.chatList}
            inverted
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#FFD966']}
                tintColor="#FFD966"
              />
            }
          />

          <View style={roomStyles.inputSection}>
            <View style={roomStyles.inputContainer}>
              <TouchableOpacity
                style={roomStyles.iconButton}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#333" size={scaleWidth(20)} />
                ) : (
                  <Ionicons name="mic" size={scaleWidth(22)} color={isRecording ? 'red' : '#333'} />
                )}
              </TouchableOpacity>
              <TextInput
                style={roomStyles.input}
                placeholder="输入消息..."
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity style={roomStyles.iconButton} onPress={toggleEmojiPicker}>
                <Ionicons
                  name={isEmojiPickerOpen ? "close-circle" : "happy-outline"}
                  size={scaleWidth(22)}
                  color="#333"
                />
              </TouchableOpacity>
              {inputText.trim() ? (
                <TouchableOpacity style={roomStyles.iconButton} onPress={handleSend}>
                  <Ionicons name="send" size={scaleWidth(22)} color="#333" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={roomStyles.iconButton} onPress={toggleToolbar}>
                  <Ionicons
                    name={showToolbar ? 'close-circle-outline' : 'add-circle-outline'}
                    size={scaleWidth(22)}
                    color="#333"
                  />
                </TouchableOpacity>
              )}
            </View>

            {showToolbar && (
              <View style={roomStyles.toolbar}>
                <View style={roomStyles.toolbarRow}>
                  <ToolbarButton icon="image-outline" label="图片" onPress={pickImage} />
                  <ToolbarButton icon="play-circle-outline" label="视频" onPress={pickImage} />
                  <ToolbarButton icon="call-outline" label="通话" />
                  <ToolbarButton icon="videocam-outline" label="视频通话" />
                </View>
                <View style={roomStyles.toolbarRow}>
                  <ToolbarButton icon="document-outline" label="文件" />
                  <ToolbarButton icon="card-outline" label="个人名片" />
                  <ToolbarButton icon="trash-outline" label="清除记录" onPress={handleClearChat} />
                  <ToolbarButton icon="settings-outline" label="设置" onPress={handleOpenSettings} />
                </View>
              </View>
            )}
          </View>
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

const roomStyles = RNStyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.yellowBright,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.grayLight,
  },
  backButton: {
    padding: scaleWidth(4)
  },
  headerTitle: {
    fontSize: scaleFont(16),
    fontWeight: typography.fontWeight500,
    color: colors.text.blackMedium,
    flex: 1,
    textAlign: 'center'
  },
  moreButton: {
    padding: scaleWidth(4)
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: scaleHeight(12),
    fontSize: scaleFont(14),
    color: colors.text.grayDark,
  },
  keyboardAvoidingView: { flex: 1 },
  chatList: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(16)
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: scaleHeight(6),
    alignItems: 'flex-start'
  },
  messageRowLeft: { justifyContent: 'flex-start' },
  messageRowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: borders.radius4,
    backgroundColor: colors.background.grayLight,
    marginHorizontal: scaleWidth(8),
    overflow: 'hidden'
  },
  avatarImage: {
    width: scaleWidth(40),
    height: scaleWidth(40)
  },
  bubble: {
    maxWidth: '60%',
    borderRadius: borders.radius4,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10)
  },
  bubbleLeft: { backgroundColor: colors.background.white },
  bubbleRight: { backgroundColor: colors.functional.green },
  senderName: {
    fontWeight: typography.fontWeight600,
    marginBottom: scaleHeight(2),
    fontSize: scaleFont(14),
    color: colors.text.blackMedium
  },
  messageText: {
    fontSize: scaleFont(16),
    color: colors.text.blackMedium,
    lineHeight: scaleHeight(22)
  },
  timestamp: {
    fontSize: scaleFont(11),
    color: colors.text.grayDark,
    marginTop: scaleHeight(4),
    opacity: 0.7
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scaleHeight(60),
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: colors.text.grayLight,
    marginTop: scaleHeight(12),
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: colors.text.grayMedium,
    marginTop: scaleHeight(6),
  },
  inputSection: {
    backgroundColor: colors.background.grayLight
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.gradientYellow[1],
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(12),
    borderTopWidth: borders.width1,
    borderTopColor: colors.border.grayLight,
  },
  iconButton: {
    padding: scaleWidth(8)
  },
  input: {
    flex: 1,
    minHeight: scaleHeight(36),
    maxHeight: scaleHeight(100),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius10,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
    fontSize: scaleFont(16),
    color: colors.text.blackMedium,
  },
  toolbar: {
    backgroundColor: colors.background.grayLight,
    paddingVertical: scaleHeight(20),
    paddingHorizontal: scaleWidth(10)
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scaleHeight(10),
  },
  toolbarButton: {
    alignItems: 'center',
    width: scaleWidth(70),
  },
  toolbarIconContainer: {
    width: scaleWidth(50),
    height: scaleWidth(50),
    borderRadius: borders.radius8,
    backgroundColor: colors.background.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(6),
  },
  toolbarLabel: {
    fontSize: scaleFont(12),
    color: colors.text.blackMedium,
    textAlign: 'center',
  },
  // Voice message styles
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(4),
  },
  voiceMessageText: {
    fontSize: scaleFont(14),
    color: colors.text.blackMedium,
  },
  // Image message styles
  imageGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(4),
    marginBottom: scaleHeight(4),
  },
  messageImage: {
    width: scaleWidth(120),
    height: scaleWidth(120),
    borderRadius: borders.radius8,
    backgroundColor: colors.background.grayLight,
  },
});