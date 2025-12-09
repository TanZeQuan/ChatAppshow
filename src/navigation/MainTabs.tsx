import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "./types";

import ChatStack from "./stacks/ChatStack";
import ContactsStack from "./stacks/ContactStack";
import ProfileStack from "./stacks/ProfileStack";

const Tab = createBottomTabNavigator<MainTabParamList>();

const { width } = Dimensions.get("window");

const isMediumDevice = width >= 375 && width < 768;
const isTablet = width >= 768;

const getResponsiveSize = () => {
  if (isTablet) {
    return {
      iconSize: 32,
      tabBarHeight: 70,
      paddingBottom: 8,
      paddingTop: 16,
      fontSize: 14,
    };
  } else if (isMediumDevice) {
    return {
      iconSize: 30,
      tabBarHeight: 60,
      paddingBottom: 4,
      paddingTop: 8,
      fontSize: 12,
    };
  } else {
    return {
      iconSize: 26,
      tabBarHeight: 55,
      paddingBottom: 2,
      paddingTop: 10,
      fontSize: 11,
    };
  }
};

const responsiveSizes = getResponsiveSize();

/** ⭐ 原始 TabBar Style（含顶部左右圆角） */
export const getOriginalTabBarStyle = (insets: any): ViewStyle => ({
  backgroundColor: "#FFD860",
  borderTopWidth: 0,
  height: responsiveSizes.tabBarHeight + insets.bottom,
  paddingBottom: Math.max(insets.bottom, responsiveSizes.paddingBottom),
  paddingTop: responsiveSizes.paddingTop,
  paddingHorizontal: isTablet ? 20 : 0,
  elevation: 0,

  // ⭐ 新增：顶部左右圆角 + 悬浮生效
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  overflow: "hidden" as const,         // 必须，不然圆角不显示
  position: "absolute" as const,       // 必须，不然圆角被父容器裁掉
  left: 0,
  right: 0,
  bottom: 0,
});

function MainTabsContent() {
  const insets = useSafeAreaInsets();
  const originalTabBarStyle = getOriginalTabBarStyle(insets);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "ChatStack") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "ContactsStack") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "ProfileStack") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={responsiveSizes.iconSize} color={color} />;
        },

        tabBarActiveTintColor: "#0c0c0cff",
        tabBarInactiveTintColor: "#8E8E93",

        // ⭐ 使用带圆角的 Tab Bar Style
        tabBarStyle: originalTabBarStyle,

        tabBarLabelStyle: {
          fontSize: responsiveSizes.fontSize,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingTop: -4,     // ⭐ 图标 + 文字整体往上移
        },
      })}
    >
      <Tab.Screen name="ChatStack" component={ChatStack} options={{ title: "消息" }} />
      <Tab.Screen name="ContactsStack" component={ContactsStack} options={{ title: "好友" }} />
      <Tab.Screen name="ProfileStack" component={ProfileStack} options={{ title: "我的" }} />
    </Tab.Navigator>
  );
}

export default function MainTabs() {
  return <MainTabsContent />;
}
