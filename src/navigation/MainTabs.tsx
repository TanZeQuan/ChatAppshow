import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
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
      iconSize: 28,
      tabBarHeight: 70,
      paddingBottom: 12,
      paddingTop: 12,
      fontSize: 14,
    };
  } else if (isMediumDevice) {
    return {
      iconSize: 26,
      tabBarHeight: 60,
      paddingBottom: 8,
      paddingTop: 4,
      fontSize: 12,
    };
  } else {
    return {
      iconSize: 22,
      tabBarHeight: 55,
      paddingBottom: 6,
      paddingTop: 6,
      fontSize: 11,
    };
  }
};

const responsiveSizes = getResponsiveSize();

// ⭐ 导出原始 tabBar style（让子页面恢复时不变形）
export const getOriginalTabBarStyle = (insets: any) => ({
  backgroundColor: "#FFD860",
  borderTopWidth: 0,
  height: responsiveSizes.tabBarHeight + insets.bottom,
  paddingBottom: Math.max(insets.bottom, responsiveSizes.paddingBottom),
  paddingTop: responsiveSizes.paddingTop,
  paddingHorizontal: isTablet ? 20 : 0,
  elevation: 0,
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

          return (
            <Ionicons
              name={iconName}
              size={responsiveSizes.iconSize}
              color={color}
            />
          );
        },

        tabBarActiveTintColor: "#0c0c0cff",
        tabBarInactiveTintColor: "#8E8E93",

        // ⭐ 使用原始 TabBar style
        tabBarStyle: originalTabBarStyle,

        tabBarLabelStyle: {
          fontSize: responsiveSizes.fontSize,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tab.Screen
        name="ChatStack"
        component={ChatStack}
        options={{ title: "消息" }}
      />
      <Tab.Screen
        name="ContactsStack"
        component={ContactsStack}
        options={{ title: "好友" }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{ title: "我的" }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabs() {
  return <MainTabsContent />;
}
