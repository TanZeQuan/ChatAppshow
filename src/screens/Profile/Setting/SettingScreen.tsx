import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
    Dimensions,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getOriginalTabBarStyle } from "../../../components/tabstyle";
import { ProfileStackParamList } from "../../../navigation/types";
import { borders, colors, typography } from "../../../styles";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

export default function SettingScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
    const [showSendButton, setShowSendButton] = useState(false);
    
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

    const SettingItem = ({
        title,
        showArrow = true,
        showSwitch = false,
    }: {
        title: string;
        showArrow?: boolean;
        showSwitch?: boolean;
    }) => (
        <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={showSwitch ? 1 : 0.6}
            onPress={() => {
                if (!showSwitch) {
                    if (title === "主页") navigation.navigate("EditProfile");
                    if (title === "修改密码")
                        navigation.navigate("ChangePassword");
                    if (title === "修改邮箱")
                        navigation.navigate("EditEmail");
                    if (title === "通知")
                        navigation.navigate("Notification");
                    if (title === "连接诊断")
                        navigation.navigate("ConnectionDiagnostic" as any);
                }
            }}
        >
            <Text style={styles.settingTitle}>{title}</Text>
            {showArrow && !showSwitch && (
                <Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </Text>
            )}
            {showSwitch && (
                <Switch value={showSendButton} onValueChange={setShowSendButton} />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>设置</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Content */}
            <SettingItem title="主页" />
            <SettingItem title="修改密码" />
            <SettingItem title="修改邮箱" />
            {/* <SettingItem title="通知" />
            <SettingItem title="连接诊断" />
            <SettingItem title='显示"发送"按钮' showSwitch /> */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.gradientYellow[0], // 原 #ffefb4ff
    },

    /** HEADER */
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: scaleWidth(16),
        paddingVertical: scaleHeight(12),
        borderBottomWidth: borders.width1,
        borderColor: colors.border.light, // 原 #ecececff
        backgroundColor: colors.functional.yellowBright, // 原 #ffe070ff
    },
    headerTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.blackMedium,
    },

    /** SETTING ITEM */
    settingItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: scaleWidth(20),
        paddingVertical: scaleHeight(15),
        backgroundColor: colors.background.white, // 原 #ffffff9c，可考虑透明度用 rgba(255,255,255,0.6)
        borderBottomWidth: borders.width1,
        borderColor: colors.border.lightGray, // 原 #eee
    },
    settingTitle: {
        fontSize: typography.fontSize16,
        color: colors.text.primary,
    },
});
