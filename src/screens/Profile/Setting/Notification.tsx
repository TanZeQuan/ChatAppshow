import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Dimensions, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "Notification">;

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function NotificationSettingsScreen({ navigation }: Props) {
  const [messageNotification, setMessageNotification] = useState(false);
  const [voiceNotification, setVoiceNotification] = useState(true);
  const [videoNotification, setVideoNotification] = useState(false);

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
        <Text style={styles.headerTitle}>通知</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Message Notification */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>信息通知</Text>
          <Switch
            value={messageNotification}
            onValueChange={setMessageNotification}
            trackColor={{ false: "#D1D1D6", true: "#34C759" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
          />
        </View>

        {/* Voice Notification */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>语音通知</Text>
          <Switch
            value={voiceNotification}
            onValueChange={setVoiceNotification}
            trackColor={{ false: "#D1D1D6", true: "#34C759" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
          />
        </View>

        {/* Video Notification */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>视频通知</Text>
          <Switch
            value={videoNotification}
            onValueChange={setVideoNotification}
            trackColor={{ false: "#D1D1D6", true: "#34C759" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
          />
        </View>
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
    paddingTop: scaleHeight(8),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    marginBottom: scaleHeight(1),
  },
  settingLabel: {
    fontSize: scaleFont(16),
    color: "#333",
    fontWeight: "400",
  },
});