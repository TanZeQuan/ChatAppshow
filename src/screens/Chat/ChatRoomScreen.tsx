import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';
import { readChatMessages } from '../../api/Chat';
import { colors, borders, typography } from "../../styles";
import { sendVoiceMessageToApi } from '../../api/VoiceMessage';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useChatStore } from '../../store/chatStore';
import * as ImagePicker from 'expo-image-picker';

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
  const currentUserAvatar = currentUser?.avatar || 'https://i.pravatar.cc/150?img=default';
  const currentUserName = currentUser?.name || '我';

  const { getChatById, chats, addMessage, clearChat } = useChatStore();
  const storedMessages = chats[chatId] || [];

  const [inputText, setInputText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);

  // Voice message state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const loadMessages = async (loadMore = false) => {
    if (!currentUserId) return;

    try {
      if (!loadMore) {
        setIsLoading(true);
      }

      const currentOffset = loadMore ? offset : 0;

      const result = await readChatMessages({
        chat_id: chatId,
        user_id: currentUserId,
        offset: currentOffset,
      });

      console.log("=== Load Messages Debug ===");
      console.log("API Result:", result);

      if (result.success && result.data) {
        // Transform API response to message format
        const apiMessages = Array.isArray(result.data) ? result.data : [];

        console.log("API Messages count:", apiMessages.length);

        // TODO: Store messages in chatStore
        // You'll need to add a method to bulk load messages
        // For now, messages will be shown from local store

        if (loadMore) {
          setOffset(currentOffset + apiMessages.length);
        } else {
          setOffset(apiMessages.length);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading messages:", error);
      setIsLoading(false);
    }
  };

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

    // Add message to store
    addMessage(chatId, messageText);

    // REMOVE updateChatTimestamp — 已删除

    setInputText('');

    // TODO: Send via API
    // await sendMessage(...)
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
        avatar: 'https://i.pravatar.cc/150?img=' + chatId
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
            source={{ uri: item.avatar || `https://i.pravatar.cc/150?u=${chatId}` }}
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
            source={{ uri: currentUserAvatar }}
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

        <KeyboardAvoidingView
          style={roomStyles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            data={[...messages].reverse()}
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
    backgroundColor: colors.background.gradientYellow[1],
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