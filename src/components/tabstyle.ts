import React from "react";
import { Dimensions, Platform } from "react-native";

// Helper function to get current dimensions
const getCurrentDimensions = () => {
  const { width, height } = Dimensions.get("window");
  return { width, height };
};

// Determine device type based on width
const getDeviceType = (width: number) => {
  if (width >= 768) return "tablet";
  if (width >= 375) return "medium";
  return "small";
};

// Get responsive sizes based on device type
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

// Calculate responsive values dynamically
export const getResponsiveTabBarConfig = () => {
  const { width } = getCurrentDimensions();
  const deviceType = getDeviceType(width);
  return getResponsiveSizes(deviceType);
};

// TabBar style generator (recalculates on each call)
export const getOriginalTabBarStyle = (insets: any) => {
  const config = getResponsiveTabBarConfig();
  
  return {
    backgroundColor: "#FFD860",
    borderTopWidth: 0,
    height: config.tabBarHeight + insets.bottom,
    paddingBottom: Math.max(insets.bottom, config.paddingBottom),
    paddingTop: config.paddingTop,
    paddingHorizontal: config.paddingHorizontal,
    elevation: 0,

    // Rounded top corners
    borderTopLeftRadius: config.borderRadius,
    borderTopRightRadius: config.borderRadius,
    overflow: "hidden",

    // Positioning
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,

    // Shadow for iOS
    ...(Platform.OS === "ios" && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  };
};

// Get icon size dynamically
export const getTabBarIconSize = () => {
  const config = getResponsiveTabBarConfig();
  return config.iconSize;
};

// Get font size dynamically
export const getTabBarFontSize = () => {
  const config = getResponsiveTabBarConfig();
  return config.fontSize;
};

// Hook for responsive updates (optional - use in your component)
export const useResponsiveTabBar = () => {
  const [dimensions, setDimensions] = React.useState(getCurrentDimensions());

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  return getResponsiveTabBarConfig();
};

// For backwards compatibility - static export
// Note: This won't update on orientation changes
export const tabBarIconSize = getTabBarIconSize();