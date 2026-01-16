import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  blockUser,
  deleteFriend,
  readFriends
} from '../../api/Friend';
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

interface RouteParams {
  chatId: string;
  chatName: string;
  avatar?: string;
  otherUserId?: string;
}

export default function ChatSettingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as RouteParams;
  const { chatId, chatName, avatar, otherUserId } = params;

  const { clearChat, getChatById, addChat, removeChat } = useChatStore(); // ✅ 添加 removeChat
  const { getContactById, removeContact } = useContactStore();
  const { user: currentUser, onlineUsers } = useUserStore();

  const [pushNotification, setPushNotification] = useState(false);
  const [topNotification, setTopNotification] = useState(false);
  const [strongReminder, setStrongReminder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [friendListId, setFriendListId] = useState<string | null>(null);

  const isOnline = otherUserId ? onlineUsers.includes(otherUserId) : false;

  useEffect(() => {
    loadChatSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, otherUserId]);

  const loadChatSettings = async () => {
    try {
      setIsLoading(true);

      const chat = getChatById(chatId);
      if (chat) {
        setPushNotification(chat.rawData?.push_notification || false);
        setTopNotification(chat.rawData?.top_notification || false);
        setStrongReminder((chat.rawData as any)?.strong_reminder || false);
      }

      if (!chat?.isGroup) {
        const contact = getContactById(otherUserId || chatId);
        setContactInfo(contact);
        await loadFriendListId();
      }

      setIsLoading(false);
    } catch (error) {
      console.error("❌ [ChatSetting] Load error");
      setIsLoading(false);
    }
  };

  const loadFriendListId = async () => {
    if (!otherUserId || !currentUser) {
      // Cannot load friend list ID
      return;
    }
    try {
      const result = await readFriends(2);

      if (result.success && result.data) {
        const allFriends = [
          ...(result.data.request || []),
          ...(result.data.approve || [])
        ];

        const friendRelation = allFriends.find((friend: any) => {
          return friend.user_id === otherUserId;
        });

        if (friendRelation) {
          setFriendListId(friendRelation.list_id);
          // Found friend list_id
        } else {
          // No friend relationship found
        }
      }
    } catch (error) {
      console.error("❌ [ChatSetting] Load friend list_id error");
    }
  };

  const handleTogglePushNotification = async (value: boolean) => {
    setPushNotification(value);
    const chat = getChatById(chatId);
    if (chat) {
      const updatedChat = {
        ...chat,
        rawData: {
          ...chat.rawData,
          push_notification: value,
        }
      };
      addChat(updatedChat);
    }
  };

  const handleToggleTopNotification = async (value: boolean) => {
    setTopNotification(value);
    const chat = getChatById(chatId);
    if (chat) {
      const updatedChat = {
        ...chat,
        rawData: {
          ...chat.rawData,
          top_notification: value,
        }
      };
      addChat(updatedChat);
    }
  };

  const handleToggleStrongReminder = async (value: boolean) => {
    setStrongReminder(value);
    const chat = getChatById(chatId);
    if (chat) {
      const updatedChat = {
        ...chat,
        rawData: {
          ...chat.rawData,
          strong_reminder: value,
        } as any
      };
      addChat(updatedChat);
    }
  };

  const handleSearchHistory = () => {
    navigation.replace('ChatRoom', {
      chatId,
      chatName,
      searchMode: true,
    });
  };

  const handleClearHistory = () => {
    Alert.alert(
      '清空聊天历史',
      `确定要清空与 ${chatName} 的所有聊天记录吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: () => {
            clearChat(chatId);
            Alert.alert('成功', '聊天记录已清空', [
              { text: '确定', onPress: () => navigation.goBack() }
            ]);
          }
        }
      ]
    );
  };

  const handleBlockUser = () => {
    if (!friendListId) {
      Alert.alert('错误', '无法获取好友关系信息，请重试');
      return;
    }

    Alert.alert(
      '拉黑用户',
      `确定要拉黑 ${chatName} 吗？\n\n拉黑后：\n• 您将无法收到该用户的消息\n• 该用户无法向您发送消息\n• 双方无法查看彼此的在线状态`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '拉黑',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const result = await blockUser(friendListId);
              setIsLoading(false);

              if (!result.success) {
                Alert.alert('失败', result.message || '拉黑用户失败');
                return;
              }

              Alert.alert('成功', `已拉黑 ${chatName}`, [
                {
                  text: '确定',
                  onPress: () => {
                    navigation.navigate('Chats');
                  }
                }
              ]);
            } catch (error) {
              console.error('❌ [ChatSetting] Block user error');
              setIsLoading(false);
              Alert.alert('错误', '网络连接失败，请检查您的网络');
            }
          }
        }
      ]
    );
  };

  // ✅ 修改后的 handleDeleteContact
  const handleDeleteContact = () => {
    if (!friendListId) {
      Alert.alert('错误', '无法获取好友关系信息，请重试');
      return;
    }

    Alert.alert(
      '删除联系人',
      `确定要删除 ${chatName} 吗？\n\n删除后：\n• 对方将从您的聊天将从列表中隐藏\n• 重新添加好友后聊天记录会恢复`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);

              // 调用 API 删除好友
              const result = await deleteFriend(friendListId);
              setIsLoading(false);

              if (!result.success) {
                Alert.alert('失败', result.message || '删除联系人失败');
                return;
              }

              // ✅ 从联系人列表中移除
              if (removeContact) {
                removeContact(chatId);
              }

              // ✅ 从聊天列表中移除（标记为已删除）
              removeChat(chatId);

              Alert.alert('成功', `已删除联系人 ${chatName}`, [
                {
                  text: '确定',
                  onPress: () => navigation.reset({
                    index: 0,
                    routes: [{ name: 'ChatList' }],
                  }),
                }
              ]);
            } catch (error) {
              console.error('❌ [ChatSetting] Delete contact error');
              setIsLoading(false);
              Alert.alert('错误', '网络连接失败，请检查您的网络');
            }
          }
        }
      ]
    );
  };

  const displayAvatar = contactInfo?.avatar || avatar || '';
  const displayName = contactInfo?.name?.replace(/^用户/, '') || chatName;
  const onlineStatus = isOnline ? '在线' : '离线';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>聊天设置</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.functional.yellow} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>聊天设置</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={
                !displayAvatar || displayAvatar.trim() === '' || displayAvatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                  ? require('../../assets/images/personal.png')
                  : { uri: displayAvatar }
              }
              style={styles.avatarImage}
            />
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#999' }]} />
            <Text style={styles.profileSubtext}>{onlineStatus}</Text>
          </View>

          {contactInfo?.rawData?.about && (
            <Text style={styles.aboutText}>{contactInfo.rawData.about}</Text>
          )}
        </View>

        <Text style={styles.sectionHeader}>快捷操作</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSearchHistory}>
              <View style={styles.iconContainer}>
                <Ionicons name="search-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>查找聊天记录</Text>
                <Text style={styles.settingSubtitle}>搜索历史消息</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeader}>危险操作</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleDeleteContact}
              disabled={!friendListId}
            >
              <View style={[styles.iconContainer, styles.dangerIcon]}>
                <Ionicons name="person-remove-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: friendListId ? colors.functional.redMedium : colors.text.grayLight }]}>
                  删除联系人
                </Text>
                <Text style={[styles.settingSubtitle, { color: friendListId ? colors.functional.redLight : colors.text.grayLight }]}>
                  {friendListId ? '从通讯录中删除' : '无法获取好友关系'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.chatBg,
  },
  header: {
    backgroundColor: colors.background.yellowLight,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    textAlign: 'center',
    color: colors.text.black,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSize14,
    color: colors.text.grayDark,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: borders.radius8,
    backgroundColor: colors.functional.avatarBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: borders.radius8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  profileSubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.gray,
  },
  aboutText: {
    fontSize: typography.fontSize13,
    color: colors.text.grayDark,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: typography.fontSize14,
    color: colors.text.gray,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  section: {
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  borderBottom: {
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.light,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: colors.functional.yellow,
    borderRadius: borders.radius20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight500,
    color: colors.text.dark,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: typography.fontSize12,
    color: colors.text.grayLight,
  },
  dangerIcon: {
    backgroundColor: colors.functional.redMedium,
  },
});