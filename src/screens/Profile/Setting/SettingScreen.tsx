import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileStackParamList } from "../../../navigation/types";

export default function SettingScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
    const [showSendButton, setShowSendButton] = useState(false);

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
            <SettingItem title="通知" />
            <SettingItem title='显示“发送”按钮' showSwitch />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ffefb4ff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: "#ecececff",
        backgroundColor: "#ffe070ff",
    },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
    settingItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: "#ffffff9c",
        borderBottomWidth: 1,
        borderColor: "#eee",
    },
    settingTitle: { fontSize: 16, color: "#232323" },
});
