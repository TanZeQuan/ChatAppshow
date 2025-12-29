import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { colors, borders, typography } from "../../styles";
import { useFriendRequestStore } from "../../store/friendRequestStore";
import { useUserStore } from "../../store/userStore";
import { readFriends, acceptFriendRequest, rejectFriendRequest } from "../../api/Friend";

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

// Friend request data structure from API
interface FriendRequestData {
  list_id: string;
  request_id: string;
  approve_id: string;
  user_id: string;
  name: string;
  image: string;
  phone: string;
  about: string;
  isstatus: number;
  request_by: number;
}

export default function FriendRequestScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const { removeRequest } = useFriendRequestStore();
  const { addContact, getContactById } = useContactStore();
  const currentUser = useUserStore((state) => state.user);

  // State for API data
  const [receivedPending, setReceivedPending] = useState<FriendRequestData[]>([]);
  const [receivedAccepted, setReceivedAccepted] = useState<FriendRequestData[]>([]);
  const [receivedRejected, setReceivedRejected] = useState<FriendRequestData[]>([]);
  const [sentPending, setSentPending] = useState<FriendRequestData[]>([]);
  const [sentAccepted, setSentAccepted] = useState<FriendRequestData[]>([]);
  const [sentRejected, setSentRejected] = useState<FriendRequestData[]>([]);

  // Fetch friend requests from API
  const fetchFriendRequests = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      // Fetch pending requests (isstatus = 1)
      const pendingResult = await readFriends(1);

      // Fetch accepted requests (isstatus = 2)
      const acceptedResult = await readFriends(2);

      // Fetch rejected requests (isstatus = 3)
      const rejectedResult = await readFriends(3);

      if (pendingResult.success && pendingResult.data) {
        // request: 我发送的请求
        // approve: 收到的请求
        setSentPending(pendingResult.data.request || []);
        setReceivedPending(pendingResult.data.approve || []);
      }

      if (acceptedResult.success && acceptedResult.data) {
        setSentAccepted(acceptedResult.data.request || []);
        setReceivedAccepted(acceptedResult.data.approve || []);
      }

      if (rejectedResult.success && rejectedResult.data) {
        setSentRejected(rejectedResult.data.request || []);
        setReceivedRejected(rejectedResult.data.approve || []);
      }

      console.log("Friend requests loaded successfully");
    } catch (error) {
      console.error("Failed to fetch friend requests:", error);
      Alert.alert("错误", "加载好友请求失败");
    } finally {
      setLoading(false);
    }
  };

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

  // Load data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchFriendRequests(); // 仅刷新数据
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFriendRequests();
    setRefreshing(false);
  };
  const handleConfirm = async (item: FriendRequestData) => {
    // Check if already a contact
    const existingContact = getContactById(item.user_id);
    if (existingContact) {
      Alert.alert("提示", `${item.name} 已经是你的好友了`);
      await fetchFriendRequests(); // Refresh list
      return;
    }

    Alert.alert(
      "确认",
      `确定添加 ${item.name} 为好友吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: async () => {
            setProcessingId(item.list_id);
            try {
              // Accept friend request using list_id
              const result = await acceptFriendRequest(item.list_id);

              if (result.success) {
                // Add to contacts
                addContact({
                  id: item.user_id,
                  name: item.name,
                  avatar: item.image,
                  online: true,
                  listId: undefined,
                  isFriend: false
                });

                // Remove from local request store if exists
                removeRequest(item.user_id);

                Alert.alert(
                  "成功",
                  `已添加 ${item.name} 为好友`,
                  [
                    {
                      text: "确定",
                      onPress: () => fetchFriendRequests() // Refresh list
                    },
                    {
                      text: "查看通讯录",
                      onPress: () => navigation.navigate('Contacts' as never),
                    },
                  ]
                );
              } else {
                Alert.alert("错误", result.message || "添加好友失败");
              }
            } catch (error) {
              Alert.alert("错误", "添加好友失败，请重试");
              console.error(error);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (item: FriendRequestData) => {
    Alert.alert(
      "拒绝",
      `确定拒绝 ${item.name} 的好友请求吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "拒绝",
          style: "destructive",
          onPress: async () => {
            setProcessingId(item.list_id);
            try {
              // Reject friend request using list_id
              const result = await rejectFriendRequest(item.list_id);

              if (result.success) {
                // Remove from local request store if exists
                removeRequest(item.user_id);

                Alert.alert("已拒绝", `已拒绝 ${item.name} 的好友请求`);

                // Refresh list
                await fetchFriendRequests();
              } else {
                Alert.alert("错误", result.message || "操作失败");
              }
            } catch (error) {
              Alert.alert("错误", "操作失败，请重试");
              console.error(error);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const renderReceivedPendingItem = (item: FriendRequestData) => (
    <View key={item.list_id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={
            !item.image || item.image.trim() === '' || item.image.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
              ? require('../../assets/images/personal.png')
              : { uri: item.image }
          }
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.userId}>ID: {item.user_id}</Text>
          {item.phone && (
            <Text style={styles.userPhone}>📱 {item.phone}</Text>
          )}
        </View>
      </View>
      <View style={styles.buttonGroup}>
        {processingId === item.list_id ? (
          <ActivityIndicator color="#FFD700" size="small" />
        ) : (
          <>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleReject(item)}
              disabled={processingId !== null}
            >
              <Text style={styles.rejectButtonText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => handleConfirm(item)}
              disabled={processingId !== null}
            >
              <Text style={styles.confirmButtonText}>接受</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderStatusItem = (item: FriendRequestData, statusText: string, statusColor: string) => (
    <View key={item.list_id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={
            !item.image || item.image.trim() === '' || item.image.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
              ? require('../../assets/images/personal.png')
              : { uri: item.image }
          }
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.userId}>ID: {item.user_id}</Text>
        </View>
      </View>
      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
    </View>
  );

  const renderSection = (
    title: string,
    count: number,
    data: FriendRequestData[],
    emptyMessage: string,
    renderItem: (item: FriendRequestData) => React.ReactNode
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title} ({count})
        </Text>
      </View>
      <View style={styles.sectionContent}>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        ) : (
          data.map(item => renderItem(item))
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>好友请求</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Loading Indicator */}
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFD700" size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
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
      >
        {/* 收到的待处理请求 */}
        {renderSection(
          "收到的待处理请求",
          receivedPending.length,
          receivedPending,
          "目前没有待处理的好友请求～",
          renderReceivedPendingItem
        )}

        {/* 已接受的好友 */}
        {renderSection(
          "已接受的好友",
          receivedAccepted.length,
          receivedAccepted,
          "还没有接受的好友请求～",
          (item) => renderStatusItem(item, "已接受", "#4CAF50")
        )}

        {/* 已拒绝的请求 */}
        {renderSection(
          "已拒绝的请求",
          receivedRejected.length,
          receivedRejected,
          "还没有拒绝的好友请求～",
          (item) => renderStatusItem(item, "已拒绝", "#F44336")
        )}

        {/* 发送的待处理请求 */}
        {renderSection(
          "发送的待处理请求",
          sentPending.length,
          sentPending,
          "还没有发送待处理的请求～",
          
          (item) => renderStatusItem(item, "等待回应", "#FF9800")
        )}

        {/* 对方已接受的请求 */}
        {renderSection(
          "对方已接受的请求",
          sentAccepted.length,
          sentAccepted,
          "还没有对方接受的请求～",
          (item) => renderStatusItem(item, "已接受", "#4CAF50")
        )}

        {/* 对方已拒绝的请求 */}
        {renderSection(
          "对方已拒绝的请求",
          sentRejected.length,
          sentRejected,
          "还没有对方拒绝的请求～",
          (item) => renderStatusItem(item, "已拒绝", "#F44336")
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.grayLight },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: colors.background.yellowBright,
  },
  backButton: { padding: scaleWidth(8) },
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },
  placeholder: { width: scaleWidth(40) },

  /** LOADING */
  loadingContainer: {
    padding: scaleHeight(20),
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: scaleHeight(10),
    fontSize: typography.fontSize14,
    color: colors.text.gray,
  },

  scrollView: { flex: 1 },

  /** SECTIONS */
  section: { marginBottom: scaleHeight(12) },
  sectionHeader: {
    backgroundColor: colors.background.white,
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.grayLight,
  },
  sectionTitle: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },
  sectionContent: { backgroundColor: colors.background.white },

  /** REQUEST ITEM */
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: colors.background.white,
    borderBottomWidth: borders.width05,
    borderBottomColor: colors.border.grayLight,
  },
  requestLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: scaleWidth(12) },
  avatar: {
    width: scaleWidth(45),
    height: scaleWidth(45),
    borderRadius: borders.radius50,
    marginRight: scaleWidth(12),
    backgroundColor: colors.background.gray,
  },
  userInfo: { flex: 1 },
  name: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight500,
    color: colors.text.black,
    marginBottom: scaleHeight(2),
  },
  userId: {
    fontSize: typography.fontSize12,
    color: colors.text.gray,
    marginBottom: scaleHeight(2),
  },
  userPhone: {
    fontSize: typography.fontSize11,
    color: colors.text.gray,
  },

  /** BUTTONS */
  buttonGroup: { flexDirection: "row", gap: scaleWidth(8), minWidth: scaleWidth(100), justifyContent: "flex-end" },
  rejectButton: {
    backgroundColor: colors.background.grayLight,
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(6),
    borderRadius: borders.radius4,
    borderWidth: borders.width1,
    borderColor: colors.border.grayLight,
  },
  rejectButtonText: {
    fontSize: typography.fontSize13,
    fontWeight: typography.fontWeight500,
    color: colors.text.gray,
  },
  confirmButton: {
    backgroundColor: colors.functional.yellow,
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(6),
    borderRadius: borders.radius4,
  },
  confirmButtonText: {
    fontSize: typography.fontSize13,
    fontWeight: typography.fontWeight500,
    color: colors.text.black,
  },

  /** STATUS TEXT */
  statusText: {
    fontSize: typography.fontSize13,
    fontWeight: typography.fontWeight500,
  },

  /** EMPTY STATE */
  emptyText: {
    fontSize: typography.fontSize13,
    color: colors.text.gray,
    textAlign: "center",
    paddingVertical: scaleHeight(20),
  },
});