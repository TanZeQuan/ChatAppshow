import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useContactStore } from "../../store/contactStore"; // 引入好友请求 store
import { useFriendRequestStore } from "../../store/friendRequestStore";
import { createFriendRequest } from "../../api/Friend";
import { searchUsers } from "../../api/User"; // Import searchUsers from User API
import { useUserStore } from "../../store/userStore";

export default function AddFriendScreen() {
  const navigation = useNavigation();
  const { addFriendRequest } = useContactStore(); // Not used, can be removed later
  const { addRequest } = useFriendRequestStore(); // Not used, can be removed later
  const { token, user: currentUser } = useUserStore(); // Get current user

  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null); // searchResult will now hold more properties
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // const [requestSent, setRequestSent] = useState(false); // No longer needed, status is in searchResult

  const handleSearch = async () => {
    if (!searchText.trim()) {
      Alert.alert("提示", "请输入账号ID或手机号");
      return;
    }
    if (!currentUser?.id) {
        Alert.alert("错误", "无法获取当前用户信息，请重新登录");
        return;
    }

    setIsSearching(true);
    setHasSearched(true);
    // setRequestSent(false); // No longer needed

    try {
      const response = await searchUsers(searchText.trim(), currentUser.id); // Use new searchUsers API
      
      if (response.success && response.users && response.users.length > 0) {
        const foundUser = response.users[0]; // Assuming we display the first result
        setSearchResult({
          id: foundUser.user_id,
          name: foundUser.name,
          avatar: foundUser.image || `https://i.pravatar.cc/150?img=${foundUser.user_id}`,
          bio: foundUser.about,
          request_by: foundUser.request_by, // Friend status
          isstatus: foundUser.isstatus   // Friend status
        });
      } else {
        setSearchResult(null);
        Alert.alert("提示", response.message || "未找到该用户");
      }
    } catch (error) {
      console.error("Search failed:", error);
      Alert.alert("错误", "搜索失败，请重试");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || !currentUser?.id) return;

    // Check existing friend status
    if (searchResult.isstatus === 1) { // Pending
        if (searchResult.request_by === 1) { // Current user sent request
            Alert.alert("提示", "您已发送好友请求，请等待对方同意");
        } else if (searchResult.request_by === 2) { // Other user sent request
            Alert.alert("提示", "对方已发送好友请求，请前往好友请求页面处理");
        }
        return;
    } else if (searchResult.isstatus === 2) { // Accepted
        Alert.alert("提示", "对方已是您的好友");
        return;
    } else if (searchResult.isstatus === 4) { // Blocked
        Alert.alert("提示", "该用户已被您拉黑");
        return;
    }

    try {
      const response = await createFriendRequest(currentUser.id, searchResult.id, "");

      if (response.success) {
        // Optimistically update status to Pending (I sent request) in searchResult for UI
        setSearchResult((prev: any) => ({
          ...prev,
          isstatus: 1,
          request_by: 1,
        }));
        Alert.alert("成功", "好友请求已发送", [{ text: "确定" }]);
      } else {
        Alert.alert("错误", response.message || "发送请求失败，请重试");
      }
    } catch (error) {
      Alert.alert("错误", "发送请求失败，请重试");
      console.error(error);
    }
  };


  const handleScanQR = () => {
    console.log("Scan QR Code");
  };

  const handleMyQR = () => {
    navigation.navigate("FriendRequest" as never);
  };

  return (
    <LinearGradient colors={["#fcd34d", "#fef3c7"]} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="#78350f" />
            </TouchableOpacity>
            <Text style={styles.title}>添加好友</Text>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索账号ID"
              placeholderTextColor="#d1d5db"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setHasSearched(false);
                setSearchResult(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchText("");
                setSearchResult(null);
                setHasSearched(false);
              }}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#78350f" />
            ) : (
              <Text style={styles.searchButtonText}>搜索</Text>
            )}
          </TouchableOpacity>

          {/* Search Result */}
          {hasSearched && searchResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>搜索结果</Text>
              <View style={styles.userCard}>
                <Image
                  source={{ uri: searchResult.avatar }}
                  style={styles.userAvatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{searchResult.name}</Text>
                  <Text style={styles.userId}>ID: {searchResult.id}</Text>
                  {searchResult.bio && (
                    <Text style={styles.userBio}>{searchResult.bio}</Text>
                  )}
                </View>
              </View>

              {/* Add/Status Button */}
              {searchResult.isstatus === 0 ? ( // No relation
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleSendRequest}
                >
                  <Ionicons name="person-add" size={18} color="#78350f" />
                  <Text style={styles.addButtonText}>添加好友</Text>
                </TouchableOpacity>
              ) : searchResult.isstatus === 1 ? ( // Pending
                <View style={styles.sentContainer}>
                  <Ionicons name="time-outline" size={18} color="#FF9800" />
                  <Text style={styles.sentText}>
                    {searchResult.request_by === 1 ? "请求已发送" : "待处理请求"}
                  </Text>
                </View>
              ) : searchResult.isstatus === 2 ? ( // Accepted
                <View style={styles.sentContainer}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <Text style={styles.rewordingSentText}>已是好友</Text>
                </View>
              ) : searchResult.isstatus === 4 ? ( // Blocked
                <View style={styles.sentContainer}>
                  <Ionicons name="ban-outline" size={18} color="#F44336" />
                  <Text style={styles.sentText}>已拉黑</Text>
                </View>
              ) : null}
            </View>
          )}

          {hasSearched && !searchResult && !isSearching && (
            <View style={styles.noResultContainer}>
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text style={styles.noResultText}>未找到该用户</Text>
            </View>
          )}

          {/* Action Items */}
          <View style={styles.actionsContainer}>
            {/* Scan QR Code */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleScanQR}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.iconContainer, { backgroundColor: "#fbbf24" }]}>
                  <Ionicons name="scan" size={22} color="#78350f" />
                </View>
                <Text style={styles.actionLabel}>扫描名片</Text>
              </View>
            </TouchableOpacity>

            {/* My QR Code → FriendRequest */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleMyQR}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.iconContainer, { backgroundColor: "#fbbf24" }]}>
                  <Ionicons name="person-outline" size={22} color="#78350f" />
                </View>
                <Text style={styles.actionLabel}>好友请求</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 10,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 0,
    width: 36,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#78350f",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
  },
  searchButton: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78350f",
  },
  resultContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78350f",
    marginBottom: 12,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f3f4f6",
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  userId: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  userBio: {
    fontSize: 12,
    color: "#9ca3af",
  },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#fbbf24",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78350f",
  },
  sentContainer: {
    flexDirection: "row",
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sentText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#16a34a",
  },
  rewordingSentText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  noResultContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginBottom: 20,
  },
  noResultText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
  actionsContainer: {
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
  },
});