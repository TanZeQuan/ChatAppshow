import { Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const isMediumDevice = width >= 375 && width < 768;
const isTablet = width >= 768;

const getResponsiveSize = () => {
  if (isTablet) {
    return {
      iconSize: 32,        // Increased from 28
      tabBarHeight: 70,
      paddingBottom: 8,    // Reduced from 12
      paddingTop: 16,      // Increased from 12
      fontSize: 14,
    };
  } else if (isMediumDevice) {
    return {
      iconSize: 30,        // Increased from 26
      tabBarHeight: 60,
      paddingBottom: 4,    // Reduced from 8
      paddingTop: 8,       // Increased from 4
      fontSize: 12,
    };
  } else {
    return {
      iconSize: 26,        // Increased from 22
      tabBarHeight: 55,
      paddingBottom: 2,    // Reduced from 6
      paddingTop: 10,      // Increased from 6
      fontSize: 11,
    };
  }
};

const responsiveSizes = getResponsiveSize();

// ⭐ 只导出 tab bar 样式
export const getOriginalTabBarStyle = (insets: any) => ({
  backgroundColor: "#FFD860",
  borderTopWidth: 0,
  height: responsiveSizes.tabBarHeight + insets.bottom,
  paddingBottom: Math.max(insets.bottom, responsiveSizes.paddingBottom),
  paddingTop: responsiveSizes.paddingTop,
  paddingHorizontal: isTablet ? 20 : 0,
  elevation: 0,
});

// Export iconSize for use in tab bar icons
export const tabBarIconSize = responsiveSizes.iconSize;