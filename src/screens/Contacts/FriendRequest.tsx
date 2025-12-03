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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useContactStore } from "../../store/contactStore";
import { useFriendRequestStore } from "../../store/friendRequestStore";
import { useUserStore } from "../../store/userStore";

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

// Mock API
const acceptFriendRequestAPI = async (userId: string, token: string) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true };
};

const rejectFriendRequestAPI = async (userId: string, token: string) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true };
};

export default function FriendRequestScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { requests, removeRequest } = useFriendRequestStore();
  const { addContact, getContactById } = useContactStore();
  const { token } = useUserStore();

  // Mock data - Replace with actual data from your store
  const mockData = {
    receivedPending: requests, // Current requests
    receivedAccepted: [],
    receivedRejected: [],
    sentPending: [],
    sentAccepted: [],
    sentRejected: [],
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('好友请求页面刷新，当前请求数:', requests.length);
    }, [requests.length])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    
    try {
      // TODO: Replace with your actual API call to fetch friend requests
      // await fetchFriendRequests(token);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('好友请求已刷新');
    } catch (error) {
      console.error('刷新好友请求失败:', error);
      Alert.alert("错误", "刷新失败，请重试");
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirm = (item: any) => {
    const existingContact = getContactById(item.id);
    if (existingContact) {
      Alert.alert("提示", `${item.name} 已经是你的好友了`);
      removeRequest(item.id);
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
            if (!token) return Alert.alert("错误", "请先登录");
            try {
              const result = await acceptFriendRequestAPI(item.id, token);
              if (result.success) {
                addContact({ id: item.id, name: item.name, avatar: item.avatar, online: true });
                removeRequest(item.id);
                Alert.alert(
                  "成功",
                  `已添加 ${item.name} 为好友`,
                  [
                    { text: "确定" },
                    { text: "查看通讯录", onPress: () => navigation.goBack() },
                  ]
                );
              }
            } catch (error) {
              Alert.alert("错误", "添加好友失败，请重试");
              console.error(error);
            }
          },
        },
      ]
    );
  };

  const handleReject = (item: any) => {
    Alert.alert(
      "拒绝",
      `确定拒绝 ${item.name} 的好友请求吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "拒绝",
          style: "destructive",
          onPress: async () => {
            if (!token) return Alert.alert("错误", "请先登录");
            try {
              const result = await rejectFriendRequestAPI(item.id, token);
              if (result.success) {
                removeRequest(item.id);
                Alert.alert("已拒绝", `已拒绝 ${item.name} 的好友请求`);
              }
            } catch (error) {
              Alert.alert("错误", "操作失败，请重试");
              console.error(error);
            }
          },
        },
      ]
    );
  };

  const renderReceivedPendingItem = (item: any) => (
    <View key={item.id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={{ uri: item.avatar || `https://i.pravatar.cc/150?img=${item.id}` }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.userId}>ID: {item.id}</Text>
        </View>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item)}>
          <Text style={styles.rejectButtonText}>拒绝</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmButton} onPress={() => handleConfirm(item)}>
          <Text style={styles.confirmButtonText}>接受</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatusItem = (item: any, statusText: string, statusColor: string) => (
    <View key={item.id} style={styles.requestItem}>
      <View style={styles.requestLeft}>
        <Image
          source={{ uri: item.avatar || `https://i.pravatar.cc/150?img=${item.id}` }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.userId}>ID: {item.id}</Text>
        </View>
      </View>
      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
    </View>
  );

  const renderSection = (
    title: string,
    count: number,
    data: any[],
    emptyMessage: string,
    renderItem: (item: any) => React.ReactNode
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
          mockData.receivedPending.length,
          mockData.receivedPending,
          "目前没有待处理的好友请求～",
          renderReceivedPendingItem
        )}

        {/* 已接受的好友 */}
        {renderSection(
          "已接受的好友",
          mockData.receivedAccepted.length,
          mockData.receivedAccepted,
          "还没有接受的好友请求～",
          (item) => renderStatusItem(item, "已接受", "#4CAF50")
        )}

        {/* 已拒绝的请求 */}
        {renderSection(
          "已拒绝的请求",
          mockData.receivedRejected.length,
          mockData.receivedRejected,
          "还没有拒绝的好友请求～",
          (item) => renderStatusItem(item, "已拒绝", "#F44336")
        )}

        {/* 发送的待处理请求 */}
        {renderSection(
          "发送的待处理请求",
          mockData.sentPending.length,
          mockData.sentPending,
          "还没有发送待处理的请求～",
          (item) => renderStatusItem(item, "等待回应", "#FF9800")
        )}

        {/* 对方已接受的请求 */}
        {renderSection(
          "对方已接受的请求",
          mockData.sentAccepted.length,
          mockData.sentAccepted,
          "还没有对方接受的请求～",
          (item) => renderStatusItem(item, "已接受", "#4CAF50")
        )}

        {/* 对方已拒绝的请求 */}
        {renderSection(
          "对方已拒绝的请求",
          mockData.sentRejected.length,
          mockData.sentRejected,
          "还没有对方拒绝的请求～",
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
    borderRadius: scaleWidth(4), 
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
    color: "#999" 
  },

  // Buttons
  buttonGroup: { 
    flexDirection: "row", 
    gap: scaleWidth(8) 
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