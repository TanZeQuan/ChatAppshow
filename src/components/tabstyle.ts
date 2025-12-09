import { Dimensions } from "react-native";

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

// ⭐ TabBar 样式（新增顶部左右圆角）
export const getOriginalTabBarStyle = (insets: any) => ({
  backgroundColor: "#FFD860",
  borderTopWidth: 0,
  height: responsiveSizes.tabBarHeight + insets.bottom,
  paddingBottom: Math.max(insets.bottom, responsiveSizes.paddingBottom),
  paddingTop: responsiveSizes.paddingTop,
  paddingHorizontal: isTablet ? 20 : 0,
  elevation: 0,

  // ⭐ 顶部左右圆角
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  overflow: "hidden",

  // ⭐ 必须：让圆角生效
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
});

// Export iconSize for use in tab bar icons
export const tabBarIconSize = responsiveSizes.iconSize;
