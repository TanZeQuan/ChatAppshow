import React, { useState, useRef, useEffect } from "react";
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
import { useFriendRequestStore } from "../../store/friendRequestStore";
import { useUserStore } from "../../store/userStore";
import { searchUser, createFriendRequest } from "../../api/Friend";

// Define proper types matching API response
interface SearchResult {
  user_id: string;
  name: string;
  image: string;
  phone: string;
  about?: string;
  isstatus: number;
}

export default function AddFriendScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  
  const { addRequest } = useFriendRequestStore();
  const currentUser = useUserStore((state) => state.user);
  
  // Prevent memory leaks
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSearch = async () => {
    if (!searchText.trim()) {
      Alert.alert("提示", "请输入账号ID");
      return;
    }

    // Prevent self-search
    if (currentUser && searchText.trim() === currentUser.id) {
      Alert.alert("提示", "不能添加自己为好友");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setRequestSent(false);

    try {
      const result = await searchUser(searchText.trim());
      
      console.log("=== Search Result Debug ===");
      console.log("Full result:", JSON.stringify(result, null, 2));
      console.log("result.success:", result.success);
      console.log("result.user:", result.user);
      console.log("Is array:", Array.isArray(result.user));
      console.log("Array length:", result.user?.length);
      
      if (!isMounted.current) return;
      
      // API returns response as an array, get the first item
      if (result.success && result.user && Array.isArray(result.user) && result.user.length > 0) {
        const userData = result.user[0]; // Get first result
        console.log("✅ User found:", userData);
        setSearchResult(userData);
      } else {
        console.log("❌ No user found");
        setSearchResult(null);
        Alert.alert("提示", result.message || "未找到该用户");
      }
    } catch (error) {
      if (!isMounted.current) return;
      Alert.alert("错误", "搜索失败，请重试");
      console.error(error);
    } finally {
      if (isMounted.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;

    setIsSending(true);

    try {
      // Use user_id from the search result
      const result = await createFriendRequest(searchResult.user_id);

      if (!isMounted.current) return;

      if (result.success) {
        // Add to friend request store with correct field mapping
        addRequest({
          id: searchResult.user_id,
          name: searchResult.name,
          avatar: searchResult.image,
        });

        setRequestSent(true);
        Alert.alert("成功", "好友请求已发送", [
          { 
            text: "确定",
            onPress: () => {
              // Optionally navigate to FriendRequest screen
              // navigation.navigate("FriendRequest" as never);
            }
          }
        ]);
      } else {
        // Handle specific error cases
        const errorMessage = result.message || "发送请求失败";
        
        if (errorMessage.includes("已经是好友") || errorMessage.includes("already friends")) {
          Alert.alert("提示", "你们已经是好友了");
        } else if (errorMessage.includes("已发送") || errorMessage.includes("pending")) {
          Alert.alert("提示", "已有待处理的好友请求");
          setRequestSent(true);
        } else if (errorMessage.includes("不能添加自己") || errorMessage.includes("cannot add yourself")) {
          Alert.alert("提示", "不能添加自己为好友");
        } else {
          Alert.alert("错误", errorMessage);
        }
      }
    } catch (error) {
      if (!isMounted.current) return;
      Alert.alert("错误", "发送请求失败，请重试");
      console.error(error);
    } finally {
      if (isMounted.current) {
        setIsSending(false);
      }
    }
  };

  const handleScanQR = () => {
    // TODO: Implement QR scanner navigation
    // navigation.navigate("QRScanner" as never);
    Alert.alert("提示", "扫描功能即将推出");
  };

  const handleMyQR = () => {
    navigation.navigate("FriendRequest" as never);
  };

  const handleClearSearch = () => {
    setSearchText("");
    setSearchResult(null);
    setHasSearched(false);
    setRequestSent(false);
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
                setRequestSent(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              editable={!isSearching}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching || !searchText.trim()}
          >
            {isSearching ? (
              <ActivityIndicator color="#78350f" />
            ) : (
              <Text style={styles.searchButtonText}>搜索</Text>
            )}
          </TouchableOpacity>

          {/* Search Result - Compact Horizontal Card */}
          {hasSearched && searchResult && (
            <View style={styles.resultCard}>
              {/* Left: Avatar */}
              <Image
                source={{ uri: searchResult.image }}
                style={styles.resultAvatar}
              />
              
              {/* Middle: User Info */}
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {searchResult.name}
                </Text>
                <Text style={styles.resultId} numberOfLines={1}>
                  ID: {searchResult.user_id}
                </Text>
                {searchResult.phone && (
                  <Text style={styles.resultPhone} numberOfLines={1}>
                    📱 {searchResult.phone}
                  </Text>
                )}
              </View>

              {/* Right: Add Button */}
              {!requestSent ? (
                <TouchableOpacity
                  style={[styles.addIconButton, isSending && styles.addIconButtonDisabled]}
                  onPress={handleSendRequest}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#78350f" size="small" />
                  ) : (
                    <Ionicons name="person-add" size={24} color="#78350f" />
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.addedIconButton}>
                  <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                </View>
              )}
            </View>
          )}

          {hasSearched && !searchResult && !isSearching && (
            <View style={styles.noResultContainer}>
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text style={styles.noResultText}>未找到该用户</Text>
              <Text style={styles.noResultSubtext}>请检查账号ID是否正确</Text>
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
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
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
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78350f",
  },
  // Compact Result Card Styles
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f3f4f6",
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
    justifyContent: "center",
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  resultId: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: 12,
    color: "#9ca3af",
  },
  addIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  addIconButtonDisabled: {
    opacity: 0.6,
  },
  addedIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  // Profile Card Styles
  profileCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  profileHeader: {
    height: 100,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeaderGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarContainer: {
    marginTop: 40,
    position: "relative",
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "white",
    backgroundColor: "#f3f4f6",
  },
  avatarBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#fbbf24",
  },
  profileInfo: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: "center",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
    textAlign: "center",
  },
  profileId: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    fontWeight: "500",
  },
  detailsContainer: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  actionButtonsContainer: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  successButton: {
    flexDirection: "row",
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#86efac",
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
  },
  secondaryButton: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#fbbf24",
  },
  secondaryButtonText: {
    fontSize: 16,
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
    marginBottom: 2,
  },
  userPhone: {
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
  addButtonDisabled: {
    opacity: 0.6,
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
    fontWeight: "500",
  },
  noResultSubtext: {
    fontSize: 12,
    color: "#d1d5db",
    marginTop: 4,
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