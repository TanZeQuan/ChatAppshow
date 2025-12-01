import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";

export default function ChangePasswordScreen() {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current Password</Text>
      <TextInput
        secureTextEntry
        value={oldPwd}
        onChangeText={setOldPwd}
        style={styles.input}
        placeholder="Enter current password"
      />

      <Text style={styles.label}>New Password</Text>
      <TextInput
        secureTextEntry
        value={newPwd}
        onChangeText={setNewPwd}
        style={styles.input}
        placeholder="Enter new password"
      />

      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        secureTextEntry
        value={confirmPwd}
        onChangeText={setConfirmPwd}
        style={styles.input}
        placeholder="Confirm new password"
      />

      <TouchableOpacity style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Update Password</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginTop: 20,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F2F4F7",
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  saveBtn: {
    marginTop: 40,
    backgroundColor: "#2F80ED",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
