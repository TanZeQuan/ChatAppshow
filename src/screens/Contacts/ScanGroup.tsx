import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  Alert,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOriginalTabBarStyle } from "../../components/tabstyle"; // 确保路径正确
import { colors, typography } from '../../styles';

const { width } = Dimensions.get('window');
const SCAN_FRAME_SIZE = width * 0.7;

export default function ScanGroupScreen() {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const insets = useSafeAreaInsets();

  // 🔥🔥🔥 核心修复：隐藏底部 TabBar 🔥🔥🔥
  useLayoutEffect(() => {
    // 尝试获取父级导航器
    const parent = navigation.getParent();
    
    if (parent) {
      // 1. 尝试直接隐藏 (适用于 Stack 直接在 Tab 里)
      parent.setOptions({ tabBarStyle: { display: 'none' } });
      
      // 2. 增强修复：如果嵌套太深，尝试往上再找一级 (适用于 Stack -> Stack -> Tab)
      const grandParent = parent.getParent();
      if (grandParent) {
        grandParent.setOptions({ tabBarStyle: { display: 'none' } });
      }
    }

    return () => {
      // 离开时恢复样式
      if (parent) {
        parent.setOptions({
          tabBarStyle: getOriginalTabBarStyle(insets),
        });
        const grandParent = parent.getParent();
        if (grandParent) {
          grandParent.setOptions({
            tabBarStyle: getOriginalTabBarStyle(insets),
          });
        }
      }
    };
  }, [navigation, insets]);

  // Request permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    console.log(`Scanned ${type}: ${data}`);

    // --- Group Join Logic ---
    try {
      if (data.includes('group') || data.includes('chatId')) {
        Alert.alert(
          "发现群组",
          `识别到群组信息: \n${data}`,
          [
            { text: "取消", style: "cancel", onPress: () => setScanned(false) },
            { 
              text: "加入群聊", 
              onPress: () => {
                Alert.alert("申请已发送", "等待管理员审核");
                navigation.goBack();
              } 
            }
          ]
        );
      } else {
        Alert.alert(
          "无效二维码",
          "这不是一个有效的群聊二维码。",
          [{ text: "重试", onPress: () => setScanned(false) }]
        );
      }
    } catch (e) {
      Alert.alert("错误", "无法识别二维码内容", [{ text: "重试", onPress: () => setScanned(false) }]);
    }
  };

  const toggleFlash = () => {
    setFlashMode(prev => prev === 'off' ? 'on' : 'off');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      Alert.alert("提示", "相册扫码功能需额外集成识别库，暂未开启。");
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>需要相机权限来扫描二维码</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>授权相机</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => navigation.goBack()}>
          <Text style={[styles.btnText, { color: '#ef4444' }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashMode === 'on'}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>扫描群二维码</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Center Scanner Frame */}
        <View style={styles.centerContent}>
          <View style={styles.scanFrame}>
            {/* Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Scan Line Animation */}
            <View style={styles.scanLine} />
          </View>
          <Text style={styles.instructionText}>将二维码放入框内，自动扫描加入群聊</Text>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionItem} onPress={toggleFlash}>
            <View style={[styles.actionIconCircle, flashMode === 'on' && styles.actionActive]}>
              <Ionicons name={flashMode === 'on' ? "flash" : "flash-off"} size={24} color="white" />
            </View>
            <Text style={styles.actionText}>手电筒</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={pickImage}>
            <View style={styles.actionIconCircle}>
              <Ionicons name="image" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>相册</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1a202c',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -50,
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#fbbf24', // Yellow theme
    position: 'absolute',
    top: '50%',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fbbf24', // Yellow theme
    borderWidth: 4,
  },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  
  instructionText: {
    color: '#d1d5db',
    marginTop: 20,
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionActive: {
    backgroundColor: '#fbbf24', 
  },
  actionText: {
    color: 'white',
    fontSize: 12,
  },
});