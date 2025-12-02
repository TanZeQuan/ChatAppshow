import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function ProfileScreen() {
  const navigation = useNavigation();

  const avatar =
    "https://img.freepik.com/free-photo/anime-character-celebrating-christmas_23-2150970289.jpg?semt=ais_hybrid&w=740&q=80";

  const username = "Mym";
  const phone = "+6011*****90";
  const accountId = "123456";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>主页</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* List */}
      <View style={styles.listBox}>
        {/* Avatar */}
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowLabel}>头像</Text>
          <View style={styles.rightContent}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
          </View>
        </TouchableOpacity>

        {/* Name */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate("EditName" as never)}
        >
          <Text style={styles.rowLabel}>名字</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{username}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </TouchableOpacity>

        {/* Phone */}
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowLabel}>手机号码</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{phone}</Text>
          </View>
        </TouchableOpacity>

        {/* Account ID */}
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowLabel}>账号ID</Text>
          <View style={styles.rightContent}>
            <Text style={styles.value}>{accountId}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffefb4ff",
  },

  header: {
    height: 50,
    backgroundColor: "#ffe070ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  listBox: {
    backgroundColor: "#fff6d8c5",
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    height: 60,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
    justifyContent: "space-between",
  },

  rowLabel: {
    fontSize: 15,
    color: "#333",
  },

  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  value: {
    fontSize: 15,
    color: "#777",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 18,
  },
});
