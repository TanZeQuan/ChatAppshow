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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function AddGroupScreen() {
  const navigation = useNavigation();
  const { contacts } = useContactStore();
  const { token } = useUserStore();

  const [searchText, setSearchText] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

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
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    if (!token) {
      Alert.alert("Error", "Please login first");
      return;
    }

    Alert.alert(
      "Success",
      `Selected ${selectedMembers.length} members!`,
      [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]
    );
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
        >
          <Text style={styles.confirmButtonText}>确认</Text>
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
});