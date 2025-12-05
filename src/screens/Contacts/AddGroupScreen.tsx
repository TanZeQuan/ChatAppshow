import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";
import { useChatStore } from "../../store/chatStore";
import { readFriends } from "../../api/Friend";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function AddGroupScreen() {
  const navigation = useNavigation<any>();
  const { contacts, setContacts } = useContactStore();
  const { token } = useUserStore();
  const { addChat } = useChatStore();

  const [searchText, setSearchText] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load contacts when screen mounts
  useEffect(() => {
    loadContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContacts = async () => {
    try {
      setIsLoading(true);

      // Fetch approved friends (isstatus = 2)
      const result = await readFriends(2);

      if (result.success && result.data) {
        const allFriends = [
          ...(result.data.request || []),
          ...(result.data.approve || [])
        ];

        // Transform API response to contact format
        const formattedContacts = allFriends.map((friend: any) => {
          const userId = friend.user_id || friend.id || friend.userId || friend.approve_id || friend.request_id;
          const userName = friend.name || friend.username || friend.display_name || friend.user_name || `用户${userId}`;
          const userAvatar = friend.avatar || friend.profile_picture || friend.avatarUrl || friend.avatar_url || friend.photo || friend.image;

          return {
            id: userId,
            name: userName,
            avatar: userAvatar,
            online: friend.online || friend.is_online || false,
            rawData: friend,
            listId: '',       // 👈 补上默认值
            isFriend: true,   // 👈 补上默认值
          };
        });

        // Remove duplicates
        const uniqueContacts = Array.from(
          new Map(formattedContacts.map(contact => [contact.id, contact])).values()
        );

        setContacts(uniqueContacts);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading contacts:", error);
      setIsLoading(false);
    }
  };

  // Filter contacts based on search
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const handleConfirm = async () => {
    if (selectedMembers.length === 0) {
      Alert.alert("错误", "请至少选择一位成员");
      return;
    }

    if (!token) {
      Alert.alert("错误", "请先登录");
      return;
    }

    // Show modal to enter group name
    setShowGroupNameModal(true);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("错误", "请输入群聊名称");
      return;
    }

    try {
      const selectedContacts = contacts.filter((c) =>
        selectedMembers.includes(c.id)
      );

      const groupChatId = `group_${Date.now()}`;

      const newGroupChat = {
        id: groupChatId,
        name: groupName.trim(),
        avatar: null,
        isGroup: true,
        members: selectedContacts,
        memberIds: selectedMembers,
        lastMessage: "群聊已创建",
        timestamp: new Date().toISOString(),
        unreadCount: 0,
        online: false,
      };

      addChat(newGroupChat);
      setShowGroupNameModal(false);

      Alert.alert(
        "成功",
        `群聊 "${groupName}" 已创建！`,
        [
          {
            text: "确定",
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("错误", "创建群聊失败，请重试");
    }
  };

  const getSelectedMemberNames = () => {
    return contacts
      .filter((c) => selectedMembers.includes(c.id))
      .map((c) => c.name)
      .join(", ");
  };

  const renderContactItem = ({ item }: { item: any }) => {
    const isSelected = selectedMembers.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => toggleMember(item.id)}
      >
        <View style={styles.contactLeft}>
          <Image
            source={{ uri: item.avatar || `https://i.pravatar.cc/150?u=${item.id}` }}
            style={styles.contactAvatar}
          />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>
              {item.name.replace(/^用户/, '')}
            </Text>
          </View>
        </View>
        <View style={[styles.checkbox, !isSelected && styles.checkboxUnchecked]}>
          {isSelected && (
            <Ionicons name="checkmark" size={18} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>发起群聊</Text>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={selectedMembers.length === 0}
        >
          <Text
            style={[
              styles.confirmButtonText,
              selectedMembers.length === 0 && styles.confirmButtonDisabled,
            ]}
          >
            确认({selectedMembers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索联系人"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Members Preview */}
      {selectedMembers.length > 0 && (
        <View style={styles.selectedPreview}>
          <Text style={styles.selectedText}>
            已选择: {getSelectedMemberNames()}
          </Text>
        </View>
      )}

      {/* Contacts List */}
      <View style={styles.contactsSection}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5C842" />
            <Text style={styles.loadingText}>加载联系人中...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchText ? "未找到联系人" : "暂无联系人"}
            </Text>
            <Text style={styles.emptySubtext}>
              先添加好友才能创建群组
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Group Name Modal */}
      <Modal
        visible={showGroupNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGroupNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setShowGroupNameModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>创建群聊</Text>
                  <TouchableOpacity
                    onPress={() => setShowGroupNameModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.inputLabel}>群聊名称</Text>
                  <TextInput
                    style={styles.groupNameInput}
                    placeholder="请输入群聊名称"
                    value={groupName}
                    onChangeText={setGroupName}
                    autoFocus={true}
                    maxLength={30}
                  />

                  <Text style={styles.memberCount}>
                    成员数: {selectedMembers.length}
                  </Text>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setShowGroupNameModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.createButton]}
                      onPress={handleCreateGroup}
                    >
                      <Text style={styles.createButtonText}>创建</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: "#F5C842",
    borderBottomWidth: 1,
    borderBottomColor: "#E5B830",
  },
  backButton: {
    padding: scaleWidth(8),
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: "600",
    color: "#333",
  },
  confirmButton: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(6),
  },
  confirmButtonText: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
  },
  confirmButtonDisabled: {
    color: "#999",
  },

  /** SEARCH */
  searchSection: {
    backgroundColor: "#FFF8DC",
    padding: scaleWidth(16),
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: scaleWidth(12),
  },
  searchIcon: {
    marginRight: scaleWidth(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scaleFont(14),
    color: "#333",
    paddingVertical: scaleHeight(10),
  },

  /** SELECTED PREVIEW */
  selectedPreview: {
    backgroundColor: "#FFF8DC",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(8),
    borderBottomWidth: 1,
    borderBottomColor: "#E5B830",
  },
  selectedText: {
    fontSize: scaleFont(13),
    color: "#666",
  },

  /** LOADING */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: scaleHeight(60),
  },
  loadingText: {
    marginTop: scaleHeight(12),
    fontSize: scaleFont(14),
    color: "#666",
  },

  /** CONTACTS LIST */
  contactsSection: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  contactAvatar: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    borderRadius: scaleWidth(20),
    marginRight: scaleWidth(12),
    backgroundColor: "#E0E0E0",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: scaleFont(15),
    fontWeight: "400",
    color: "#333",
  },
  checkbox: {
    width: scaleWidth(22),
    height: scaleHeight(22),
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#34C759",
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxUnchecked: {
    backgroundColor: "transparent",
    borderColor: "#CCCCCC",
  },

  /** EMPTY STATE */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: scaleHeight(60),
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: "#666",
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(4),
  },
  emptySubtext: {
    fontSize: scaleFont(13),
    color: "#999",
  },

  /** MODAL */
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: scaleWidth(320),
    maxWidth: "90%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: scaleFont(18),
    fontWeight: "600",
    color: "#333",
  },
  modalCloseButton: {
    padding: scaleWidth(4),
  },
  modalBody: {
    padding: scaleWidth(20),
  },
  inputLabel: {
    fontSize: scaleFont(14),
    color: "#666",
    marginBottom: scaleHeight(8),
    fontWeight: "500",
  },
  groupNameInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    fontSize: scaleFont(15),
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  memberCount: {
    fontSize: scaleFont(13),
    color: "#999",
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(20),
  },
  modalButtons: {
    flexDirection: "row",
    gap: scaleWidth(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: scaleHeight(12),
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
  },
  cancelButtonText: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#666",
  },
  createButton: {
    backgroundColor: "#F5C842",
  },
  createButtonText: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
  },
});