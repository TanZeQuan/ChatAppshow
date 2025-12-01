import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function ContactsScreen() {
  const navigation = useNavigation();

  // 假数据，你之后换成 API 数据（好友列表）
  const contacts = [
    { id: "101", name: "Mary" },
    { id: "102", name: "John" },
    { id: "103", name: "Alex" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contacts</Text>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              navigation.navigate("ChatRoom", {
                type: "single",
                targetUserId: item.id,
                name: item.name,
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddFriend")}
      >
        <Text style={styles.addText}>+ Add Friend</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  item: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  name: { fontSize: 18 },
  addButton: {
    marginTop: 25,
    padding: 15,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  addText: { color: "white", fontSize: 16 },
});
