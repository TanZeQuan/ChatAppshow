import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, borders, typography } from "../../../styles";
import { useUserStore } from '../../../store/userStore';
import { readUsers } from '../../../api/User';

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUserStore();

  const [avatar, setAvatar] = useState<string>(user?.avatar || "");
  const [username, setUsername] = useState<string>(user?.name || "Unknown");
  const [phone, setPhone] = useState<string>(user?.phone || "");
  const [accountId, setAccountId] = useState<string>(user?.id || "");

  // Fetch latest user data on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchUser = async () => {
      try {
        const res = await readUsers(user.id);

        if (res.success && res.data?.response) {
          const userData = res.data.response;

          // ✅ Validate backend avatar: if it's only the domain (invalid), keep existing avatar
          let backendAvatar = userData.image || '';

          // Check if backend avatar is invalid (only domain, no path, or malformed path)
          const isInvalidAvatar = !backendAvatar ||
            backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
            backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/' ||
            (backendAvatar.startsWith('https://balkingly-hemitropic-lelah.ngrok-free.dev') &&
             !(backendAvatar.includes('/content/') || backendAvatar.includes('/coontent/') ||
               backendAvatar.includes('/uploads/') || backendAvatar.includes('/uploadds/')));

          // ✅ If backend avatar is invalid, get current avatar from store (not from parameter)
          const currentStoreAvatar = useUserStore.getState().user?.avatar || '';
          const finalAvatar = isInvalidAvatar ? currentStoreAvatar : backendAvatar;

          setAvatar(finalAvatar);
          setUsername(userData.name || user.name || "Unknown");
          setPhone(userData.phone || user.phone || "");
          setAccountId(userData.user_id || user.id || "");

          // Update store with latest data
          const updatedUser = {
            id: userData.user_id || user.id,
            name: userData.name || user.name || 'Unknown',
            phone: userData.phone || user.phone || '',
            email: userData.email || user.email || '',
            avatar: finalAvatar, // ✅ Use validated avatar
            about: userData.about || user.about || '',
          };

          useUserStore.getState().setUser(updatedUser, useUserStore.getState().token || "");
        }
      } catch (err) {
        console.error('EditProfile - readUsers 错误:', err);
      }
    };

    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Update local state when user changes (e.g., after editing name)
  useEffect(() => {
    if (user) {
      setAvatar(user.avatar || "");
      setUsername(user.name || "Unknown");
      setPhone(user.phone || "");
      setAccountId(user.id || "");
    }
  }, [user]);

  // Mask phone number
  const maskedPhone = phone ? `+${phone.slice(0, 4)}*****${phone.slice(-2)}` : "未设置";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>个人信息</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* List */}
      <View style={styles.listBox}>
        {/* Avatar - Display only, no interaction */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>头像</Text>
          <View style={styles.rightContent}>
            <Image source={avatar ? { uri: avatar } : require('../../../assets/images/anonymous.png')} style={styles.avatar} />
          </View>
        </View>

        {/* Name - Editable */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate("EditName")}
        >
          <Text style={styles.rowLabel}>名字</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{username}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </TouchableOpacity>

        {/* Phone - Display only */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>手机号码</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{maskedPhone}</Text>
          </View>
        </View>

        {/* Account ID - Display only */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>账号ID</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{accountId}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0], // 原 #ffefb4ff
  },

  header: {
    height: 50,
    backgroundColor: colors.functional.yellowBright, // 原 #ffe070ff
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  headerTitle: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },

  listBox: {
    backgroundColor: colors.background.yellowPale, // 原 #fff6d8c5
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    height: 60,
    alignItems: "center",
    borderBottomWidth: borders.width1,
    borderColor: colors.border.lightGray, // 原 #eee
    justifyContent: "space-between",
  },

  rowLabel: {
    fontSize: typography.fontSize15,
    color: colors.text.blackMedium, // 原 #333
  },

  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  value: {
    fontSize: typography.fontSize15,
    color: colors.text.grayMedium, // 原 #777
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: borders.radius20,
    backgroundColor: colors.functional.avatarBg,
  },
});