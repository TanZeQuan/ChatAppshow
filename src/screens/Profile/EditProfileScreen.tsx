import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from "react-native";

export default function EditProfileScreen() {
  const [name, setName] = useState("ZeQuan");
  const [email, setEmail] = useState("example@gmail.com");

  return (
    <View style={styles.container}>
      <View style={styles.avatarBox}>
        <Image
          source={{ uri: "https://i.pravatar.cc/150" }}
          style={styles.avatar}
        />
        <TouchableOpacity>
          <Text style={styles.changeAvatar}>Change Avatar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholder="Enter name"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="Enter email"
      />

      <TouchableOpacity style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Save</Text>
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
  avatarBox: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  changeAvatar: {
    marginTop: 10,
    color: "#2F80ED",
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginTop: 15,
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
