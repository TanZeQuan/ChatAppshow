import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, borders, typography } from "../../../styles";
import { ProfileStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#232323" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>修改密码</Text>
        <View style={{ width: 24 }} />
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
   safeArea: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0], // 原 #ffefb4ff
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: borders.width1,
    borderColor: colors.functional.yellowBright, // 原 #ffe070ff
    backgroundColor: colors.functional.yellowBright, // 原 #ffe070ff
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
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
    backgroundColor: colors.functional.yellow, // 原 #f8b116ff
    paddingVertical: 14,
    borderRadius: borders.radius10,
    alignItems: "center",
  },

  saveBtnText: {
    color: colors.text.white,
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
  },
});
