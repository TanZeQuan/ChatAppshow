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
    navigation.navigate('SearchMessages', {
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
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>聊天设置</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5C842" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
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
          <Text style={styles.sectionLabel}>快捷操作</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.item} onPress={handleSearchHistory}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="search" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>查找聊天记录</Text>
                <Text style={styles.itemSubtitle}>搜索历史消息</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Chat Settings Section */}
          <Text style={styles.sectionLabel}>聊天设置</Text>
          <View style={styles.section}>
            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="notifications-outline" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>消息免打扰</Text>
                <Text style={styles.itemSubtitle}>关闭消息通知</Text>
              </View>
              <Switch
                value={pushNotification}
                onValueChange={handleTogglePushNotification}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="star" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>置顶聊天</Text>
                <Text style={styles.itemSubtitle}>在聊天列表置顶</Text>
              </View>
              <Switch
                value={topNotification}
                onValueChange={handleToggleTopNotification}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="warning" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>强提醒</Text>
                <Text style={styles.itemSubtitle}>特别提醒新消息</Text>
              </View>
              <Switch
                value={strongReminder}
                onValueChange={handleToggleStrongReminder}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>
          </View>

          {/* Privacy Section */}
          <Text style={styles.sectionLabel}>隐私设置</Text>
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.item} 
              onPress={handleBlockUser}
              disabled={!friendListId}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="ban-outline" size={20} color="#FF4444" />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: friendListId ? '#FF4444' : '#CCC' }]}>
                  拉黑用户
                </Text>
                <Text style={styles.itemSubtitle}>
                  {friendListId ? '不再接收该用户消息' : '无法获取好友关系'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Danger Zone Section */}
          <Text style={styles.sectionLabel}>危险操作</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.item} onPress={handleClearHistory}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: '#FF4444' }]}>清空聊天记录</Text>
                <Text style={styles.itemSubtitle}>删除所有消息（仅本地）</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity 
              style={styles.item} 
              onPress={handleDeleteContact}
              disabled={!friendListId}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="person-remove-outline" size={20} color="#FF4444" />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: friendListId ? '#FF4444' : '#CCC' }]}>
                  删除联系人
                </Text>
                <Text style={styles.itemSubtitle}>
                  {friendListId ? '从通讯录中删除' : '无法获取好友关系'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.yellowPale,
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.yellowLight,
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.background.yellowBright,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
  },
  placeholder: {
    width: 40,
  },

  /** LOADING */
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

  /** CONTENT */
  scrollView: {
    flex: 1,
  },
  
  /** PROFILE SECTION */
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: borders.radius8,
    backgroundColor: colors.background.iconBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
  },
  profileName: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
  },
  aboutText: {
    fontSize: typography.fontSize13,
    color: colors.text.grayDark,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },

  /** SECTION */
  sectionLabel: {
    fontSize: typography.fontSize13,
    color: colors.text.grayLight,
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    backgroundColor: colors.background.white,
    marginHorizontal: 16,
    borderRadius: borders.radius12,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borders.radius18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight500,
    color: colors.text.blackMedium,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: typography.fontSize12,
    color: colors.text.grayLight,
  },
  separator: {
    height: 1,
    backgroundColor: colors.background.grayLight,
    marginLeft: 64,
  },
});
