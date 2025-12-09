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
import { colors, borders, typography } from "../../../styles";
import { useUserStore } from '../../../store/userStore';
import { updateUserInfo } from '../../../api/User';

type Props = NativeStackScreenProps<ProfileStackParamList, "EditName">;

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function EditNameScreen({ navigation }: Props) {
  const { user } = useUserStore();
  const [name, setName] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Set initial name from store
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  const handleConfirm = async () => {
    if (!user?.id) {
      Alert.alert("错误", "用户信息不存在");
      return;
    }

    if (!name.trim()) {
      Alert.alert("错误", "名字不能为空");
      return;
    }

    if (name.trim() === user.name) {
      // No changes, just go back
      navigation.goBack();
      return;
    }

    setIsLoading(true);

    try {
      console.log('更新用户名 - user_id:', user.id, 'new name:', name.trim());

      // Update user info
      const res = await updateUserInfo(user.id, {
        name: name.trim(),
      });

      console.log('updateUserInfo 返回:', res);

      if (res.success) {
        // Just update the name in store, ProfileScreen will fetch complete data
        const updatedUser = {
          ...user,
          name: name.trim(),
        };

        console.log('更新 store:', updatedUser);

        useUserStore.getState().setUser(
          updatedUser,
          useUserStore.getState().token || ""
        );

        Alert.alert("成功", "名字已更新", [
          {
            text: "确定",
            onPress: () => navigation.goBack()
          }
        ]);
      } else {
        Alert.alert("失败", res.message || "更新失败，请重试");
      }
    } catch (error) {
      console.error('更新名字错误:', error);
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
        <Text style={styles.headerTitle}>名字</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="输入名字"
            placeholderTextColor="#999"
            editable={!isLoading}
            maxLength={50}
          />
          {name.length > 0 && !isLoading && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setName("")}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.hint}>名字长度不超过50个字符</Text>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (isLoading || !name.trim()) && styles.confirmButtonDisabled
          ]}
          onPress={handleConfirm}
          disabled={isLoading || !name.trim()}
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
    backgroundColor: colors.background.gradientYellow[0], // 原 #FFF8DC
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(8),
    backgroundColor: colors.background.yellowBright, 
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.functional.yellowBright,
  },
  backButton: {
    padding: scaleWidth(8),
  },
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium, // 原 #333
  },
  placeholder: {
    width: scaleWidth(40),
  },

  /** CONTENT */
  content: {
    padding: scaleWidth(20),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.white, // 原 #FFFFFF
    borderRadius: borders.radius10,
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(8),
    borderWidth: borders.width1,
    borderColor: colors.border.lightGray, // 原 #E5E5E5
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize16,
    color: colors.text.blackMedium, // 原 #333
    paddingVertical: scaleHeight(12),
  },
  clearButton: {
    padding: scaleWidth(4),
  },
  hint: {
    fontSize: typography.fontSize12,
    color: colors.text.grayLight, // 原 #999
    marginBottom: scaleHeight(20),
    marginLeft: scaleWidth(4),
  },
  confirmButton: {
    backgroundColor: colors.background.yellowBright, // 原 #F5C842
    borderRadius: borders.radius25,
    paddingVertical: scaleHeight(12),
    alignItems: "center",
    borderWidth: borders.width1,
    borderColor: colors.functional.yellowBright, // 原 #E5B830
  },
  confirmButtonDisabled: {
    backgroundColor: colors.background.grayLight, // 原 #E5E5E5
    borderColor: colors.border.grayMedium, // 原 #D0D0D0
  },
  confirmButtonText: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium, // 原 #333
  },
});