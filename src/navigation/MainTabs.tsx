import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "./types";

import ChatStack from "./stacks/ChatStack";
import ContactsStack from "./stacks/ContactStack";
import ProfileStack from "./stacks/ProfileStack";

import WebSocketManager from "../services/WebSocketManager";
import { useUserStore } from "../store/userStore";

const Tab = createBottomTabNavigator<MainTabParamList>();

// 动态获取设备类型
const getDeviceType = (width: number) => {
  if (width >= 768) return "tablet";
  if (width >= 375) return "medium";
  return "small";
};

// 根据设备类型获取响应式尺寸
const getResponsiveSizes = (deviceType: string) => {
  switch (deviceType) {
    case "tablet":
      return {
        iconSize: 32,
        tabBarHeight: 70,
        paddingBottom: 8,
        paddingTop: 16,
        fontSize: 14,
        borderRadius: 28,
        paddingHorizontal: 20,
      };
    case "medium":
      return {
        iconSize: 30,
        tabBarHeight: 60,
        paddingBottom: 4,
        paddingTop: 8,
        fontSize: 12,
        borderRadius: 22,
        paddingHorizontal: 10,
      };
    default: // small
      return {
        iconSize: 26,
        tabBarHeight: 55,
        paddingBottom: 2,
        paddingTop: 10,
        fontSize: 11,
        borderRadius: 20,
        paddingHorizontal: 0,
      };
  }
};

// 动态计算响应式配置
const getResponsiveConfig = () => {
  const { width } = Dimensions.get("window");
  const deviceType = getDeviceType(width);
  return getResponsiveSizes(deviceType);
};

/** ⭐ 原始 TabBar Style（含顶部左右圆角） */
export const getOriginalTabBarStyle = (insets: any): ViewStyle => {
  const config = getResponsiveConfig();
  
  return {
    backgroundColor: "#FFD860",
    borderTopWidth: 0,
    height: config.tabBarHeight + insets.bottom,
    paddingBottom: Math.max(insets.bottom, config.paddingBottom),
    paddingTop: config.paddingTop,
    paddingHorizontal: config.paddingHorizontal,
    elevation: 0,

    // ⭐ 新增：顶部左右圆角 + 悬浮生效
    borderTopLeftRadius: config.borderRadius,
    borderTopRightRadius: config.borderRadius,
    overflow: "hidden" as const,
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,

    // iOS 阴影效果
    ...(Platform.OS === "ios" && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  };
};

function MainTabsContent() {
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  // 监听屏幕尺寸变化（方向变化、折叠屏等）
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  // 动态获取当前配置
  const config = getResponsiveConfig();
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
              size={config.iconSize} 
              color={color} 
            />
          );
        },

        tabBarActiveTintColor: "#0c0c0cff",
        tabBarInactiveTintColor: "#8E8E93",

        // ⭐ 使用带圆角的 Tab Bar Style
        tabBarStyle: originalTabBarStyle,

        tabBarLabelStyle: {
          fontSize: config.fontSize,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingTop: -4, // ⭐ 图标 + 文字整体往上移
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
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    // 当 MainTabs 加载时，自动连接 WebSocket
    if (user?.id) {
      console.log('🔌 MainTabs: Initializing WebSocket connection for user:', user.id);

      WebSocketManager.connect(user.id)
        .then(() => {
          console.log('✅ MainTabs: WebSocket connected successfully');
        })
        .catch((error) => {
          console.error('❌ MainTabs: WebSocket connection failed:', error);
        });
    }

    // 组件卸载时断开连接（用户登出时）
    return () => {
      if (user?.id) {
        console.log('🔌 MainTabs: Disconnecting WebSocket');
        WebSocketManager.disconnect();
      }
    };
  }, [user?.id]);

  return <MainTabsContent />;
}