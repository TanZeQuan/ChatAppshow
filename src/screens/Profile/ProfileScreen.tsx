import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useUserStore } from "../../store/userStore"; // your zustand store

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useUserStore(); // get user and logout action

  if (!user) return null; // in case user is null

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: user.avatar || "https://i.pravatar.cc/150" }} style={styles.avatar} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Options */}
      <View style={styles.card}>
        <Option text="Change Password" onPress={() => navigation.navigate("ChangePassword")} />
        <Option
          text="Log Out"
          onPress={() => {
            logout(); // clear user & token from zustand
            navigation.reset({
              index: 0,
              routes: [{ name: "Auth" }],
            });
          }}
          color="red"
        />
      </View>
    </ScrollView>
  );
}

function Option({ text, onPress, color = "#000" }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.option}>
      <Text style={[styles.optionText, { color }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  header: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "600",
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    marginBottom: 18,
  },
  editBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#2F80ED",
    borderRadius: 20,
  },
  editBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  option: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: {
    fontSize: 16,
  },
});
