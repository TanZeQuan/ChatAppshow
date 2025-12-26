import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { createFriendRequest, searchUser } from "../../api/Friend";
import { ensureFullImageUrl } from "../../api/service";
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useFriendRequestStore } from "../../store/friendRequestStore";
import { useUserStore } from "../../store/userStore";
import { borders, colors, typography } from "../../styles";

// Define proper types matching API response
interface SearchResult {
  user_id: string;
  name: string;
  image: string;
  phone: string;
  about?: string;
  isstatus: number; // 0 = not friends, 1 = pending request, 2 = already friends (accepted)
}

export default function AddFriendScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const insets = useSafeAreaInsets();

  const { addRequest } = useFriendRequestStore();
  const currentUser = useUserStore((state) => state.user);

  const invalidAvatarUrl = "https://balkingly-hemitropic-lelah.ngrok-free.dev";

  // Prevent memory leaks
  const isMounted = useRef(true);
  
  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar when screen is focused
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });

      // Show tab bar when leaving the screen with ORIGINAL STYLE
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: getOriginalTabBarStyle(insets) // Restore your custom yellow style
        });
      };
    }, [navigation, insets])
  );


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

      // console.log("=== Search Result Debug ===");
      // console.log("Full result:", JSON.stringify(result, null, 2));
      // console.log("result.success:", result.success);
      // console.log("result.user:", result.user);
      // console.log("Is array:", Array.isArray(result.user));
      // console.log("Array length:", result.user?.length);

      if (!isMounted.current) return;

      // API returns response as an array, get the first item
      if (result.success && result.user && Array.isArray(result.user) && result.user.length > 0) {
        const userData = result.user[0]; // Get first result
        // console.log("✅ User found:", userData);
        // console.log("Friend status (isstatus):", userData.isstatus);
        // console.log("Status meaning: 0=not friends, 1=pending, 2=already friends");

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

    // If already friends (accepted), don't send request
    if (searchResult.isstatus === 2) {
      Alert.alert("提示", "你们已经是好友了");
      return;
    }

    // If pending request, inform user
    if (searchResult.isstatus === 1) {
      Alert.alert("提示", "已有待处理的好友请求");
      return;
    }

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
          setRequestSent(true);
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

  // Helper function to get button status
  const getButtonStatus = () => {
    if (!searchResult) return { type: 'add', disabled: true };

    // isstatus: 0 = not friends, 1 = pending request, 2 = already friends (accepted)
    if (searchResult.isstatus === 2) {
      // Already friends (request was accepted)
      return { type: 'friend', disabled: true };
    } else if (searchResult.isstatus === 1 || requestSent) {
      // Pending request (waiting for acceptance)
      return { type: 'sent', disabled: true };
    } else {
      // Not friends yet, can send request
      return { type: 'add', disabled: false };
    }
  };

  const buttonStatus = getButtonStatus();

  return (
    <LinearGradient colors={["#FFEFB0", "#FFF9E5"]} style={styles.container}>
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
              {searchResult.image && searchResult.image !== invalidAvatarUrl && searchResult.image !== `${invalidAvatarUrl}/` ? (
                <Image
                  source={{ uri: ensureFullImageUrl(searchResult.image) }}
                  style={styles.resultAvatar}
                />
              ) : (
                <Image
                  source={require('../../assets/images/personal.png')}
                  style={styles.resultAvatar}
                />
              )}

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

              {/* Right: Status Button */}
              {buttonStatus.type === 'friend' ? (
                <View style={styles.friendIconButton}>
                  <Ionicons name="people" size={24} color="#16a34a" />
                </View>
              ) : buttonStatus.type === 'sent' ? (
                <View style={styles.addedIconButton}>
                  <Ionicons name="checkmark-circle" size={24} color="#ea580c" />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addIconButton, (isSending || buttonStatus.disabled) && styles.addIconButtonDisabled]}
                  onPress={handleSendRequest}
                  disabled={isSending || buttonStatus.disabled}
                >
                  {isSending ? (
                    <ActivityIndicator color="#78350f" size="small" />
                  ) : (
                    <Ionicons name="person-add" size={24} color="#78350f" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Friend Status Badge */}
          {hasSearched && searchResult && searchResult.isstatus === 2 && (
            <View style={styles.friendBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={styles.friendBadgeText}>已经是好友</Text>
            </View>
          )}

          {/* Pending Request Badge */}
          {hasSearched && searchResult && searchResult.isstatus === 1 && (
            <View style={styles.pendingBadge}>
              <Ionicons name="time-outline" size={16} color="#ea580c" />
              <Text style={styles.pendingBadgeText}>待处理的好友请求</Text>
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
    backgroundColor: colors.background.transparentWhite50,
    borderRadius: borders.radius18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize20,
    fontWeight: typography.fontWeight600,
    color: colors.text.dark,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    shadowColor: colors.shadow.black,
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
    fontSize: typography.fontSize14,
    color: colors.text.dark,
  },
  searchButton: {
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight600,
    color: colors.text.dark,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultAvatar: {
    width: 56,
    height: 56,
    borderRadius: borders.radius28,
    backgroundColor: colors.background.grayPale,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
    justifyContent: "center",
  },
  resultName: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
    color: colors.text.dark,
    marginBottom: 4,
  },
  resultId: {
    fontSize: typography.fontSize13,
    color: colors.text.gray,
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: typography.fontSize12,
    color: colors.text.grayLight,
  },
  addIconButton: {
    width: 48,
    height: 48,
    borderRadius: borders.radius24,
    backgroundColor: colors.background.yellowLight,
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
    borderRadius: borders.radius24,
    backgroundColor: colors.background.yellowPale,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  friendIconButton: {
    width: 48,
    height: 48,
    borderRadius: borders.radius24,
    backgroundColor: colors.functional.greenLight,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.functional.greenLight,
    borderRadius: borders.radius8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
    gap: 6,
  },
  friendBadgeText: {
    fontSize: typography.fontSize13,
    fontWeight: typography.fontWeight600,
    color: colors.text.white,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.yellowPale,
    borderRadius: borders.radius8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
    gap: 6,
  },
  pendingBadgeText: {
    fontSize: typography.fontSize13,
    fontWeight: typography.fontWeight600,
    color: colors.functional.redMedium,
  },
  noResultContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginBottom: 20,
  },
  noResultText: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
    marginTop: 12,
    fontWeight: typography.fontWeight500,
  },
  noResultSubtext: {
    fontSize: typography.fontSize12,
    color: colors.text.gray,
    marginTop: 4,
  },
  actionsContainer: {
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.shadow.black,
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
    borderRadius: borders.radius20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight500,
    color: colors.text.dark,
  },
});
