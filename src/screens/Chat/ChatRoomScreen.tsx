import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from 'react';
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

  // Use ref instead of state for offset to avoid unnecessary re-renders
  const offsetRef = useRef(0);

  // Voice message state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Wrap loadMessages in useCallback to prevent closure issues
  const loadMessages = useCallback(async (loadMore = false) => {
    if (!currentUserId) return;

    try {
      if (!loadMore) {
        setIsLoading(true);
      }

      const currentOffset = loadMore ? offsetRef.current : 0;

      const result = await readChatMessages({
        chat_id: chatId,
        user_id: currentUserId,
        offset: currentOffset,
      });

      // console.log("=== Load Messages Debug ===");
      // console.log("API Result:", result);

      if (result.success && result.data) {
        // Get messages from result.data.chat (backend returns {chat: [...], group: [...]})
        const apiMessages = result.data.chat || [];
        const groupMembers = result.data.group || [];

        console.log("API Messages count:", apiMessages.length);
        // console.log("Group members:", groupMembers);

        // Extract member user IDs and store them
        const memberIds = groupMembers.map((member: any) => member.user_id);
        setChatMembers(memberIds);

        if (apiMessages.length > 0) {
          // Transform API messages to store format
          const transformedMessages = apiMessages.map((msg: any) => {
            // Parse the message field (it's a JSON string like {"type":1,"message":"Test6"})
            let messageText = '';
            try {
              const parsedMessage = JSON.parse(msg.message);
              messageText = parsedMessage.message || '';
            } catch (e) {
              console.error('Failed to parse message:', msg.message);
              messageText = msg.message;
            }

            return {
              id: msg.message_id,
              text: messageText,
              createdAt: msg.created_at,
              senderId: msg.sender,
              name: msg.sender === currentUserId ? currentUserName : undefined,
              avatar: msg.sender === currentUserId ? currentUserAvatar : undefined,
            };
          });

          // console.log("Transformed messages:", transformedMessages);

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

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading messages:", error);
      setIsLoading(false);
    }
  }, [currentUserId, chatId, currentUserName, currentUserAvatar]);

  // Load messages on mount
  useEffect(() => {
    offsetRef.current = 0; // Reset offset when entering new chat
    loadMessages();
  }, [loadMessages]);

  // Listen for WebSocket message notifications
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      console.log('🔔 WebSocket callback triggered in ChatRoom');
      console.log('Received data:', data);

      // receive and refresh
      // 后端格式: {status: 1, type: X, message: "..."}
      if (data.type && data.message && !data.content) {
        console.log('✅ New message notification - refreshing messages for chatId:', chatId);
        loadMessages(false);
      } else {
        console.log('⚠️ Message data does not match criteria');
        console.log('Has type?', !!data.type);
        console.log('Has message?', !!data.message);
        console.log('Has content?', !!data.content);
      }
    };

    console.log('📝 Registering WebSocket callback for chatId:', chatId);
    // Register callback
    WebSocketManager.addMessageCallback(handleWebSocketMessage);

    // Cleanup
    return () => {
      console.log('🗑️ Removing WebSocket callback for chatId:', chatId);
      WebSocketManager.removeMessageCallback(handleWebSocketMessage);
    };
  }, [chatId, loadMessages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages(false);
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
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    console.log('Stopping recording..');
    setIsRecording(false);
    setIsUploading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      if (uri) {
        // Now, send the voice message
        // const result = await sendVoiceMessageToApi(uri);
        console.log('Simulating sending voice message with URI:', uri);
        // console.log('Voice message sent, result:', result);
      }
    } catch (error) {
      console.error('Failed to send voice message', error);
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

    // Clear input field immediately for better UX
    setInputText('');

    try {
      // Step 1: Save message to database via API
      const receiver = chatMembers.filter(id => id !== currentUserId);

      console.log("=== Sending Message ===");
      console.log("Sender:", currentUserId);
      console.log("Receiver:", receiver);
      console.log("Chat ID:", chatId);
      console.log("Message:", messageText);

      const result = await sendChatMessage({
        sender: currentUserId,
        receiver: receiver,
        chat_id: chatId,
        message: messageText
      });

      console.log("Send message result:", result);

      if (result.success && result.data) {
        // Step 2: Forward message via WebSocket
        const forwarded = WebSocketManager.sendForwardMessage({
          type: result.data.type,
          message: messageText,
          message_id: result.data.message_id,
          sender: currentUserId,
          receiver: receiver,
          chat_id: chatId
        });

        if (!forwarded) {
          console.warn('WebSocket not connected, message saved but not forwarded');
        }

        // Refresh messages from API to get correct server timestamp
        await loadMessages(false);
      } else {
        console.error("Failed to send message:", result.message);
        // Optionally show error to user
        Alert.alert('发送失败', result.message || '消息发送失败，请重试');
        // Restore the message in input field
        setInputText(messageText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert('发送失败', '网络错误，请重试');
      // Restore the message in input field
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
        // TODO: 实现图片发送功能
        Alert.alert('选择成功', `已选择 ${result.assets.length} 张图片\n\n图片发送功能即将推出...`);
        console.log('Selected images:', result.assets);
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

  const renderItem = ({ item }: { item: DisplayMessage }) => (
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
        <Text style={roomStyles.messageText}>{item.text}</Text>
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
});