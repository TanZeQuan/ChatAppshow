import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, borders, typography } from "../../styles";
import { useChatStore } from '../../store/chatStore';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore';
import {
  blockUser,
  deleteFriend,
  readFriends
} from '../../api/Friend';

interface RouteParams {
  chatId: string;
  chatName: string;
  avatar?: string;
}

export default function ChatSettingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as RouteParams;
  const { chatId, chatName, avatar } = params;

  const { clearChat, getChatById, addChat } = useChatStore();
  const { getContactById, removeContact } = useContactStore();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useUserStore();

  const [pushNotification, setPushNotification] = useState(false);
  const [topNotification, setTopNotification] = useState(false);
  const [strongReminder, setStrongReminder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [friendListId, setFriendListId] = useState<string | null>(null);

  useEffect(() => {
    loadChatSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const loadChatSettings = async () => {
    try {
      setIsLoading(true);

      // Get chat info from store
      const chat = getChatById(chatId);
      if (chat) {
        // Load settings from chat object
        setPushNotification(chat.rawData?.push_notification || false);
        setTopNotification(chat.rawData?.top_notification || false);
        setStrongReminder((chat.rawData as any)?.strong_reminder || false);
      }

      // Get contact info if it's a personal chat
      if (!chat?.isGroup) {
        const contact = getContactById(chatId);
        setContactInfo(contact);

        // Get friend list_id for block/delete operations
        await loadFriendListId();
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading chat settings:", error);
      setIsLoading(false);
    }
  };

  // 获取好友关系的 list_id
  const loadFriendListId = async () => {
    try {
      // Get friends list with status 2 (Accepted friends)
      const result = await readFriends(2);

      if (result.success && result.data) {
        // Search in both request and approve arrays
        const allFriends = [
          ...(result.data.request || []),
          ...(result.data.approve || [])
        ];

        // Find the friend relationship for this chatId
        const friendRelation = allFriends.find((friend: any) => {
          // Check if this friend matches the chatId
          return friend.request_id === chatId || friend.approve_id === chatId;
        });

        if (friendRelation) {
          setFriendListId(friendRelation.list_id);
          console.log("Found friend list_id:", friendRelation.list_id);
        } else {
          console.log("No friend relationship found for chatId:", chatId);
        }
      }
    } catch (error) {
      console.error("Error loading friend list_id:", error);
    }
  };

  const handleTogglePushNotification = async (value: boolean) => {
    // Update UI immediately (optimistic update)
    setPushNotification(value);

    // Update local store
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
    // Update UI immediately (optimistic update)
    setTopNotification(value);

    // Update local store
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
    // Update UI immediately (optimistic update)
    setStrongReminder(value);

    // Update local store
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
    navigation.navigate('ChatHistory', {
      chatId,
      chatName,
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
            // Clear local chat
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
    // Check if we have the friend list_id
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
              // Show loading
              setIsLoading(true);

              // Call API to block user using friend list_id
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
                    // Navigate back to chat list
                    navigation.navigate('Chats');
                  }
                }
              ]);
            } catch (error) {
              console.error('Block user error:', error);
              setIsLoading(false);
              Alert.alert('错误', '网络连接失败，请检查您的网络');
            }
          }
        }
      ]
    );
  };

  const handleDeleteContact = () => {
    // Check if we have the friend list_id
    if (!friendListId) {
      Alert.alert('错误', '无法获取好友关系信息，请重试');
      return;
    }

    Alert.alert(
      '删除联系人',
      `确定要删除 ${chatName} 吗？\n\n删除后：\n• 对方将从您的联系人列表中移除\n• 聊天记录将会保留\n• 您仍可通过聊天记录与对方对话`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // Show loading
              setIsLoading(true);

              // Call API to delete friend using friend list_id
              const result = await deleteFriend(friendListId);

              setIsLoading(false);

              if (!result.success) {
                Alert.alert('失败', result.message || '删除联系人失败');
                return;
              }

              // Remove from local store
              if (removeContact) {
                removeContact(chatId);
              }

              Alert.alert('成功', `已删除联系人 ${chatName}`, [
                {
                  text: '确定',
                  onPress: () => navigation.navigate('Contacts')
                }
              ]);
            } catch (error) {
              console.error('Delete contact error:', error);
              setIsLoading(false);
              Alert.alert('错误', '网络连接失败，请检查您的网络');
            }
          }
        }
      ]
    );
  };

  const displayAvatar = contactInfo?.avatar || avatar || `https://i.pravatar.cc/150?u=${chatId}`;
  const displayName = contactInfo?.name?.replace(/^用户/, '') || chatName;
  const onlineStatus = contactInfo?.online ? '在线' : '离线';

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
      {/* Header */}
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
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: displayAvatar }}
              style={styles.avatarImage}
            />
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileSubtext}>{onlineStatus}</Text>

          {contactInfo?.rawData?.about && (
            <Text style={styles.aboutText}>{contactInfo.rawData.about}</Text>
          )}
        </View>

        {/* Quick Actions Section */}
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

        {/* Chat Settings Section */}
        <Text style={styles.sectionHeader}>聊天设置</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={[styles.settingItem, styles.borderBottom]}>
              <View style={styles.iconContainer}>
                <Ionicons name="notifications-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>消息免打扰</Text>
                <Text style={styles.settingSubtitle}>关闭消息通知</Text>
              </View>
              <Switch
                value={pushNotification}
                onValueChange={handleTogglePushNotification}
                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                thumbColor={colors.background.white}
              />
            </View>

            <View style={[styles.settingItem, styles.borderBottom]}>
              <View style={styles.iconContainer}>
                <Ionicons name="pin-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>置顶聊天</Text>
                <Text style={styles.settingSubtitle}>在聊天列表置顶</Text>
              </View>
              <Switch
                value={topNotification}
                onValueChange={handleToggleTopNotification}
                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                thumbColor={colors.background.white}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="warning-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>强提醒</Text>
                <Text style={styles.settingSubtitle}>特别提醒新消息</Text>
              </View>
              <Switch
                value={strongReminder}
                onValueChange={handleToggleStrongReminder}
                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                thumbColor={colors.background.white}
              />
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <Text style={styles.sectionHeader}>隐私设置</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleBlockUser}
              disabled={!friendListId}
            >
              <View style={[styles.iconContainer, styles.dangerIcon]}>
                <Ionicons name="ban-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: friendListId ? colors.functional.redMedium : colors.text.grayLight }]}>
                  拉黑用户
                </Text>
                <Text style={[styles.settingSubtitle, { color: friendListId ? colors.functional.redLight : colors.text.grayLight }]}>
                  {friendListId ? '不再接收该用户消息' : '无法获取好友关系'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone Section */}
        <Text style={styles.sectionHeader}>危险操作</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.settingItem, styles.borderBottom]} onPress={handleClearHistory}>
              <View style={[styles.iconContainer, styles.dangerIcon]}>
                <Ionicons name="trash-outline" size={20} color={colors.text.white} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.functional.redMedium }]}>清空聊天记录</Text>
                <Text style={[styles.settingSubtitle, { color: colors.functional.redLight }]}>删除所有消息（仅本地）</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
            </TouchableOpacity>

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

  // --- Header ---
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
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },
  placeholder: {
    width: 40,
  },

  // --- Loading ---
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

  // --- Content ---
  scrollView: {
    flex: 1,
  },

  // --- Profile Section ---
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: borders.radius8,
    backgroundColor: colors.functional.avatarBg, // Consistent with GroupDetails
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: borders.radius8, // Consistent
  },
  profileName: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black, // Consistent
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.gray, // Consistent
  },
  aboutText: {
    fontSize: typography.fontSize13,
    color: colors.text.grayDark,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },

  // --- Section Header & Card ---
  sectionHeader: { // Renamed from sectionLabel
    fontSize: typography.fontSize14,
    color: colors.text.gray,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16, // Added for consistency with GroupDetails sectionTitle
  },
  section: {
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    overflow: "hidden",
  },

  // --- Setting Item ---
  settingItem: { // Renamed from item
    flexDirection: "row",
    alignItems: "center",
    padding: 16, // Consistent
  },
  borderBottom: { // For separators
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.light,
  },
  iconContainer: {
    width: 40, // Consistent
    height: 40, // Consistent
    backgroundColor: colors.functional.yellow, // Default color for icons, consistent with GroupDetails.tsx
    borderRadius: borders.radius20, // Consistent
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12, // Consistent
  },
  settingContent: { // Renamed from textContainer
    flex: 1,
  },
  settingTitle: { // Renamed from itemTitle
    fontSize: typography.fontSize16, // Consistent
    fontWeight: typography.fontWeight500, // Consistent
    color: colors.text.dark, // Consistent
    marginBottom: 2,
  },
  settingSubtitle: { // Renamed from itemSubtitle
    fontSize: typography.fontSize12, // Consistent
    color: colors.text.grayLight, // Consistent
  },

  // --- Danger Styles ---
  dangerIcon: {
    backgroundColor: colors.functional.redMedium, // Consistent
  },
  dangerTitle: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight500,
    color: colors.functional.redMedium, // Consistent
    marginBottom: 2,
  },
  dangerSubtitle: {
    fontSize: typography.fontSize12,
    color: colors.functional.redLight, // Consistent
  },
});
