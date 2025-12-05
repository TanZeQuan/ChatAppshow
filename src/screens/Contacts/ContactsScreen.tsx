import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";
import { useChatStore } from "../../store/chatStore";
import { readFriends } from "../../api/Friend";

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
  const { token } = useUserStore();
  useChatStore();

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

      console.log("loadContacts result:", result);

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

          console.log(`Contact ${userId}: avatar = ${userAvatar}`);

          return {
            id: userId,
            name: userName,
            avatar: userAvatar,
            online: friend.online || friend.is_online || false,
            rawData: friend, // Store original data for reference
          };
        });

        // Remove duplicates based on id
        const uniqueContacts = Array.from(
          new Map(formattedContacts.map(contact => [contact.id, contact])).values()
        );

        console.log("Formatted contacts:", uniqueContacts);

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
        console.log('Scroll to letter:', letter);
      }
    }
  };

  const handleContactPress = (contact: any) => {
    const parentNavigation = navigation.getParent();

    if (parentNavigation) {
      parentNavigation.navigate('ChatStack', {
        screen: 'ChatRoom',
        params: {
          chatId: contact.id,
          chatName: contact.name,
          isGroup: false,
        },
      });
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
        colors={['#FFD700', '#FFA500']}
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
                  source={{ uri: item.avatar || "https://i.pravatar.cc/150?img=" + item.id }}
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
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  gradientHeader: {
    paddingBottom: scaleHeight(16),
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: scaleHeight(10),
    fontSize: scaleFont(14),
    color: "#FFFFFF",
  },

  /** HEADER */
  header: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(12),
  },
  headerTitle: {
    fontSize: scaleFont(17),
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
  },

  /** SEARCH */
  searchWrapper: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(12),
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: scaleWidth(12),
    height: scaleHeight(40),
  },
  searchIcon: {
    marginRight: scaleWidth(8),
    color: "#999",
  },
  searchInput: {
    flex: 1,
    fontSize: scaleFont(15),
    color: "#333",
    padding: 0,
  },

  /** QUICK ACTION BUTTONS */
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(16),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },

  actionIcon: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    backgroundColor: "#F5F5F5",
    borderRadius: scaleWidth(8),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: scaleHeight(8),
  },
  actionLabel: {
    fontSize: scaleFont(13),
    color: "#333",
    textAlign: "center",
  },

  /** CONTACT LIST */
  listContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#FFFFFF",
  },

  listContent: {
    flexGrow: 1,
  },

  sectionHeader: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(4),
  },
  sectionHeaderText: {
    fontSize: scaleFont(13),
    color: "#666",
    fontWeight: "500",
  },

  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5E5",
  },

  avatarContainer: {
    position: "relative",
    marginRight: scaleWidth(12),
  },
  avatarImage: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(4),
    backgroundColor: "#E0E0E0",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: scaleWidth(10),
    height: scaleWidth(10),
    backgroundColor: "#4CAF50",
    borderRadius: scaleWidth(5),
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
    justifyContent: "center",
  },
  contactName: {
    fontSize: scaleFont(16),
    color: "#333",
    fontWeight: "400",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: scaleHeight(80),
  },
  emptyText: {
    fontSize: scaleFont(18),
    color: "#333",
    fontWeight: "600",
    textAlign: "center",
    marginTop: scaleHeight(15),
    marginBottom: scaleHeight(8),
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: "#999",
    textAlign: "center",
    marginBottom: scaleHeight(25),
  },

  addFriendButton: {
    flexDirection: "row",
    backgroundColor: "#FFD700",
    paddingHorizontal: scaleWidth(24),
    paddingVertical: scaleHeight(12),
    borderRadius: 25,
    alignItems: "center",
    gap: scaleWidth(8),
  },
  addFriendButtonText: {
    color: "#333",
    fontSize: scaleFont(15),
    fontWeight: "600",
    marginLeft: scaleWidth(4),
  },

  /** ALPHABET INDEX */
  alphabetIndex: {
    position: "absolute",
    right: scaleWidth(2),
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingVertical: scaleHeight(4),
  },
  alphabetItem: {
    paddingVertical: scaleHeight(1),
    paddingHorizontal: scaleWidth(4),
    alignItems: "center",
    justifyContent: "center",
  },
  alphabetText: {
    fontSize: scaleFont(9),
    color: "#666",
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  alphabetTextDisabled: {
    color: "#D0D0D0",
  },
});