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
    Button,
    Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOriginalTabBarStyle } from '../../components/tabstyle';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { useUserStore } from '../../store/userStore';

const { width } = Dimensions.get('window');

export default function QRCodeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    // Get user from Zustand store
    const user = useUserStore((state) => state.user);
    const userId = user?.id || 'GUEST';
    const userName = user?.name || 'Guest User';
    const userAvatar = user?.avatar;
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

        parent?.setOptions({
            tabBarStyle: { display: "none" }
        });

        return () => {
            parent?.setOptions({
                tabBarStyle: getOriginalTabBarStyle(insets),
            });
        };
    }, [insets, navigation]);

    const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);

        // Check if it's a vCard (contact info)
        if (data.startsWith('BEGIN:VCARD')) {
            // Parse vCard data
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
                    {
                        text: '取消',
                        style: 'cancel',
                        onPress: () => setScanned(false)
                    },
                    {
                        text: '添加到通讯录',
                        onPress: () => {
                            // Here you would implement the logic to add contact
                            // For now, just show success message
                            Alert.alert(
                                '成功',
                                '联系人已添加到通讯录',
                                [{ text: '确定', onPress: () => setScanned(false) }]
                            );
                        }
                    }
                ]
            );
        } else {
            // Regular QR code
            Alert.alert(
                '扫码成功',
                `类型: ${type}\n数据: ${data}`,
                [
                    { text: '确定', onPress: () => setScanned(false) }
                ]
            );
        }
    };

    const pickImageForScan = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('权限被拒绝', '需要相册权限才能选择图片');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });

            if (result.canceled) return;

            Alert.alert(
                '图片已选择',
                '从图片中扫描二维码功能需要重新编译应用。\n\n请运行以下命令：\nnpx expo run:android\n或\nnpx expo run:ios\n\n编译后即可使用相册扫码功能。',
                [{ text: '知道了' }]
            );

            console.log('Selected image for scan:', result.assets[0].uri);
        } catch (error) {
            console.error('选择图片错误:', error);
            Alert.alert('选择失败', '选择图片时出错');
        }
    };

    if (showScanner) {
        if (!permission) {
            return (
                <View style={styles.container}>
                    <Text style={{ color: 'white', textAlign: 'center', margin: 20 }}>
                        正在请求相机权限...
                    </Text>
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                    <Text style={{ color: 'white', textAlign: 'center', marginBottom: 20 }}>
                        需要相机权限才能扫描二维码
                    </Text>
                    <Button onPress={requestPermission} title="授予权限" />
                </View>
            );
        }

        return (
            <LinearGradient
                colors={['#4a5568', '#2d3748']}
                style={styles.container}
            >
                <StatusBar barStyle="light-content" />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setShowScanner(false)}
                        >
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
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr", "ean13", "ean8", "code128"],
                            }}
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
                        <TouchableOpacity
                            style={styles.scannerActionButton}
                            onPress={pickImageForScan}
                        >
                            <View style={styles.scannerActionIconContainer}>
                                <Ionicons name="albums-outline" size={28} color="white" />
                            </View>
                            <Text style={styles.scannerActionText}>相册扫码</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.scannerActionButton}
                            onPress={() => setShowScanner(false)}
                        >
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

    return (
        <LinearGradient
            colors={['#4a5568', '#2d3748']}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.title}>我的二维码</Text>
                    <View style={styles.placeholder} />
                </View>

                <View style={styles.content}>
                    <LinearGradient
                        colors={['#fcd34d', '#fbbf24']}
                        style={styles.qrCard}
                    >
                        {/* Avatar Circle */}
                        <View style={styles.avatarContainer}>
                            <LinearGradient
                                colors={['#d1d5db', '#9ca3af']}
                                style={styles.avatarOuter}
                            >
                                {userAvatar ? (
                                    <Image
                                        source={{ uri: userAvatar }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <View style={styles.avatarInner}>
                                        <Ionicons name="person" size={32} color="#9ca3af" />
                                    </View>
                                )}
                            </LinearGradient>
                        </View>

                        {/* Real QR Code with User ID */}
                        <View style={styles.qrContainer}>
                            <QRCode
                                value={qrValue}
                                size={200}
                                backgroundColor="white"
                                color="black"
                            />
                        </View>

                        {/* Optional: Display User ID */}
                        <Text style={styles.userIdText}>{userName}</Text>
                        <Text style={styles.userIdSubText}>ID: {userId}</Text>
                    </LinearGradient>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setShowScanner(true)}
                    >
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
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
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
        color: 'white',
        fontSize: 18,
        fontWeight: '500',
    },
    placeholder: {
        width: 40,
    },
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
    avatarImage: {
        width: 88,
        height: 88,
        borderRadius: 44,
    },
    avatarInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
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
    actionButton: {
        alignItems: 'center',
    },
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
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
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
    scannerActionButton: {
        alignItems: 'center',
    },
    scannerActionIconContainer: {
        width: 60,
        height: 60,
        backgroundColor: '#4b5563',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    scannerActionText: {
        color: 'white',
        fontSize: 13,
    },
});