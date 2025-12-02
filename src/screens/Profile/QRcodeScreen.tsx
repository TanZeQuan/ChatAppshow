import React, { useLayoutEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
    StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Line } from 'react-native-svg';
import { useNavigation } from "@react-navigation/native";
import { getOriginalTabBarStyle } from '../../components/tabstyle';

const { width } = Dimensions.get('window');

export default function QRCodeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [showScanner, setShowScanner] = useState(false);

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

    if (showScanner) {
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
                        {/* Scanning Frame */}
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
                        <TouchableOpacity style={styles.scannerActionButton}>
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