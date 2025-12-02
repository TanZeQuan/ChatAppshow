import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  Dimensions,
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
  const { requests, removeRequest } = useFriendRequestStore();
  const { addContact, getContactById } = useContactStore();
  const { token } = useUserStore();

  useFocusEffect(
    React.useCallback(() => {
      console.log('好友请求页面刷新，当前请求数:', requests.length);
    }, [requests.length])
  );

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

  const renderRequestItem = ({ item }: { item: any }) => (
    <View style={styles.requestItem}>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>好友请求</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>暂无好友请求</Text>
            <Text style={styles.emptySubtext}>等待其他用户发送好友请求</Text>
          </View>
        ) : (
          <>
            <View style={styles.countContainer}>
              <Text style={styles.countText}>共 {requests.length} 条好友请求</Text>
            </View>
            <FlatList
              data={requests}
              renderItem={renderRequestItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8DC" },
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
  backButton: { padding: scaleWidth(8) },
  headerTitle: { fontSize: scaleFont(18), fontWeight: "600", color: "#333" },
  placeholder: { width: scaleWidth(40) },
  content: { flex: 1 },
  countContainer: { paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(12), backgroundColor: "#FFFAEB" },
  countText: { fontSize: scaleFont(13), color: "#666" },
  listContent: { paddingTop: scaleHeight(8) },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(16),
    backgroundColor: "#FFFFFF",
    marginBottom: scaleHeight(1),
  },
  requestLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: scaleWidth(12) },
  avatar: { width: scaleWidth(50), height: scaleHeight(50), borderRadius: scaleWidth(25), marginRight: scaleWidth(12), backgroundColor: "#E5E5E5" },
  userInfo: { flex: 1 },
  name: { fontSize: scaleFont(16), fontWeight: "500", color: "#333", marginBottom: scaleHeight(4) },
  userId: { fontSize: scaleFont(13), color: "#999" },
  buttonGroup: { flexDirection: "row", gap: scaleWidth(8) },
  rejectButton: { backgroundColor: "#F5F5F5", paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(8), borderRadius: 6, borderWidth: 1, borderColor: "#E5E5E5" },
  rejectButtonText: { fontSize: scaleFont(14), fontWeight: "500", color: "#666" },
  confirmButton: { backgroundColor: "#F5C842", paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(8), borderRadius: 6 },
  confirmButtonText: { fontSize: scaleFont(14), fontWeight: "500", color: "#333" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: scaleHeight(100) },
  emptyText: { fontSize: scaleFont(16), fontWeight: "500", color: "#666", marginTop: scaleHeight(12) },
  emptySubtext: { fontSize: scaleFont(13), color: "#999", marginTop: scaleHeight(8) },
});
