import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors, borders, typography } from "../../../styles";
import { LinearGradient } from "expo-linear-gradient";
import { getOriginalTabBarStyle } from "../../../components/tabstyle";

interface MeetingItemProps {
  icon: string;
  label: string;
  onPress: () => void;
}

const MeetingItem: React.FC<MeetingItemProps> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.itemLeft}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={20} color="#fff" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
  </TouchableOpacity>
);

export default function MeetingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar when screen is focused
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });

      // Show tab bar when leaving the screen with ORIGINAL STYLE
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: getOriginalTabBarStyle(insets) // Restore your custom yellow style
        });
      };
    }, [navigation, insets])
  );

  return (
    <LinearGradient colors={["#fcd34d", "#fef3c7"]} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#78350f" />
          </TouchableOpacity>
          <Text style={styles.title}>会议</Text>
        </View>

        {/* Meeting Options */}
        <View style={styles.content}>
          <MeetingItem
            icon="enter-outline"
            label="加入会议"
            onPress={() => navigation.navigate("JoinMeeting" as never)}
          />

          <MeetingItem
            icon="videocam-outline"
            label="创建会议"
            onPress={() => navigation.navigate("CreateMeeting" as never)}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grayLight,
  },
  safeArea: {
    flex: 1,
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 10,
    position: "relative",
    paddingHorizontal: 20,
  },
  backButton: {
    position: "absolute",
    left: 20,
    width: 36,
    height: 36,
    backgroundColor: colors.background.transparentWhite50,
    borderRadius: borders.radius18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize20,
    fontWeight: typography.fontWeight600,
    color: colors.text.dark,
  },

  /** CONTENT */
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },

  /** ITEM */
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borders.radius18,
    backgroundColor: colors.text.grayDark,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.fontSize15,
    color: colors.text.dark,
    fontWeight: typography.fontWeight500,
  },
});