import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";
import { useChatStore } from "../../store/chatStore";
import { addGroup } from "../../api/Group"; // Import addGroup

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function AddGroupScreen() {
  const navigation = useNavigation<any>();
  const { contacts } = useContactStore();
  const { token, user } = useUserStore();
  const { addChat } = useChatStore();

  const [searchText, setSearchText] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupName, setGroupName] = useState("");

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
    console.log("handleCreateGroup called"); // Log function start

    if (!groupName.trim()) {
      Alert.alert("错误", "请输入群聊名称");
      return;
    }
    if (!user?.id) {
      Alert.alert("错误", "无法获取当前用户信息，请重新登录");
      return;
    }

    try {
      const allMembers = Array.from(new Set([...selectedMembers, user.id]));
      const groupMembers = allMembers.map((memberId) => ({
        user_id: memberId,
        isadmin: memberId === user.id ? 2 : 1, // Set creator as admin (2), others as regular members (1)
      }));

      // Call the addGroup API
      const apiResponse = await addGroup({
        name: groupName.trim(),
        user_id: user.id, // Creator of the group
        group: groupMembers,
      });

      console.log("API Response received:", JSON.stringify(apiResponse, null, 2)); // Log the full response

      if (!apiResponse.error && apiResponse.group_id) {
        console.log("Group creation successful, proceeding to add chat to store."); // Log success branch
        const newGroupChat = {
          id: apiResponse.group_id, // Use the ID from the API response
          name: groupName.trim(),
          avatar: null, // API currently doesn't handle group avatars directly
          isGroup: true,
          members: contacts.filter(c => allMembers.includes(c.id)), // Filter actual contact objects
          memberIds: allMembers,
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
      } else {
        console.log("Group creation failed. API response indicates an error or missing group_id."); // Log failure branch
        Alert.alert("错误", apiResponse.message || "创建群聊失败，无法获取群组ID");
      }
    } catch (error) {
      console.error("Error creating group (catch block):", error); // Log caught error
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
            source={{ uri: item.avatar || "https://i.pravatar.cc/150" }}
            style={styles.contactAvatar}
          />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
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
        {filteredContacts.length === 0 ? (
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