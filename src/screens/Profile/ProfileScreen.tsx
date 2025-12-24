import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  StyleSheet as RNStyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readUsers, updateUserInfo } from '../../api/User';
import { Avatar } from '../../components/Avatar';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  navigateTo?: string;
  onPress?: () => void;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useUserStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0); // Force avatar re-render

  // Fetch user data function
  const fetchUserData = async (silent = false) => {
    if (!user?.id) return;

    try {
      const res = await readUsers(user.id);

      // console.log('=== FULL API RESPONSE ===');
      // console.log('res.data:', JSON.stringify(res.data, null, 2));

      if (res.success && res.data?.response) {
        const userData = res.data.response;

        // ✅ Validate backend avatar: if it's only the domain (invalid), keep existing avatar
        let backendAvatar = userData.image || '';

        // Check if backend avatar is invalid (only domain, no path)
        const isInvalidAvatar = backendAvatar && (
          backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
          backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/' ||
          !backendAvatar.includes('/content/') // Must have actual file path
        );

        // ✅ If backend avatar is invalid, get current avatar from store (not from parameter)
        // This ensures we keep the correct avatar even after multiple refreshes
        const currentStoreAvatar = useUserStore.getState().user?.avatar || '';
        const finalAvatar = isInvalidAvatar ? currentStoreAvatar : backendAvatar;

        console.log('🖼️ Avatar validation:', {
          backend: backendAvatar,
          currentStore: currentStoreAvatar,
          paramUser: user.avatar,
          isInvalid: isInvalidAvatar,
          final: finalAvatar
        });

        const updatedUser = {
          id: userData.user_id || user.id,
          name: userData.name || userData.username || userData.full_name || user.name || 'Unknown',
          phone: userData.phone || user.phone || '',
          email: userData.email || user.email || '',
          avatar: finalAvatar, // ✅ Use validated avatar
          about: userData.about || user.about || '',
        };

        // console.log('updatedUser:', JSON.stringify(updatedUser, null, 2));

        useUserStore.getState().setUser(updatedUser, useUserStore.getState().token || "");

        // Force avatar component to re-render
        setAvatarKey(prev => prev + 1);
      }
    } catch (err) {
      console.error('readUsers 错误:', err);
      if (!silent) {
        Alert.alert('错误', '获取用户信息失败');
      }
    }
  };

  // Fetch user data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchUserData(true); // Silent fetch when screen focuses
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  if (!user) {
    return (
      <View style={profileStyles.container}>
        <Text>未登录</Text>
      </View>
    );
  }

  const menuItems: MenuItem[] = [
    {
      icon: 'star-outline',
      label: '我的收藏',
      onPress: () => Alert.alert('提示', '我的收藏功能暂未开放')
    },
    {
      icon: 'person-outline',
      label: '联系客服',
      onPress: () => Alert.alert('提示', '联系客服功能暂未开放')
    },
    {
      icon: 'help-circle-outline',
      label: '帮助中心',
      onPress: () => Alert.alert('提示', '帮助中心功能暂未开放')
    },
    { icon: 'settings-outline', label: '设置', navigateTo: 'SettingScreen' },
    { icon: 'people-outline', label: '会议', navigateTo: 'MeetingScreen' },
  ];

  const pickImage = async () => {
    if (isUpdating) return;

    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('权限被拒绝', '无法访问相册');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsUpdating(true);

      try {
        // ✅ Upload image to server - MUST include name and about to prevent backend from clearing them
        const res = await updateUserInfo(user.id, {
          name: user.name,  // Keep existing name
          about: user.about || '',  // Keep existing about
          image: { uri, type: "image/jpeg", name: "avatar.jpg" },
        });

        console.log('updateUserInfo 返回:', res);

        if (res.success) {
          // Fetch updated user data with server URL
          await fetchUserData();
          Alert.alert('成功', '头像更新成功');
        } else {
          Alert.alert('失败', res.message || '头像更新失败');
        }
      } catch (error) {
        console.error('上传头像错误:', error);
        Alert.alert('错误', '上传失败，请重试');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const takePhoto = async () => {
    if (isUpdating) return;

    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return Alert.alert('权限被拒绝', '无法访问相机');

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsUpdating(true);

      try {
        // ✅ Upload image to server - MUST include name and about to prevent backend from clearing them
        const res = await updateUserInfo(user.id, {
          name: user.name,  // Keep existing name
          about: user.about || '',  // Keep existing about
          image: { uri, type: "image/jpeg", name: "avatar.jpg" },
        });

        console.log('updateUserInfo 返回:', res);

        if (res.success) {
          // Fetch updated user data with server URL
          await fetchUserData();
          Alert.alert('成功', '头像更新成功');
        } else {
          Alert.alert('失败', res.message || '头像更新失败');
        }
      } catch (error) {
        console.error('拍照上传错误:', error);
        Alert.alert('错误', '上传失败，请重试');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleAvatarPress = () => {
    if (isUpdating) return;

    Alert.alert('更换头像', '请选择操作', [
      { text: '拍照', onPress: takePhoto },
      { text: '从相册选择', onPress: pickImage },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("确认登出", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出登录",
        style: "destructive",
        onPress: () => {
          console.log('🔌 ProfileScreen: Logging out, disconnecting WebSocket');
          logout();
        }
      }
    ]);
  };

  return (
    <View style={profileStyles.container}>
      <LinearGradient colors={['#FFD860', '#FFD860']} style={profileStyles.gradientHeader}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity
            style={profileStyles.profileHeader}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <TouchableOpacity
              onPress={handleAvatarPress}
              disabled={isUpdating}
              style={profileStyles.avatarTouchable}
            >
              <Avatar
                key={avatarKey} // Force re-render when key changes
                uri={user.avatar}
                size={scaleWidth(80)}
                borderRadius={scaleWidth(8)}
                showCameraBadge={true}
                isUploading={isUpdating}
              />
            </TouchableOpacity>

            <View style={profileStyles.profileInfo}>
              <Text style={profileStyles.profileName}>{user.name}</Text>
              <Text style={profileStyles.profileId}>账号ID：{user.id}</Text>
            </View>

            <TouchableOpacity
              style={profileStyles.qrButton}
              onPress={() => navigation.navigate('QRcode')}
            >
              <Ionicons name="qr-code-outline" size={24} color="#666" />
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      <View style={profileStyles.whiteSection}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={profileStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FFD966']}
              tintColor="#FFD966"
              title="刷新中..."
              titleColor="#999"
            />
          }
        >
          <View style={profileStyles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={profileStyles.menuItem}
                onPress={() => item.onPress ? item.onPress() : navigation.navigate(item.navigateTo!)}
              >
                <View style={profileStyles.menuLeft}>
                  <View style={profileStyles.menuIconContainer}>
                    <Ionicons name={item.icon} size={20} color="#666" />
                  </View>
                  <Text style={profileStyles.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={profileStyles.logoutButton} onPress={handleLogout}>
            <Text style={profileStyles.logoutText}>退出</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const profileStyles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.white,
  },

  gradientHeader: {
    paddingBottom: scaleHeight(20),
  },

  whiteSection: {
    flex: 1,
    backgroundColor: colors.background.gradientYellow[0],
  },

  scrollContent: {
    paddingBottom: scaleHeight(40),
  },

  /** HEADER */
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(16),
  },

  avatarTouchable: {
    marginRight: scaleWidth(12),
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: scaleFont(typography.fontSize18),
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginBottom: scaleHeight(4),
  },

  profileId: {
    fontSize: scaleFont(typography.fontSize13),
    color: colors.text.grayLight,
  },

  qrButton: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleWidth(4),
  },

  /** MENU */
  menuContainer: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(20),
  },

  menuItem: {
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(12),

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    shadowColor: colors.shadow.black,
    shadowOffset: { width: 5, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  menuIconContainer: {
    width: scaleWidth(32),
    height: scaleHeight(32),
    backgroundColor: colors.background.iconBg,
    borderRadius: borders.radius16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleWidth(12),
  },

  menuLabel: {
    fontSize: scaleFont(typography.fontSize15),
    fontWeight: typography.fontWeight400,
    color: colors.text.dark,
  },

  /** LOGOUT BUTTON */
  logoutButton: {
    backgroundColor: colors.functional.yellowBright,
    borderRadius: borders.radius25,
    paddingVertical: scaleHeight(14),
    marginHorizontal: scaleWidth(32),
    marginTop: scaleHeight(30),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borders.width1,
    borderColor: colors.functional.yellow,
  },

  logoutText: {
    fontSize: scaleFont(typography.fontSize16),
    fontWeight: typography.fontWeight500,
    color: colors.text.dark,
  },
});
