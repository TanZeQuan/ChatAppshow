import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { userId, name } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Profile</Text>

      <Text style={styles.label}>User ID:</Text>
      <Text style={styles.value}>{userId}</Text>

      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{name}</Text>

      <TouchableOpacity
        style={styles.chatBtn}
        onPress={() =>
          navigation.navigate("ChatRoom", {
            type: "single",
            targetUserId: userId,
            name: name,
          })
        }
      >
        <Text style={styles.chatText}>Start Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 25 },
  label: { fontSize: 16, marginTop: 10, color: "#555" },
  value: { fontSize: 18, marginBottom: 10 },
  chatBtn: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  chatText: { color: "white", fontSize: 17 },
});
