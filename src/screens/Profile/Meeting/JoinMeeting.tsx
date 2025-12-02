import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  StatusBar
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

export default function JoinMeetingScreen() {
  const [meetingId, setMeetingId] = useState("");
  const [name, setName] = useState("");
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const navigation = useNavigation();

  return (
    <LinearGradient colors={["#fcd34d", "#fef3c7"]} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="#78350f" />
            </TouchableOpacity>
            <Text style={styles.title}>加入会议</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Meeting ID Section */}
            <View style={styles.section}>
              <Text style={styles.label}>会议号</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="请输入会议号"
                  placeholderTextColor="#d1d5db"
                  value={meetingId}
                  onChangeText={setMeetingId}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Name Section */}
            <View style={styles.section}>
              <Text style={styles.label}>您的名字</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="请输入您想显示的名字"
                  placeholderTextColor="#d1d5db"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Microphone Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>开启麦克风</Text>
              <Switch
                value={micEnabled}
                onValueChange={setMicEnabled}
                trackColor={{ false: "#d1d5db", true: "#86efac" }}
                thumbColor={micEnabled ? "#22c55e" : "#f3f4f6"}
                ios_backgroundColor="#d1d5db"
              />
            </View>

            {/* Camera Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>开启摄像器</Text>
              <Switch
                value={cameraEnabled}
                onValueChange={setCameraEnabled}
                trackColor={{ false: "#d1d5db", true: "#86efac" }}
                thumbColor={cameraEnabled ? "#22c55e" : "#f3f4f6"}
                ios_backgroundColor="#d1d5db"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton}>
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>加入会议</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 10,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 0,
    width: 36,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#78350f",
  },
  formContainer: {
    marginTop: 20,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    fontSize: 14,
    color: "#1f2937",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 25,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#78350f",
  },
  submitText: {
    color: "#78350f",
    fontSize: 16,
    fontWeight: "600",
  },
});