import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import React, { useLayoutEffect, useState } from 'react';
import {
    Dimensions,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    Button
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';

// ✅ Imported consistent components and styles
import { useUserStore } from '../../store/userStore';
import { getOriginalTabBarStyle } from '../../components/tabstyle';
import { colors, typography } from '../../styles';
import { Avatar } from '../../components/Avatar'; 

const { width } = Dimensions.get('window');

export default function QRCodeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    // ✅ Use store format like ProfileScreen
    const { user } = useUserStore();
    
    // Fallback data if user is not loaded
    const userId = user?.id || 'GUEST';
    const userName = user?.name || 'Guest User';
    const userPhone = user?.phone || '';
    const userEmail = user?.email || '';
    const userAbout = user?.about || '';

    // Generate vCard format for contact information
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

    const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        if (data.startsWith('BEGIN:VCARD')) {
            const nameMatch = data.match(/FN:(.*)/);
            const phoneMatch = data.match(/TEL:(.*)/);
            const emailMatch = data.match(/EMAIL:(.*)/);

            const contactName = nameMatch ? nameMatch[1] : 'Unknown';
            const contactPhone = phoneMatch ? phoneMatch[1] : '';
            const contactEmail = emailMatch ? emailMatch[1] : '';

            Alert.alert(
                '扫描到联系人',
                `姓名: ${contactName}\n电话: ${contactPhone}\n邮箱: ${contactEmail}`,
                [
                    { text: '取消', style: 'cancel', onPress: () => setScanned(false) },
                    { 
                        text: '添加到通讯录', 
                        onPress: () => {
                            Alert.alert('成功', '联系人已添加到通讯录', [{ text: '确定', onPress: () => setScanned(false) }]);
                        } 
                    }
                ]
            );
        } else {
            Alert.alert(
                '扫码成功',
                `类型: ${type}\n数据: ${data}`,
                [{ text: '确定', onPress: () => setScanned(false) }]
            );
        }
    };

    const pickImageForScan = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert('权限被拒绝', '需要相册权限才能选择图片');

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });

            if (result.canceled) return;

            Alert.alert('图片已选择', '目前仅支持相机扫码，从相册识别二维码需要额外配置。', [{ text: '知道了' }]);
        } catch (error) {
            console.error('选择图片错误:', error);
            Alert.alert('选择失败', '选择图片时出错');
        }
    };

    const handleOpenScanner = () => {
        setScanned(false);
        setShowScanner(true);
    };

    // --- Scanner View ---
    if (showScanner) {
        if (!permission) return <View style={styles.container}><Text style={styles.loadingText}>正在请求相机权限...</Text></View>;
        if (!permission.granted) {
            return (
                <View style={[styles.container, styles.permissionContainer]}>
                    <Text style={styles.permissionText}>需要相机权限才能扫描二维码</Text>
                    <Button onPress={requestPermission} title="授予权限" />
                    <Button onPress={() => setShowScanner(false)} title="返回" color="#ff5555" />
                </View>
            );
        }

        return (
            <LinearGradient colors={['#4a5568', '#2d3748']} style={styles.container}>
                <StatusBar barStyle="light-content" />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => setShowScanner(false)}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.title}>扫码二维码</Text>
                        <View style={styles.placeholder} />
                    </View>

                    <View style={styles.scannerContent}>
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            facing="back"
                            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128"] }}
                        />
                        <View style={styles.scannerFrameContainer}>
                            <View style={[styles.scannerCorner, styles.topLeft]} />
                            <View style={[styles.scannerCorner, styles.topRight]} />
                            <View style={[styles.scannerCorner, styles.bottomLeft]} />
                            <View style={[styles.scannerCorner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scannerText}>将扫二维码放入框内即可扫码</Text>
                    </View>

                    <View style={styles.scannerActions}>
                        <TouchableOpacity style={styles.scannerActionButton} onPress={pickImageForScan}>
                            <View style={styles.scannerActionIconContainer}>
                                <Ionicons name="albums-outline" size={28} color="white" />
                            </View>
                            <Text style={styles.scannerActionText}>相册扫码</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.scannerActionButton} onPress={() => setShowScanner(false)}>
                            <View style={styles.scannerActionIconContainer}>
                                <Ionicons name="qr-code-outline" size={28} color="white" />
                            </View>
                            <Text style={styles.scannerActionText}>我的二维码</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // --- Main QR Card View ---
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
                    <LinearGradient colors={['#fcd34d', '#fbbf24']} style={styles.qrCard}>
                        
                        {/* ✅ Updated Avatar Circle using your custom Component */}
                        <View style={styles.avatarContainer}>
                            <LinearGradient colors={['#d1d5db', '#9ca3af']} style={styles.avatarOuter}>
                                <Avatar 
                                    uri={user?.avatar} 
                                    size={88} 
                                    borderRadius={44}
                                    // The Avatar component handles the default image internally 
                                    // based on your ProfileScreen logic.
                                />
                            </LinearGradient>
                        </View>

                        <View style={styles.qrContainer}>
                            <QRCode
                                value={qrValue}
                                size={200}
                                backgroundColor="white"
                                color="black"
                            />
                        </View>

                        <Text style={styles.userIdText}>{userName}</Text>
                        <Text style={styles.userIdSubText}>ID: {userId}</Text>
                    </LinearGradient>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenScanner}>
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="scan-outline" size={24} color="white" />
                        </View>
                        <Text style={styles.actionText}>扫一扫</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="download-outline" size={24} color="white" />
                        </View>
                        <Text style={styles.actionText}>下载该图片</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        backgroundColor: '#4b5563',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.text.black, // Used standard color
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
    },
    placeholder: { width: 40 },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    qrCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 32,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarOuter: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 4,
        borderColor: '#6b7280',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    qrContainer: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userIdText: {
        marginTop: 16,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    userIdSubText: {
        marginTop: 4,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '400',
        color: '#4B5563',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 48,
        paddingBottom: 32,
        paddingHorizontal: 24,
    },
    actionButton: { alignItems: 'center' },
    actionIconContainer: {
        width: 56,
        height: 56,
        backgroundColor: '#4b5563',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionText: {
        color: 'white',
        fontSize: 13,
    },
    // Scanner Styles
    scannerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    scannerFrameContainer: {
        width: width * 0.7,
        aspectRatio: 1,
        marginBottom: 32,
        position: 'relative',
    },
    scannerCorner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: 'white',
        borderWidth: 4,
    },
    topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    scannerText: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
    },
    scannerActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 80,
        paddingBottom: 48,
        paddingHorizontal: 24,
    },
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
    permissionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#2d3748'
    },
    permissionText: { color: 'white', textAlign: 'center', marginBottom: 20 },
});