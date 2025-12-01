import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function AddFriendScreen() {
  const [searchId, setSearchId] = useState("");

  const handleAdd = () => {
    console.log("Searching:", searchId);
    // TODO: 调用你的 API: searchUser(searchId)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Friend</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter user ID"
        value={searchId}
        onChangeText={setSearchId}
      />

      <TouchableOpacity style={styles.btn} onPress={handleAdd}>
        <Text style={styles.btnText}>Search</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    borderColor: "#ccc",
  },
  btn: {
    backgroundColor: "#007AFF",
    padding: 15,
    alignItems: "center",
    borderRadius: 8,
  },
  btnText: { color: "white", fontSize: 16 },
});
