import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors, borders, typography } from "../../styles";
import { LinearGradient } from "expo-linear-gradient";
import { getOriginalTabBarStyle } from "../../components/tabstyle";

export default function JoinGroupScreen() {
  const navigation = useNavigation<any>(); // Added <any> for TS flexibility or use specific type
  const [searchText, setSearchText] = useState("");
  const insets = useSafeAreaInsets();

  const handleScanGroupCard = () => {
    // ✅ Navigate to QR Scanner Screen
    // Ensure 'QRCodeScreen' is registered in your Navigation Stack
   navigation.navigate('ScanGroupScreen');
  };

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
    <LinearGradient colors={["#FFEFB0", "#FFF9E5"]} style={styles.container}>
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
            <Text style={styles.title}>加入群聊</Text>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索ID"
              placeholderTextColor="#d1d5db"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Action Items */}
          <View style={styles.actionsContainer}>
            {/* Scan Group Card */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleScanGroupCard}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.iconContainer, { backgroundColor: "#fbbf24" }]}>
                  <Ionicons name="scan" size={22} color="#78350f" />
                </View>
                <Text style={styles.actionLabel}>扫描群名片</Text>
              </View>
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
    backgroundColor: colors.background.grayPale, // 替代默认白色
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20, // 可用 scaleWidth(20)
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20, // scaleHeight(20)
    marginTop: 10,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 0,
    width: 36,
    height: 36,
    backgroundColor: colors.background.transparentWhite50,
    borderRadius: borders.radius50 / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black, // 替代 #78350f
  },

  /** SEARCH */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingHorizontal: 16, // scaleWidth(16)
    paddingVertical: 12, // scaleHeight(12)
    marginTop: 10,
    marginBottom: 20,
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
    color: colors.text.grayLight,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize14,
    color: colors.text.dark,
  },

  /** ACTIONS */
  actionsContainer: {
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borders.radius50 / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.iconBg,
  },
  actionLabel: {
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight500,
    color: colors.text.dark,
  },
});