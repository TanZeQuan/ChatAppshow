import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createPrivateChat, readUserChats } from "../../api/Chat";
import { readFriends } from "../../api/Friend";
import { useChatStore } from "../../store/chatStore";
import { useContactStore } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";
import { borders, colors, typography } from "../../styles";

const { width, height } = Dimensions.get("window");

// Responsive scaling functions
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

interface Section {
  title: string;
  data: any[];
}

const alphabet: string[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function ContactsScreen() {
  const navigation = useNavigation<any>();
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const sectionListRef = React.useRef<SectionList>(null);

  // Get data from Zustand stores
  const { contacts, setContacts } = useContactStore();
  const { token, user } = useUserStore();
  const { addChat } = useChatStore();

  // Fetch contacts when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        loadContacts();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const loadContacts = async () => {
    try {
      setIsLoading(true);

      // Fetch approved friends (isstatus = 2)
      const result = await readFriends(2);

      if (result.success && result.data) {
        // Combine request and approve arrays
        const allFriends = [
          ...(result.data.request || []),
          ...(result.data.approve || [])
        ];

        // Transform API response to contact format
        const formattedContacts = allFriends.map((friend: any) => {
          // Try different possible field names from API
          const userId = friend.user_id || friend.id || friend.userId || friend.approve_id || friend.request_id;
          const userName = friend.name || friend.username || friend.display_name || friend.user_name || `用户${userId}`;
          const userAvatar = friend.avatar || friend.profile_picture || friend.avatarUrl || friend.avatar_url || friend.photo || friend.image;

          return {
            id: userId,
            name: userName,
            avatar: userAvatar,
            online: friend.online || friend.is_online || false,
            listId: friend.list_id || friend.listId || 0,
            isFriend: true,
            rawData: friend, // Store original data for reference
          };
        });

        // Remove duplicates based on id
        const uniqueContacts = Array.from(
          new Map(formattedContacts.map(contact => [contact.id, contact])).values()
        );

        setContacts(uniqueContacts);
      } else {
        console.error("Failed to load contacts:", result.message);
        // Don't clear existing contacts on error, just show error message
        if (contacts.length === 0) {
          Alert.alert("加载失败", result.message || "无法加载联系人列表");
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading contacts:", error);
      setIsLoading(false);

      if (contacts.length === 0) {
        Alert.alert("错误", "加载联系人时出错，请稍后重试");
      }
    }
  };

  // Group contacts by first letter
  const groupContacts = (contacts: any[]): Section[] => {
    if (contacts.length === 0) return [];

    const grouped: Record<string, any[]> = {};

    contacts.forEach((contact) => {
      if (!contact.name) return;

      // Remove "用户" prefix before getting first character
      const cleanName = contact.name.replace(/^用户/, '');
      const firstChar = cleanName[0]?.toUpperCase() || '#';
      const letter = /[A-Z]/.test(firstChar) ? firstChar : "#";

      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(contact);
    });

    // Sort each group's contacts by name
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const nameA = a.name.replace(/^用户/, '').toUpperCase();
        const nameB = b.name.replace(/^用户/, '').toUpperCase();
        return nameA.localeCompare(nameB);
      });
    });

    // Sort sections alphabetically, with # at the end
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      })
      .map((key) => ({ title: key, data: grouped[key] }));
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchText.trim()) return true;

    const searchLower = searchText.toLowerCase();
    const cleanName = c.name.replace(/^用户/, '').toLowerCase();
    const fullName = c.name.toLowerCase();

    return (
      cleanName.includes(searchLower) ||
      fullName.includes(searchLower) ||
      (c.id && c.id.toString().toLowerCase().includes(searchLower))
    );
  });

  const sections = groupContacts(filteredContacts);

  const handleLetterPress = (letter: string) => {
    const index = sections.findIndex((s) => s.title === letter);
    if (index !== -1 && sectionListRef.current) {
      try {
        sectionListRef.current.scrollToLocation({
          sectionIndex: index,
          itemIndex: 0,
          animated: true,
          viewOffset: 0,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Fallback if scrollToLocation fails
      }
    }
  };

  const handleContactPress = async (contact: any) => {
    const parentNavigation = navigation.getParent();
    if (!parentNavigation) return;

    const currentUserId = user?.id;
    if (!currentUserId) {
      Alert.alert("错误", "无法获取当前用户信息");
      return;
    }

    // 从Zustand store获取整个chatList
    const { chatList } = useChatStore.getState();

    // 查找是否已存在与该联系人的1对1聊天
    // 对于私聊，后端返回的 name 就是对方的名字，所以直接通过名字匹配即可
    const existingChat = chatList.find(
      (chat) =>
        !chat.isGroup && // 私聊（istype: 1）
        chat.name === contact.name // 名字匹配
    );

    if (existingChat) {
      // 如果找到了，直接导航到聊天室
      parentNavigation.navigate("ChatStack", {
        screen: "ChatRoom",
        params: {
          chatId: existingChat.id,
          chatName: existingChat.name,
          isGroup: false,
        },
      });
      return; // 结束函数
    }

    // 如果没找到，执行创建新聊天的逻辑
    try {
      // console.log('Creating private chat with contact:', contact.id);

      // 先创建私聊，获取真正的 chatId
      const result = await createPrivateChat({
        name: contact.name,
        user_id: currentUserId,
        chat_with: contact.id, // 联系人ID
      });

      if (result.success && result.data?.response) {
        const newChatId = result.data.response; // 真正的 chatID（IM75356175）

        // 💾 保存 chat 信息到 store，包括 memberIds
        addChat({
          id: newChatId,
          name: contact.name,
          avatar: contact.avatar,
          isGroup: false,
          members: [
            { id: contact.id, name: contact.name, avatar: contact.avatar },
            {
              id: currentUserId,
              name: user?.name || "我",
              avatar: user?.avatar || "",
            },
          ],
          memberIds: [contact.id, currentUserId], // ✅ 包括双方的 ID
          lastMessage: "开始聊天",
          timestamp: new Date().toISOString(),
          unreadCount: 0,
          online: contact.online || false,
        });

        // console.log('✅ Chat saved to store with memberIds:', [contact.id, currentUserId]);

        // 使用返回的真正的 chat_id 导航
        parentNavigation.navigate("ChatStack", {
          screen: "ChatRoom",
          params: {
            chatId: newChatId, // ✅ 真正的 chatID（IM75356175）
            chatName: contact.name,
            isGroup: false,
          },
        });
      } else if (result.success && result.message === "Chat existed.") {
        // WORKAROUND 2.0: Find the new chat by diffing the chat list before and after refreshing.
        const oldChatIds = new Set(useChatStore.getState().chatList.map(c => c.id));

        // This is a simplified refresh function that only updates chat list
        const refreshChatList = async (userId: string) => {
            const chatsResult = await readUserChats(userId);
            if (chatsResult.success && chatsResult.data) {
                const { setChats } = useChatStore.getState();
                const formattedChats = chatsResult.data.map((chat: any) => ({
                    id: chat.chat_id,
                    name: chat.name || chat.chat_name || '未命名聊天',
                    avatar: chat.image || chat.avatar || null,
                    isGroup: chat.type === 2 || chat.isGroup || false,
                    members: chat.members || [],
                    memberIds: chat.member_ids || chat.memberIds || chat.user_ids || [],
                    lastMessage: chat.last_message || '',
                    timestamp: chat.last_message_time || chat.timestamp || new Date().toISOString(),
                    unreadCount: chat.unread_count || 0,
                }));
                setChats(formattedChats);
            }
        };

        await refreshChatList(currentUserId);
        
        const updatedChatList = useChatStore.getState().chatList;
        const newlyFoundChat = updatedChatList.find(c => !oldChatIds.has(c.id));

        if (newlyFoundChat) {
          parentNavigation.navigate("ChatStack", {
            screen: "ChatRoom",
            params: {
              chatId: newlyFoundChat.id,
              chatName: contact.name, // Use the name from the contact that was clicked
              isGroup: false,
            },
          });
        } else {
          console.error('❌ Failed to find a new chat after refresh. The backend might not be listing it in time.');
          Alert.alert("无法进入聊天", "请下拉刷新聊天列表后重试。");
        }
      } else {
        Alert.alert("提示", `无法创建聊天: ${result.message || '请重试'}`);
      }
    } catch (error) {
      // console.error('Error creating private chat:', error);
      Alert.alert("错误", "创建聊天时出错");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  };

  if (isLoading && contacts.length === 0) {
    return (
      <LinearGradient
        colors={['#FFD700', '#FFA500']}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>通讯录</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>加载联系人中...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#FFD860', '#FFD860']}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>通讯录</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} style={styles.searchIcon} />
              <TextInput
                placeholder="搜索"
                placeholderTextColor="#999"
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("AddGroup")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="chatbubbles" size={22} color="#666" />
          </View>
          <Text style={styles.actionLabel}>发起群聊</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("JoinGroup")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="people" size={22} color="#666" />
          </View>
          <Text style={styles.actionLabel}>加入群聊</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("AddFriend")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="person-add" size={22} color="#666" />
          </View>
          <Text style={styles.actionLabel}>添加好友</Text>
        </TouchableOpacity>
      </View>

      {/* SectionList */}
      <View style={styles.listContainer}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#FFD700']}
              tintColor="#FFD700"
              title="下拉刷新"
              titleColor="#666"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>暂无联系人</Text>
              <Text style={styles.emptySubtext}>添加好友以开始聊天</Text>

              <TouchableOpacity
                onPress={() => navigation.navigate("AddFriend")}
                style={styles.addFriendButton}
              >
                <Ionicons name="person-add" size={18} color="#FFF" />
                <Text style={styles.addFriendButtonText}>添加好友</Text>
              </TouchableOpacity>
            </View>
          }

          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}

          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress(item)}
            >
              <View style={styles.avatarContainer}>
                <Image
                  source={item.avatar ? { uri: item.avatar } : require('../../assets/images/anonymous.png')}
                  style={styles.avatarImage}
                />
                {item.online && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>
                  {item.name.replace(/^用户/, '')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Alphabet Index */}
        {sections.length > 0 && (
          <View style={styles.alphabetIndex}>
            {alphabet.map((letter) => {
              const hasSection = sections.some(s => s.title === letter);
              return (
                <TouchableOpacity
                  key={letter}
                  style={styles.alphabetItem}
                  onPress={() => handleLetterPress(letter)}
                  disabled={!hasSection}
                >
                  <Text style={[
                    styles.alphabetText,
                    !hasSection && styles.alphabetTextDisabled
                  ]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background.gradientYellow[0] },

  gradientHeader: { paddingBottom: scaleHeight(16) },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: scaleHeight(10),
    fontSize: typography.fontSize14,
    color: colors.text.white,
  },

  /** HEADER */
  header: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(12),
  },
  headerTitle: {
    fontSize: typography.fontSize17,
    fontWeight: typography.fontWeight600,
    textAlign: 'center',
    color: colors.text.blackMedium,
  },

  /** SEARCH */
  searchWrapper: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(12),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.white,
    borderRadius: borders.radius30,
    paddingHorizontal: scaleWidth(12),
    height: scaleHeight(38),
  },
  searchIcon: {
    marginRight: scaleWidth(8),
    color: colors.text.gray,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize15,
    color: colors.text.black,
    padding: 0,
  },

  /** QUICK ACTION BUTTONS */
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(16),
    backgroundColor: colors.background.gradientYellow[0],
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.background.gradientYellow[1],
  },
  actionButton: { alignItems: 'center', flex: 1 },
  actionIcon: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(8),
  },
  actionLabel: {
    fontSize: typography.fontSize13,
    color: colors.text.blackMedium,
    textAlign: 'center',
  },

  /** CONTACT LIST */
  listContainer: { flex: 1, position: 'relative', backgroundColor: colors.background.white },
  listContent: { flexGrow: 1 },
  sectionHeader: {
    backgroundColor: colors.background.gradientYellow[0],
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(4),
  },
  sectionHeaderText: {
    fontSize: typography.fontSize13,
    color: colors.text.grayDark,
    fontWeight: typography.fontWeight500,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: colors.background.white,
    borderBottomWidth: borders.width05,
    borderBottomColor: colors.border.grayLight,
  },
  avatarContainer: { position: 'relative', marginRight: scaleWidth(12) },
  avatarImage: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: borders.radius4,
    backgroundColor: colors.background.gray,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scaleWidth(10),
    height: scaleWidth(10),
    backgroundColor: colors.functional.greenSuccess,
    borderRadius: borders.radius50 / 5,
    borderWidth: borders.width1,
    borderColor: colors.background.white,
  },
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: {
    fontSize: typography.fontSize16,
    color: colors.text.black,
    fontWeight: typography.fontWeight400,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scaleHeight(80),
  },
  emptyText: {
    fontSize: typography.fontSize18,
    color: colors.text.black,
    fontWeight: typography.fontWeight600,
    textAlign: 'center',
    marginTop: scaleHeight(15),
    marginBottom: scaleHeight(8),
  },
  emptySubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.gray,
    textAlign: 'center',
    marginBottom: scaleHeight(25),
  },

  addFriendButton: {
    flexDirection: 'row',
    backgroundColor: colors.functional.yellow,
    paddingHorizontal: scaleWidth(24),
    paddingVertical: scaleHeight(12),
    borderRadius: borders.radius25,
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  addFriendButtonText: {
    color: colors.text.black,
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight600,
    marginLeft: scaleWidth(4),
  },

  /** ALPHABET INDEX */
   alphabetIndex: {
    position: 'absolute',
    right: scaleWidth(4),
    top: scaleHeight(20),
    justifyContent: 'center',
    paddingVertical: scaleHeight(8),
    width: scaleWidth(20),
    backgroundColor: 'transparent',
  },
  alphabetItem: {
    paddingVertical: scaleHeight(1),
    paddingHorizontal: scaleWidth(2),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scaleHeight(14),
  },
  alphabetText: {
    fontSize: scaleFont(10),
    color: colors.text.grayDark,
    fontWeight: typography.fontWeight600,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  alphabetTextDisabled: {
    color: colors.text.grayLight,
  },
});