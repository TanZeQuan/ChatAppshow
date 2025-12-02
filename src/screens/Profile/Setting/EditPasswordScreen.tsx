import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  safeArea: { flex: 1, backgroundColor: "#ffefb4ff"},
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#ffe070ff",
    backgroundColor: "#ffe070ff",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
  container: { flex: 1, padding: 20 },
  label: {
    fontSize: 14,
    color: "#555",
    marginTop: 20,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#ffffffff",
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  saveBtn: {
    marginTop: 40,
    backgroundColor: "#f8b116ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
