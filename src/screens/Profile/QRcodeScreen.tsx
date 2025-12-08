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
import Svg, { Line, Rect } from 'react-native-svg';
import { getOriginalTabBarStyle } from '../../components/tabstyle';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function QRCodeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

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
        Alert.alert(
            '扫码成功',
            `类型: ${type}\n数据: ${data}`,
            [
                { text: '确定', onPress: () => setScanned(false) }
            ]
        );
    };

    const pickImageForScan = async () => {
        Alert.alert(
            '相册扫码功能',
            '相册扫码功能需要重新编译应用才能使用。\n\n请运行以下命令重新编译：\n\nnpx expo run:android\n或\nnpx expo run:ios',
            [{ text: '知道了' }]
        );

        /* TODO: 需要重新编译应用后启用此功能
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('权限被拒绝', '需要相册权限才能从图片中扫描二维码');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });

            if (result.canceled) return;

            // 需要 expo-barcode-scanner 原生模块
            const BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
            const scannedData = await BarCodeScanner.scanFromURLAsync(result.assets[0].uri);

            if (scannedData && scannedData.length > 0) {
                const { type, data } = scannedData[0];
                Alert.alert(
                    '扫码成功',
                    `类型: ${type}\n数据: ${data}`,
                    [{ text: '确定' }]
                );
            } else {
                Alert.alert('扫码失败', '图片中未检测到二维码或条形码');
            }
        } catch (error) {
            console.error('相册扫码错误:', error);
            Alert.alert('扫码失败', '从图片中扫描二维码时出错');
        }
        */
    };

    if (showScanner) {
        // 权限检查
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
                    {/* Scanner Header */}
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

                    {/* Scanner Content */}
                    <View style={styles.scannerContent}>
                        {/* Camera View - 全屏背景 */}
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            facing="back"
                            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr", "ean13", "ean8", "code128"],
                            }}
                        />

                        {/* Scanning Frame - 叠加在相机上 */}
                        <View style={styles.scannerFrame}>
                            <Svg width="100%" height="100%" viewBox="0 0 200 200">
                                {/* Corner brackets */}
                                {/* Top-left */}
                                <Line x1="10" y1="50" x2="10" y2="10" stroke="white" strokeWidth="4" strokeLinecap="square" />
                                <Line x1="10" y1="10" x2="50" y2="10" stroke="white" strokeWidth="4" strokeLinecap="square" />

                                {/* Top-right */}
                                <Line x1="150" y1="10" x2="190" y2="10" stroke="white" strokeWidth="4" strokeLinecap="square" />
                                <Line x1="190" y1="10" x2="190" y2="50" stroke="white" strokeWidth="4" strokeLinecap="square" />

                                {/* Bottom-left */}
                                <Line x1="10" y1="150" x2="10" y2="190" stroke="white" strokeWidth="4" strokeLinecap="square" />
                                <Line x1="10" y1="190" x2="50" y2="190" stroke="white" strokeWidth="4" strokeLinecap="square" />

                                {/* Bottom-right */}
                                <Line x1="150" y1="190" x2="190" y2="190" stroke="white" strokeWidth="4" strokeLinecap="square" />
                                <Line x1="190" y1="150" x2="190" y2="190" stroke="white" strokeWidth="4" strokeLinecap="square" />
                            </Svg>
                        </View>

                        <Text style={styles.scannerText}>将扫二维码放入框内即可扫码</Text>
                    </View>

                    {/* Scanner Actions */}
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
                {/* Header */}
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

                {/* QR Code Card */}
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
                                <View style={styles.avatarInner} />
                            </LinearGradient>
                        </View>

                        {/* QR Code */}
                        <View style={styles.qrContainer}>
                            <Svg width="100%" height="100%" viewBox="0 0 200 200">
                                {/* Top-left corner */}
                                <Rect x="10" y="10" width="60" height="60" fill="none" stroke="black" strokeWidth="6" />
                                <Rect x="22" y="22" width="36" height="36" fill="black" />

                                {/* Top-right corner */}
                                <Rect x="130" y="10" width="60" height="60" fill="none" stroke="black" strokeWidth="6" />
                                <Rect x="142" y="22" width="36" height="36" fill="black" />

                                {/* Bottom-left corner */}
                                <Rect x="10" y="130" width="60" height="60" fill="none" stroke="black" strokeWidth="6" />
                                <Rect x="22" y="142" width="36" height="36" fill="black" />

                                {/* Pattern blocks */}
                                <Rect x="80" y="10" width="10" height="10" fill="black" />
                                <Rect x="100" y="10" width="10" height="10" fill="black" />
                                <Rect x="80" y="30" width="10" height="10" fill="black" />
                                <Rect x="90" y="40" width="10" height="10" fill="black" />
                                <Rect x="110" y="30" width="10" height="10" fill="black" />

                                <Rect x="10" y="80" width="10" height="10" fill="black" />
                                <Rect x="30" y="80" width="10" height="10" fill="black" />
                                <Rect x="50" y="80" width="10" height="10" fill="black" />
                                <Rect x="20" y="90" width="10" height="10" fill="black" />
                                <Rect x="40" y="100" width="10" height="10" fill="black" />

                                <Rect x="80" y="80" width="30" height="30" fill="black" />
                                <Rect x="85" y="85" width="20" height="20" fill="white" />
                                <Rect x="90" y="90" width="10" height="10" fill="black" />

                                <Rect x="120" y="80" width="10" height="10" fill="black" />
                                <Rect x="140" y="90" width="10" height="10" fill="black" />
                                <Rect x="160" y="80" width="10" height="10" fill="black" />
                                <Rect x="180" y="90" width="10" height="10" fill="black" />

                                <Rect x="80" y="120" width="10" height="10" fill="black" />
                                <Rect x="100" y="130" width="10" height="10" fill="black" />
                                <Rect x="120" y="120" width="10" height="10" fill="black" />
                                <Rect x="90" y="140" width="10" height="10" fill="black" />
                                <Rect x="110" y="150" width="10" height="10" fill="black" />

                                <Rect x="130" y="130" width="10" height="10" fill="black" />
                                <Rect x="150" y="140" width="10" height="10" fill="black" />
                                <Rect x="170" y="130" width="10" height="10" fill="black" />
                                <Rect x="140" y="160" width="10" height="10" fill="black" />
                                <Rect x="160" y="170" width="10" height="10" fill="black" />
                                <Rect x="180" y="160" width="10" height="10" fill="black" />

                                <Rect x="10" y="100" width="10" height="10" fill="black" />
                                <Rect x="30" y="110" width="10" height="10" fill="black" />
                                <Rect x="50" y="100" width="10" height="10" fill="black" />

                                <Rect x="80" y="160" width="10" height="10" fill="black" />
                                <Rect x="100" y="170" width="10" height="10" fill="black" />
                                <Rect x="90" y="180" width="10" height="10" fill="black" />
                            </Svg>
                        </View>
                    </LinearGradient>
                </View>

                {/* Bottom Actions */}
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
    },
    avatarInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
    },
    qrContainer: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        aspectRatio: 1,
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
    // Scanner styles
    scannerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    scannerFrame: {
        width: width * 0.7,
        aspectRatio: 1,
        marginBottom: 32,
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