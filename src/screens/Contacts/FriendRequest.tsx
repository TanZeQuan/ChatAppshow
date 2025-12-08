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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useFriendRequestStore, FriendRequest as FriendRequestType } from "../../store/friendRequestStore"; // Renamed FriendRequest type to FriendRequestType to avoid conflict
import { useUserStore } from "../../store/userStore";
<<<<<<< HEAD
import { readFriends, updateFriendStatus } from "../../api/Friend"; // Import real APIs
=======
import { readFriends, acceptFriendRequest, rejectFriendRequest } from "../../api/Friend";
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

<<<<<<< HEAD
export default function FriendRequestScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  
  // Local states for different categories of friend requests
  const [receivedPending, setReceivedPending] = useState<FriendRequestType[]>([]);
  const [receivedAccepted, setReceivedAccepted] = useState<FriendRequestType[]>([]);
  const [receivedRejected, setReceivedRejected] = useState<FriendRequestType[]>([]);
  const [sentPending, setSentPending] = useState<FriendRequestType[]>([]);
  const [sentAccepted, setSentAccepted] = useState<FriendRequestType[]>([]);
  const [sentRejected, setSentRejected] = useState<FriendRequestType[]>([]);

  const { removeRequest } = useFriendRequestStore();
  const { addContact, getContactById } = useContactStore();
  const { token, user } = useUserStore(); // Get user from userStore

  // Function to fetch friend requests from API
  const fetchFriendRequests = async () => {
    if (!token || !user?.id) {
      console.warn("User not logged in or token missing. Cannot fetch friend requests.");
      return;
    }

    try {
      const fetchAndSetRequests = async (
        isstatus: number,
        type: 'received' | 'sent'
      ): Promise<FriendRequestType[]> => {
        const response = await readFriends({
          user_id: user.id,
          request_id: type === 'sent' ? user.id : '',
          approve_id: type === 'received' ? user.id : '',
          isstatus: isstatus,
        });

        if (response.success) {
          const data = type === 'received' ? response.data?.approve : response.data?.request;
          if (data) {
            return data.map((req: any) => ({
              id: req.user_id,
              list_id: req.list_id,
              name: req.name,
              avatar: req.image || `https://i.pravatar.cc/150?img=${req.user_id}`,
              status: req.isstatus,
              message: req.message,
            }));
          }
        }
        return [];
      };

      // Use Promise.all to fetch all categories in parallel
      const [
        recPending, recAccepted, recRejected,
        sntPending, sntAccepted, sntRejected
      ] = await Promise.all([
        fetchAndSetRequests(1, 'received'),
        fetchAndSetRequests(2, 'received'),
        fetchAndSetRequests(3, 'received'),
        fetchAndSetRequests(1, 'sent'),
        fetchAndSetRequests(2, 'sent'),
        fetchAndSetRequests(3, 'sent'),
      ]);

      setReceivedPending(recPending);
      setReceivedAccepted(recAccepted);
      setReceivedRejected(recRejected);
      setSentPending(sntPending);
      setSentAccepted(sntAccepted);
      setSentRejected(sntRejected);

      console.log('好友请求历史已更新');

    } catch (error) {
      console.error("Error fetching friend requests history:", error);
      Alert.alert("错误", "获取好友请求历史失败，请重试");
    }
  };
  
  useFocusEffect(
    React.useCallback(() => {
      fetchFriendRequests(); // Fetch requests when screen is focused
    }, [token, user?.id]) // Depend on token and user ID
=======
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

  // Load data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('好友请求页面刷新');
      fetchFriendRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id])
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFriendRequests();
    setRefreshing(false);
  };

<<<<<<< HEAD
  const handleConfirm = async (item: FriendRequestType) => {
    if (!token || !user?.id) return Alert.alert("错误", "请先登录");

    const existingContact = getContactById(item.id);
    if (existingContact) {
      Alert.alert("提示", `${item.name} 已经是你的好友了`);
      removeRequest(item.list_id);
      await fetchFriendRequests(); // Re-fetch to update lists
=======
  const handleConfirm = async (item: FriendRequestData) => {
    // Check if already a contact
    const existingContact = getContactById(item.user_id);
    if (existingContact) {
      Alert.alert("提示", `${item.name} 已经是你的好友了`);
      await fetchFriendRequests(); // Refresh list
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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
<<<<<<< HEAD
            try {
              const result = await updateFriendStatus(item.list_id, 2); // 2 for Accepted
              if (result.success) {
                addContact({ id: item.id, name: item.name, avatar: item.avatar, online: false });
                Alert.alert("成功", `已添加 ${item.name} 为好友`);
                await fetchFriendRequests(); // Re-fetch to update lists
              } else {
                Alert.alert("错误", result.message || "添加好友失败，请重试");
=======
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
                      onPress: () => navigation.goBack() 
                    },
                  ]
                );
              } else {
                Alert.alert("错误", result.message || "添加好友失败");
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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

<<<<<<< HEAD
  const handleReject = async (item: FriendRequestType) => {
    if (!token || !user?.id) return Alert.alert("错误", "请先登录");

=======
  const handleReject = async (item: FriendRequestData) => {
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
    Alert.alert(
      "拒绝",
      `确定拒绝 ${item.name} 的好友请求吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "拒绝",
          style: "destructive",
          onPress: async () => {
<<<<<<< HEAD
            try {
              const result = await updateFriendStatus(item.list_id, 3); // 3 for Rejected
              if (result.success) {
                Alert.alert("已拒绝", `已拒绝 ${item.name} 的好友请求`);
                await fetchFriendRequests(); // Re-fetch to update lists
              } else {
                Alert.alert("错误", result.message || "操作失败，请重试");
=======
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
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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

<<<<<<< HEAD
  const renderReceivedPendingItem = (item: FriendRequestType) => (
=======
  const renderReceivedPendingItem = (item: FriendRequestData) => (
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
    <View key={item.list_id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={{ uri: item.image }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
<<<<<<< HEAD
          <Text style={styles.userId}>ID: {item.id}</Text>
          {item.message && <Text style={styles.requestMessage}>留言: {item.message}</Text>}
=======
          <Text style={styles.userId}>ID: {item.user_id}</Text>
          {item.phone && (
            <Text style={styles.userPhone}>📱 {item.phone}</Text>
          )}
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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

<<<<<<< HEAD
  const renderStatusItem = (item: FriendRequestType, statusText: string, statusColor: string) => (
=======
  const renderStatusItem = (item: FriendRequestData, statusText: string, statusColor: string) => (
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
    <View key={item.list_id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={{ uri: item.image }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
<<<<<<< HEAD
          <Text style={styles.userId}>ID: {item.id}</Text>
          {item.message && <Text style={styles.requestMessage}>留言: {item.message}</Text>}
=======
          <Text style={styles.userId}>ID: {item.user_id}</Text>
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
        </View>
      </View>
      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
    </View>
  );

  const renderSection = (
    title: string,
    count: number,
<<<<<<< HEAD
    data: FriendRequestType[],
    emptyMessage: string,
    renderItem: (item: FriendRequestType) => React.ReactNode
=======
    data: FriendRequestData[],
    emptyMessage: string,
    renderItem: (item: FriendRequestData) => React.ReactNode
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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

<<<<<<< HEAD
=======
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

>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c
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
        
        {/* 已接受的好友 */}
        {renderSection(
          "我接受的好友",
          receivedAccepted.length,
          receivedAccepted,
          "还没有接受的好友请求～",
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
        
        {/* 已拒绝的请求 */}
        {renderSection(
          "我拒绝的请求",
          receivedRejected.length,
          receivedRejected,
          "还没有拒绝的好友请求～",
          (item) => renderStatusItem(item, "已拒绝", "#F44336")
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F5F5F5" 
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: "#FFD700",
  },
  backButton: { 
    padding: scaleWidth(8) 
  },
  headerTitle: { 
    fontSize: scaleFont(18), 
    fontWeight: "600", 
    color: "#333" 
  },
  placeholder: { 
    width: scaleWidth(40) 
  },

  loadingContainer: {
    padding: scaleHeight(20),
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: scaleHeight(10),
    fontSize: scaleFont(14),
    color: "#666",
  },

  scrollView: {
    flex: 1,
  },

  // Section Styles
  section: {
    marginBottom: scaleHeight(12),
  },
  sectionHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: scaleFont(15),
    fontWeight: "600",
    color: "#333",
  },
  sectionContent: {
    backgroundColor: "#FFFFFF",
  },

  // Request Item
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  requestLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    flex: 1, 
    marginRight: scaleWidth(12) 
  },
  avatar: { 
    width: scaleWidth(45), 
    height: scaleWidth(45), 
    borderRadius: scaleWidth(22.5), 
    marginRight: scaleWidth(12), 
    backgroundColor: "#E5E5E5" 
  },
  userInfo: { 
    flex: 1 
  },
  name: { 
    fontSize: scaleFont(15), 
    fontWeight: "500", 
    color: "#333", 
    marginBottom: scaleHeight(2) 
  },
  userId: { 
    fontSize: scaleFont(12), 
    color: "#999",
    marginBottom: scaleHeight(2),
  },
  userPhone: {
    fontSize: scaleFont(11),
    color: "#999",
  },

  // Buttons
  buttonGroup: { 
    flexDirection: "row", 
    gap: scaleWidth(8),
    minWidth: scaleWidth(100),
    justifyContent: "flex-end",
  },
  rejectButton: { 
    backgroundColor: "#F5F5F5", 
    paddingHorizontal: scaleWidth(14), 
    paddingVertical: scaleHeight(6), 
    borderRadius: 4, 
    borderWidth: 1, 
    borderColor: "#E5E5E5" 
  },
  rejectButtonText: { 
    fontSize: scaleFont(13), 
    fontWeight: "500", 
    color: "#666" 
  },
  confirmButton: { 
    backgroundColor: "#FFD700", 
    paddingHorizontal: scaleWidth(14), 
    paddingVertical: scaleHeight(6), 
    borderRadius: 4,
  },
  confirmButtonText: { 
    fontSize: scaleFont(13), 
    fontWeight: "500", 
    color: "#333" 
  },

  // Status Text
  statusText: {
    fontSize: scaleFont(13),
    fontWeight: "500",
  },

  // Empty State
  emptyText: { 
    fontSize: scaleFont(13), 
    color: "#999", 
    textAlign: "center",
    paddingVertical: scaleHeight(20),
  },
});