import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "EditEmail">;

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function EditEmailScreen({ navigation }: Props) {
  const [currentEmail, setCurrentEmail] = useState("user@example.com");
  const [newEmail, setNewEmail] = useState("");

  const handleConfirm = () => {
    // Handle save logic here
    if (!newEmail) {
      alert("请输入新邮箱");
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>邮箱</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.label}>当前邮箱</Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={currentEmail}
            onChangeText={setCurrentEmail}
            style={styles.input}
            placeholder="当前邮箱"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
          />
        </View>

        <Text style={styles.label}>新邮箱</Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            style={styles.input}
            placeholder="输入新邮箱"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {newEmail.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setNewEmail("")}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.confirmButton}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>确认更改</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8DC",
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: "#F5C842",
    borderBottomWidth: 1,
    borderBottomColor: "#E5B830",
  },
  backButton: {
    padding: scaleWidth(8),
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: "600",
    color: "#333",
  },
  placeholder: {
    width: scaleWidth(40),
  },

  /** CONTENT */
  content: {
    padding: scaleWidth(20),
  },
  label: {
    fontSize: scaleFont(14),
    color: "#666",
    marginBottom: scaleHeight(8),
    marginTop: scaleHeight(8),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(16),
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  input: {
    flex: 1,
    fontSize: scaleFont(16),
    color: "#333",
    paddingVertical: scaleHeight(12),
  },
  clearButton: {
    padding: scaleWidth(4),
  },
  confirmButton: {
    backgroundColor: "#F5C842",
    borderRadius: 25,
    paddingVertical: scaleHeight(14),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5B830",
    marginTop: scaleHeight(20),
  },
  confirmButtonText: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
  },
});