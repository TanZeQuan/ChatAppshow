import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState, useEffect } from "react";
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  Dimensions,
  Alert,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileStackParamList } from "../../../navigation/types";
import { useUserStore } from '../../../store/userStore';
import { changeUserEmail, readUsers } from '../../../api/User';

type Props = NativeStackScreenProps<ProfileStackParamList, "EditEmail">;

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function EditEmailScreen({ navigation }: Props) {
  const { user } = useUserStore();
  const [currentEmail, setCurrentEmail] = useState(user?.email || "未设置");
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Set initial email from store
    if (user?.email) {
      setCurrentEmail(user.email);
    }
  }, [user?.email]);

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleConfirm = async () => {
    if (!user?.id) {
      Alert.alert("错误", "用户信息不存在");
      return;
    }

    if (!newEmail.trim()) {
      Alert.alert("错误", "请输入新邮箱");
      return;
    }

    if (!isValidEmail(newEmail.trim())) {
      Alert.alert("错误", "请输入有效的邮箱地址");
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      Alert.alert("提示", "新邮箱与当前邮箱相同");
      return;
    }

    setIsLoading(true);

    try {
      console.log('更换邮箱 - user_id:', user.id, 'new email:', newEmail.trim());

      // Call API to change email
      const res = await changeUserEmail(user.id, newEmail.trim());

      console.log('changeUserEmail 返回:', res);

      // Check if the API call failed
      if (!res.success) {
        Alert.alert("失败", res.message || "邮箱更新失败，请重试");
        return;
      }

      // Success - fetch updated user data to confirm
      const info = await readUsers(user.id);

      if (info.success && info.data?.response) {
        const userData = info.data.response;

        // Update store with complete user data
        const updatedUser = {
          id: userData.user_id || user.id,
          name: userData.name || user.name || '',
          phone: userData.phone || user.phone || '',
          email: userData.email || newEmail.trim(),
          avatar: userData.image || user.avatar || '',
          about: userData.about || user.about || '',
        };

        console.log('更新 store:', updatedUser);

        useUserStore.getState().setUser(
          updatedUser,
          useUserStore.getState().token || ""
        );

        Alert.alert("成功", "邮箱已更新", [
          {
            text: "确定",
            onPress: () => navigation.goBack()
          }
        ]);
      } else {
        Alert.alert("成功", "邮箱已更新");
        navigation.goBack();
      }
    } catch (error) {
      console.error('更换邮箱错误:', error);
      Alert.alert("错误", "更新失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>邮箱</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.label}>当前邮箱</Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={currentEmail}
            style={[styles.input, styles.disabledInput]}
            placeholder="未设置邮箱"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
          />
        </View>

        <Text style={styles.label}>新邮箱</Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            style={styles.input}
            placeholder="输入新邮箱"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          {newEmail.length > 0 && !isLoading && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setNewEmail("")}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.hint}>请输入有效的邮箱地址</Text>

        <TouchableOpacity 
          style={[
            styles.confirmButton,
            (isLoading || !newEmail.trim()) && styles.confirmButtonDisabled
          ]}
          onPress={handleConfirm}
          disabled={isLoading || !newEmail.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text style={styles.confirmButtonText}>确认更改</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8DC",
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
  placeholder: {
    width: scaleWidth(40),
  },

  /** CONTENT */
  content: {
    padding: scaleWidth(20),
  },
  label: {
    fontSize: scaleFont(14),
    color: "#666",
    marginBottom: scaleHeight(8),
    marginTop: scaleHeight(8),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(8),
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  input: {
    flex: 1,
    fontSize: scaleFont(16),
    color: "#333",
    paddingVertical: scaleHeight(12),
  },
  disabledInput: {
    color: "#999",
    backgroundColor: "#F5F5F5",
  },
  clearButton: {
    padding: scaleWidth(4),
  },
  hint: {
    fontSize: scaleFont(12),
    color: "#999",
    marginBottom: scaleHeight(20),
    marginLeft: scaleWidth(4),
  },
  confirmButton: {
    backgroundColor: "#F5C842",
    borderRadius: 25,
    paddingVertical: scaleHeight(14),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5B830",
    marginTop: scaleHeight(20),
  },
  confirmButtonDisabled: {
    backgroundColor: "#E5E5E5",
    borderColor: "#D0D0D0",
  },
  confirmButtonText: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
  },
});