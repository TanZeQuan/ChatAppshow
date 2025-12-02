import { Dimensions } from "react-native";

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
