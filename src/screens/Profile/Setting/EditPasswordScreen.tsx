import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileStackParamList } from "../../../navigation/types";
import { borders, colors, typography } from "../../../styles";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

type Props = NativeStackScreenProps<ProfileStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  return (
    <View style={styles.safeArea}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#FFD860', '#FFD860']}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>修改密码</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* 内容区 */}
      <View style={styles.container}>
        <Text style={styles.label}>当前密码</Text>
        <TextInput
          secureTextEntry
          value={oldPwd}
          onChangeText={setOldPwd}
          style={styles.input}
          placeholder="请输入当前密码"
        />

        <Text style={styles.label}>新密码</Text>
        <TextInput
          secureTextEntry
          value={newPwd}
          onChangeText={setNewPwd}
          style={styles.input}
          placeholder="请输入新密码"
        />

        <Text style={styles.label}>确认密码</Text>
        <TextInput
          secureTextEntry
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          style={styles.input}
          placeholder="请确认新密码"
        />

        <TouchableOpacity style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>更新密码</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0], // 原 #ffefb4ff
  },
  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(5),
    paddingBottom: scaleHeight(5),
  },
  backButton: {
    padding: scaleWidth(8),
  },
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    textAlign: 'center',
    color: colors.text.black,
    flex: 1,
  },
  placeholder: {
    width: 24,
  },

  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background.yellowPale, // 可选，更统一
  },

  label: {
    fontSize: typography.fontSize14,
    color: colors.text.darkGray, // 原 #555
    marginTop: 20,
    marginBottom: 4,
  },

  input: {
    backgroundColor: colors.background.white,
    padding: 12,
    borderRadius: borders.radius10,
    fontSize: typography.fontSize16,
    color: colors.text.blackMedium,
  },

  saveBtn: {
    marginTop: 40,
    backgroundColor: colors.background.yellowBright,
    paddingVertical: 12,
    borderRadius: borders.radius25,
    alignItems: "center",
    borderWidth: borders.width1,
    borderColor: colors.functional.yellowBright,
  },

  saveBtnText: {
    color: colors.text.blackMedium,
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
  },
});
