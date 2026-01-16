import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Dimensions,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    Button,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

// 👇 相册识图的核心库
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jsQR from 'jsqr';
import * as jpeg from 'jpeg-js';
import { Buffer } from 'buffer';

// 👇 你的项目组件
import { useUserStore } from '../../store/userStore';
import { getOriginalTabBarStyle } from '../../components/tabstyle';
import { Avatar } from '../../components/Avatar';
import { createFriendRequest } from '../../api/Friend';

// 👇 ✅ 1. 引入 ContactStore
import { useContactStore } from '../../store/contactStore';
import { typography } from '@/src/styles';

const { width } = Dimensions.get('window');

export default function QRCodeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // 状态管理
    const [showScanner, setShowScanner] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [isProcessingImg, setIsProcessingImg] = useState(false);

    // 权限 Hooks
    const [permission, requestPermission] = useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    const viewShotRef = useRef<ViewShot>(null);

    // 用户数据
    const { user } = useUserStore();
    
    // 👇 ✅ 2. 安全地获取 contactStore 方法
    // 即使 store 还没准备好，这里也不会崩，因为我们只取函数
    const getContactById = useContactStore(state => state.getContactById);

    const userId = user?.id || 'GUEST';
    const userName = user?.name || 'Guest User';
    const userPhone = user?.phone || '';
    const userEmail = user?.email || '';
    const userAbout = user?.about || '';

    // 生成二维码内容
    const generateVCard = () => {
        return `BEGIN:VCARD
VERSION:3.0
FN:${userName}
TEL:${userPhone}
EMAIL:${userEmail}
NOTE:${userAbout}
URL:https://yourapp.com/user/${userId}
END:VCARD`;
    };

    const qrValue = generateVCard();

    useLayoutEffect(() => {
        const parent = navigation.getParent();
        parent?.setOptions({ tabBarStyle: { display: "none" } });
        return () => {
            parent?.setOptions({ tabBarStyle: getOriginalTabBarStyle(insets) });
        };
    }, [insets, navigation]);

    // 保存图片
    const handleDownload = async () => {
        try {
            if (!mediaPermission?.granted) {
                const { status } = await requestMediaPermission();
                if (status !== 'granted') {
                    Alert.alert('权限不足', '需要相册权限才能保存二维码');
                    return;
                }
            }
            if (viewShotRef.current && viewShotRef.current.capture) {
                const uri = await viewShotRef.current.capture();
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert('保存成功', '二维码名片已保存到相册 ✅');
            }
        } catch (error) {
            console.error('保存QR码失败:', error);
            Alert.alert('错误', '无法保存图片，请稍后重试');
        }
    };

    // 🟢 核心扫码逻辑 (已修复好友检查 + API判断)
    const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        console.log(`Scanned [${type}]: ${data}`);

        let scannedUserId = '';
        let contactName = 'Unknown';

        // 解析数据
        if (data.includes('BEGIN:VCARD')) {
            const nameMatch = data.match(/FN:(.*)/);
            const urlMatch = data.match(/URL:.*\/user\/(.*)/);
            if (nameMatch) contactName = nameMatch[1].trim();
            if (urlMatch) scannedUserId = urlMatch[1].trim();
        } else if (data.includes('/user/')) {
            const parts = data.split('/user/');
            if (parts.length > 1) scannedUserId = parts[1];
        } else {
            scannedUserId = data;
        }

        if (scannedUserId) {
            // 🛑 检查 1: 不能添加自己
            if (scannedUserId === userId) {
                Alert.alert('提示', '你不能添加自己为好友', [{ text: '确定', onPress: () => setScanned(false) }]);
                return;
            }

            // 🛑 检查 2: 检查是否已经是好友
            // ✅ 使用 contactStore 检查
            let isAlreadyFriend = false;
            try {
                if (getContactById) {
                    const contact = getContactById(scannedUserId);
                    if (contact) {
                        isAlreadyFriend = true;
                    }
                }
            } catch (err) {
                console.log("Contact store check failed, ignoring:", err);
            }

            if (isAlreadyFriend) {
                Alert.alert('提示', '该用户已经是你的好友了', [
                    { text: '知道了', onPress: () => setScanned(false) }
                ]);
                return;
            }

            // ✅ 检查通过，弹出添加确认框
            Alert.alert(
                '添加好友',
                `是否添加 ${contactName !== 'Unknown' ? contactName : '该用户'} 为好友?`,
                [
                    { text: '取消', style: 'cancel', onPress: () => setScanned(false) },
                    {
                        text: '发送请求',
                        onPress: async () => {
                            try {
                                const response = await createFriendRequest(scannedUserId, `嗨，我是 ${userName}`);
                                
                                console.log("API Response:", response); // 调试日志

                                // 👇👇👇 重点修复：兼容 API 返回格式 👇👇👇
                                // 有些后端只返回 { message: "Success" } 没有 success: true
                                const isSuccess = response && (response.success === true || response.message === 'Success');

                                if (isSuccess) {
                                    Alert.alert('成功', '好友请求已发送');
                                    setShowScanner(false);
                                } else {
                                    // 显示具体错误信息
                                    const errMsg = response?.message || '未知错误';
                                    Alert.alert('失败', errMsg);
                                }
                            } catch (e) {
                                console.error(e);
                                Alert.alert('错误', '网络请求失败');
                            } finally {
                                setScanned(false);
                            }
                        }
                    }
                ]
            );
        } else {
            Alert.alert('扫码结果', data, [{ text: '确定', onPress: () => setScanned(false) }]);
        }
    };

    // 🟢 相册识图逻辑 (JS解码)
    const pickImageForScan = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('权限不足', '需要相册权限才能识别二维码');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });

            if (result.canceled) return;

            setIsProcessingImg(true);

            // 压缩防止卡死
            const manipResult = await manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 600 } }],
                { base64: true, format: SaveFormat.JPEG }
            );

            if (!manipResult.base64) throw new Error("无法读取图片数据");

            const buffer = Buffer.from(manipResult.base64, 'base64');
            const rawImageData = new Uint8Array(buffer);
            const { width, height, data } = jpeg.decode(rawImageData, { useTArray: true });
            
            // 类型转换
            const clampedData = new Uint8ClampedArray(data);

            const code = jsQR(clampedData, width, height);

            setIsProcessingImg(false);
            if (code) {
                handleBarcodeScanned({ type: 'QR_CODE', data: code.data });
            } else {
                Alert.alert("未发现二维码", "请确保图片清晰，包含完整的二维码。");
            }
        } catch (error) {
            setIsProcessingImg(false);
            console.error('识别报错:', error);
            Alert.alert('识别失败', '无法解析该图片，请重试');
        }
    };

    const handleOpenScanner = () => {
        setScanned(false);
        setShowScanner(true);
    };

    // 🟢 视图部分
    if (showScanner) {
        if (!permission) return <View style={styles.container} />;
        if (!permission.granted) {
            return (
                <LinearGradient colors={['#4a5568', '#2d3748']} style={styles.container}>
                    <StatusBar barStyle="light-content" />
                    <SafeAreaView style={styles.safeArea}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.backButton} onPress={() => setShowScanner(false)}>
                                <Ionicons name="arrow-back" size={24} color="white" />
                            </TouchableOpacity>
                            <Text style={styles.title}>扫码二维码</Text>
                            <View style={styles.placeholder} />
                        </View>
                        
                        {/* Permission Content */}
                        <View style={styles.permissionContent}>
                            <View style={styles.permissionIconContainer}>
                                <Ionicons name="camera-outline" size={64} color="#fbbf24" />
                            </View>
                            <Text style={styles.permissionTitle}>需要相机权限</Text>
                            <Text style={styles.permissionDescription}>
                                扫描二维码需要使用您的相机，{'\n'}请授予相机访问权限
                            </Text>
                            
                            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                                <LinearGradient 
                                    colors={['#fcd34d', '#fbbf24']} 
                                    style={styles.permissionButtonGradient}
                                >
                                    <Text style={styles.permissionButtonText}>授予权限</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.permissionSecondaryButton} 
                                onPress={() => setShowScanner(false)}
                            >
                                <Text style={styles.permissionSecondaryText}>返回</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            );
        }

        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => setShowScanner(false)}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.titleScanner}>扫一扫</Text>
                        <View style={styles.placeholder} />
                    </View>
                    <View style={styles.scannerContent}>
                        <View style={styles.scannerFrameContainer}>
                            <View style={[styles.scannerCorner, styles.topLeft]} />
                            <View style={[styles.scannerCorner, styles.topRight]} />
                            <View style={[styles.scannerCorner, styles.bottomLeft]} />
                            <View style={[styles.scannerCorner, styles.bottomRight]} />
                            <View style={styles.scanLine} />
                        </View>
                        <Text style={styles.scannerText}>将二维码放入框内，自动扫描</Text>
                        {isProcessingImg && (
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator size="large" color="#fff" />
                                <Text style={{ color: 'white', marginTop: 10 }}>正在解析...</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.scannerActions}>
                        <TouchableOpacity style={styles.scannerActionButton} onPress={pickImageForScan} disabled={isProcessingImg}>
                            <View style={styles.scannerActionIconContainer}>
                                <Ionicons name="images-outline" size={28} color="white" />
                            </View>
                            <Text style={styles.scannerActionText}>相册</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.scannerActionButton} onPress={() => setShowScanner(false)}>
                            <View style={styles.scannerActionIconContainer}>
                                <Ionicons name="qr-code-outline" size={28} color="white" />
                            </View>
                            <Text style={styles.scannerActionText}>我的码</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <LinearGradient colors={['#4a5568', '#2d3748']} style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.title}>我的二维码</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.content}>
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ backgroundColor: 'transparent' }}>
                        <LinearGradient colors={['#fcd34d', '#fbbf24']} style={styles.qrCard}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient colors={['#d1d5db', '#9ca3af']} style={styles.avatarOuter}>
                                    <Avatar uri={user?.avatar} size={88} borderRadius={44} />
                                </LinearGradient>
                            </View>
                            <View style={styles.qrContainer}>
                                <QRCode value={qrValue} size={200} backgroundColor="white" color="black" />
                            </View>
                            <Text style={styles.userIdText}>{userName}</Text>
                            <Text style={styles.userIdSubText}>ID: {userId}</Text>
                        </LinearGradient>
                    </ViewShot>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenScanner}>
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="scan-outline" size={24} color="white" />
                        </View>
                        <Text style={styles.actionText}>扫一扫</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="download-outline" size={24} color="white" />
                        </View>
                        <Text style={styles.actionText}>保存图片</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a202c' },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(75, 85, 99, 0.6)',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: 'white', // ✅ 改为白色
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
    },
    placeholder: { width: 40 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    qrCard: { width: width * 0.85, maxWidth: 340, borderRadius: 24, padding: 24, alignItems: 'center' },
    avatarContainer: { marginTop: -60, marginBottom: 20 },
    avatarOuter: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: 'white', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    qrContainer: { backgroundColor: 'white', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    userIdText: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
    userIdSubText: { marginTop: 4, fontSize: 14, color: '#4B5563' },
    actions: { flexDirection: 'row', justifyContent: 'center', gap: 60, paddingBottom: 40 },
    actionButton: { alignItems: 'center' },
    actionIconContainer: { width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    actionText: { color: 'white', fontSize: 14 },
    scannerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scannerFrameContainer: { width: 260, height: 260, position: 'relative', justifyContent: 'center' },
    scanLine: { width: '100%', height: 2, backgroundColor: '#00FF00', opacity: 0.6, position: 'absolute', top: '50%' },
    scannerCorner: { position: 'absolute', width: 30, height: 30, borderColor: '#00FF00', borderWidth: 4 },
    topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    scannerText: { color: 'white', marginTop: 20, fontSize: 14, opacity: 0.8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 4 },
    loadingOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 10, alignItems: 'center' },
    scannerActions: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 40, paddingHorizontal: 40, width: '100%' },
    scannerActionButton: { alignItems: 'center' },
    scannerActionIconContainer: {
        width: 60,
        height: 60,
        backgroundColor: '#4b5563',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    scannerActionText: { color: 'white', fontSize: 13 },
    loadingText: { color: 'white', textAlign: 'center', margin: 20 },
    // 新的权限页面样式
    permissionContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    titleScanner:{
        color: 'white',
    },
    permissionIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    permissionTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    permissionDescription: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
    },
    permissionButton: {
        width: '100%',
        marginBottom: 16,
    },
    permissionButtonGradient: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    permissionButtonText: {
        color: '#1F2937',
        fontSize: 16,
        fontWeight: '600',
    },
    permissionSecondaryButton: {
        paddingVertical: 12,
    },
    permissionSecondaryText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 15,
    },
});