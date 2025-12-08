import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Dimensions, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, borders, typography } from "../../../styles";
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
    backgroundColor: colors.background.yellowPale, // 原 #FFF8DC
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, // scaleWidth(16)
    paddingVertical: 12, // scaleHeight(12)
    backgroundColor: colors.functional.yellow, // 原 #F5C842
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.functional.yellowBright, // 原 #E5B830
  },
  backButton: {
    padding: 8, // scaleWidth(8)
  },
  headerTitle: {
    fontSize: typography.fontSize18, // scaleFont(18)
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium, // 原 #333
  },
  placeholder: {
    width: 40, // scaleWidth(40)
  },

  /** CONTENT */
  content: {
    paddingTop: 8, // scaleHeight(8)
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.white,
    paddingHorizontal: 20, // scaleWidth(20)
    paddingVertical: 16, // scaleHeight(16)
    marginBottom: 1, // scaleHeight(1)
  },
  settingLabel: {
    fontSize: typography.fontSize16, // scaleFont(16)
    fontWeight: typography.fontWeight400,
    color: colors.text.blackMedium, // 原 #333
  },
});