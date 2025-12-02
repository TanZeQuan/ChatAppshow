import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  StatusBar,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

export default function CreateMeetingScreen() {
  const [meetingName, setMeetingName] = useState("");
  const [startTime, setStartTime] = useState(new Date());
  const [duration, setDuration] = useState(30);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [password, setPassword] = useState(false);
  const navigation = useNavigation();

  // Format date and time for display
  const formatDateTime = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  };

  // Handle start time selection
  const selectStartTime = () => {
    Alert.alert(
      "选择开始时间",
      "请选择会议开始时间",
      [
        { 
          text: "现在", 
          onPress: () => setStartTime(new Date()) 
        },
        { 
          text: "1小时后", 
          onPress: () => {
            const newTime = new Date();
            newTime.setHours(newTime.getHours() + 1);
            setStartTime(newTime);
          }
        },
        { 
          text: "明天同一时间", 
          onPress: () => {
            const newTime = new Date();
            newTime.setDate(newTime.getDate() + 1);
            setStartTime(newTime);
          }
        },
        { text: "取消", style: "cancel" }
      ]
    );
  };

  // Handle duration selection
  const selectDuration = () => {
    Alert.alert(
      "选择会议时长",
      "",
      [
        { text: "15分钟", onPress: () => setDuration(15) },
        { text: "30分钟", onPress: () => setDuration(30) },
        { text: "45分钟", onPress: () => setDuration(45) },
        { text: "60分钟", onPress: () => setDuration(60) },
        { text: "90分钟", onPress: () => setDuration(90) },
        { text: "取消", style: "cancel" }
      ]
    );
  };

  // Handle audio setting selection
  const selectAudioSetting = () => {
    Alert.alert(
      "成员入会开启语音",
      "",
      [
        { text: "开启", onPress: () => setAudioEnabled(true) },
        { text: "关闭", onPress: () => setAudioEnabled(false) },
        { text: "取消", style: "cancel" }
      ]
    );
  };

  // Handle create meeting
  const handleCreateMeeting = () => {
    if (!meetingName.trim()) {
      Alert.alert("提示", "请输入会议名字");
      return;
    }

    // Here you would typically call your API to create the meeting
    Alert.alert(
      "会议创建成功",
      `会议名称: ${meetingName}\n开始时间: ${formatDateTime(startTime)}\n时长: ${duration}分钟\n入会密码: ${password ? "开启" : "关闭"}`,
      [
        {
          text: "确定",
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

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
            <Text style={styles.title}>创建会议</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Meeting Name Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="请输入会议名字"
                placeholderTextColor="#d1d5db"
                value={meetingName}
                onChangeText={setMeetingName}
              />
            </View>

            {/* Start Time */}
            <TouchableOpacity 
              style={styles.rowItem}
              onPress={selectStartTime}
            >
              <Text style={styles.rowLabel}>开始时间</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{formatDateTime(startTime)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Duration */}
            <TouchableOpacity 
              style={styles.rowItem}
              onPress={selectDuration}
            >
              <Text style={styles.rowLabel}>会议时长</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{duration}分钟</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Waiting Room */}
            <TouchableOpacity 
              style={styles.rowItem}
              onPress={selectAudioSetting}
            >
              <Text style={styles.rowLabel}>成员入会开启语音</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{audioEnabled ? "开启" : "关闭"}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Password Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>入会密码</Text>
              <Switch
                value={password}
                onValueChange={setPassword}
                trackColor={{ false: "#d1d5db", true: "#86efac" }}
                thumbColor={password ? "#22c55e" : "#f3f4f6"}
                ios_backgroundColor="#d1d5db"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateMeeting}
            >
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>完成</Text>
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
  inputContainer: {
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
  input: {
    fontSize: 14,
    color: "#1f2937",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 14,
    color: "#9ca3af",
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