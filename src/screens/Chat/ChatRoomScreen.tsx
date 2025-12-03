import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet as RNStyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import { useChatStore } from '../../store/chatStore';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useUserStore } from '@/src/store/userStore';

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
  const currentUserId = useUserStore((state) => state.user?.id) || 'me';
  const { getChatById } = useChatStore();

  const { chats, addMessage, clearChat } = useChatStore();
  const storedMessages = chats[chatId] || [];

  const [inputText, setInputText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const messages: DisplayMessage[] = storedMessages.map(msg => ({
    ...msg,
    sender: msg.senderId === currentUserId ? 'me' : 'other',
    senderName: msg.senderId === currentUserId ? '我' : chatName,
  }));

  useLayoutEffect(() => {
    const parent = navigation.getParent();

    // 隐藏 TabBar
    parent?.setOptions({ tabBarStyle: { display: "none" } });

    return () => {
      // 恢复正确尺寸的 TabBar
      parent?.setOptions({
        tabBarStyle: getOriginalTabBarStyle(insets),
      });
    };
  }, [insets, navigation]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    addMessage(chatId, inputText); // store handles user info automatically
    setInputText('');
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
            source={{ uri: item.avatar || 'https://i.pravatar.cc/150?img=' + chatId }}
            style={roomStyles.avatarImage}
          />
        </View>
      )}
      <View style={[
        roomStyles.bubble,
        item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
      ]}>
        <Text style={roomStyles.senderName}>{item.senderName}</Text>
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
            source={{ uri: currentUserId }} // you can replace with user avatar
            style={roomStyles.avatarImage}
          />
        </View>
      )}
    </View>
  );

  const ToolbarButton = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
      <View style={roomStyles.toolbarIconContainer}>
        <Ionicons name={icon} size={24} color="#333" />
      </View>
      <Text style={roomStyles.toolbarLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={roomStyles.safeArea}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={roomStyles.header}>
          <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={roomStyles.headerTitle}>{chatName}</Text>
          <TouchableOpacity style={roomStyles.moreButton} onPress={handleOpenSettings}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
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
          />

          <View style={roomStyles.inputSection}>
            <View style={roomStyles.inputContainer}>
              <TouchableOpacity style={roomStyles.iconButton}>
                <Ionicons name="mic" size={22} color="#333" />
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
                  size={22}
                  color="#333"
                />
              </TouchableOpacity>
              {inputText.trim() ? (
                <TouchableOpacity style={roomStyles.iconButton} onPress={handleSend}>
                  <Ionicons name="send" size={22} color="#333" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={roomStyles.iconButton} onPress={toggleToolbar}>
                  <Ionicons
                    name={showToolbar ? 'close-circle-outline' : 'add-circle-outline'}
                    size={22}
                    color="#333"
                  />
                </TouchableOpacity>
              )}
            </View>

            {showToolbar && (
              <View style={roomStyles.toolbar}>
                <View style={roomStyles.toolbarRow}>
                  <ToolbarButton icon="image-outline" label="图片" />
                  <ToolbarButton icon="play-circle-outline" label="视频" />
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
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#333333', flex: 1, textAlign: 'center' },
  moreButton: { padding: 4 },
  keyboardAvoidingView: { flex: 1 },
  chatList: { paddingHorizontal: 12, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-start' },
  messageRowLeft: { justifyContent: 'flex-start' },
  messageRowRight: { justifyContent: 'flex-end' },
  avatar: { width: 40, height: 40, borderRadius: 4, backgroundColor: '#E0E0E0', marginHorizontal: 8, overflow: 'hidden' },
  avatarImage: { width: 40, height: 40 },
  bubble: { maxWidth: '60%', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleLeft: { backgroundColor: '#FFFFFF' },
  bubbleRight: { backgroundColor: '#95EC69' },
  senderName: { fontWeight: 'bold', marginBottom: 2, fontSize: 14, color: '#333333' },
  messageText: { fontSize: 16, color: '#333333', lineHeight: 22 },
  timestamp: { fontSize: 10, color: '#666666', marginTop: 4, opacity: 0.7 },
  inputSection: { backgroundColor: '#F5F5F5' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  iconButton: { padding: 8 },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333333',
  },
  toolbar: { backgroundColor: '#F5F5F5', paddingVertical: 25, paddingHorizontal: 15 },
  toolbarRow: { flexDirection: 'row', justifyContent: 'space-around' },
  toolbarButton: { alignItems: 'center', width: 70, margin: 10 },
  toolbarIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  toolbarLabel: { fontSize: 12, color: '#333333' },
});