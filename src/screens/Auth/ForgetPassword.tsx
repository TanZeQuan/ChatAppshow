import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    StatusBar,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, borders, typography } from "../../styles";
import { sendOtpForPasswordReset, verifyOtpCode, resetPassword } from '../../api/UserForget'; // 引入你的 api 文件

export default function ForgetPasswordScreen() {
    const navigation = useNavigation();
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // 发送验证码
    const handleSendOtp = async () => {
        if (!phone) {
            Alert.alert('提示', '请输入手机号码');
            return;
        }
        setSendingCode(true);
        try {
            const res = await sendOtpForPasswordReset(phone);
            if (res.success) {
                Alert.alert('成功', res.message || '验证码已发送');
            } else {
                Alert.alert('失败', res.message || '发送失败');
            }
        } catch (err: any) {
            Alert.alert('错误', err.message || '发送失败');
        } finally {
            setSendingCode(false);
        }
    };

    // 提交重置密码
    const handleSubmit = async () => {
        if (!phone || !verificationCode || !password || !confirmPassword) {
            Alert.alert('提示', '请完整填写信息');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('提示', '两次密码输入不一致');
            return;
        }

        setSubmitting(true);
        try {
            // 验证 OTP
            const verifyRes = await verifyOtpCode(phone, verificationCode);
            if (!verifyRes.success || !verifyRes.data?.user_id) {
                Alert.alert('提示', verifyRes.message || '验证码错误');
                return;
            }

            // 重置密码
            const resetRes = await resetPassword(verifyRes.data.user_id, password);
            if (resetRes.success) {
                Alert.alert('成功', resetRes.message || '密码重置成功', [
                    { text: '确定', onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert('失败', resetRes.message || '密码重置失败');
            }
        } catch (err: any) {
            Alert.alert('错误', err.message || '操作失败，请重试');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <LinearGradient
            colors={['#FFE194', '#FFF9E5', '#FFFFFF']}
            style={styles.container}
        >
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
                            <Ionicons name="arrow-back" size={20} color="#020202ff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>找回密码</Text>
                    </View>

                    {/* Form Container */}
                    <View style={styles.formContainer}>
                        {/* Phone Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入手机号码"
                                placeholderTextColor="#d1d5db"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>

                        {/* Verification Code Input */}
                        <View style={styles.inputRow}>
                            <View style={[styles.inputContainer, styles.codeInput]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="请输入短信验证码"
                                    placeholderTextColor="#d1d5db"
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    keyboardType="number-pad"
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.sendCodeButton}
                                onPress={handleSendOtp}
                                disabled={sendingCode}
                            >
                                <Text style={styles.sendCodeText}>
                                    {sendingCode ? '发送中...' : '发送验证码'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入密码"
                                placeholderTextColor="#d1d5db"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="#9ca3af"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Confirm Password Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="请确认密码"
                                placeholderTextColor="#d1d5db"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Ionicons
                                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="#9ca3af"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            <LinearGradient
                                colors={['#FFFFFF', '#F8F8F8']}
                                style={styles.submitGradient}
                            >
                                <Text style={styles.submitText}>
                                    {submitting ? '提交中...' : '提交'}
                                </Text>
                            </LinearGradient>
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
        backgroundColor: colors.background.white,
    },

    safeArea: {
        flex: 1,
    },

    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        marginTop: 10,
        position: 'relative',
    },

    backButton: {
        position: 'absolute',
        left: 0,
        width: 36,
        height: 36,
        backgroundColor: colors.background.transparentWhite50,
        borderRadius: borders.radius18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    title: {
        fontSize: typography.fontSize20,
        fontWeight: typography.fontWeight600,
        color: colors.text.black,
    },

    // Form Container
    formContainer: {
        marginTop: 20,
    },

    inputContainer: {
        backgroundColor: colors.background.white,
        borderRadius: borders.radius20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',

        // shadow
        shadowColor: colors.shadow.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    input: {
        flex: 1,
        fontSize: typography.fontSize14,
        color: colors.text.dark,
    },

    eyeIcon: {
        padding: 2,
    },

    // Verification Code Row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },

    codeInput: {
        flex: 1,
        marginBottom: 0,
        marginRight: 10,
    },

    sendCodeButton: {
        backgroundColor: colors.background.yellowLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: borders.radius20,
        shadowColor: colors.shadow.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },

    sendCodeText: {
        color: colors.text.black,
        fontSize: typography.fontSize13,
        fontWeight: typography.fontWeight600,
    },

    submitButton: {
        marginTop: 20,
        borderRadius: borders.radius25,
        overflow: 'hidden',

        shadowColor: colors.shadow.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },

    submitGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: borders.radius25,
    },

    submitText: {
        color: colors.text.black,
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight600,
    },
});
