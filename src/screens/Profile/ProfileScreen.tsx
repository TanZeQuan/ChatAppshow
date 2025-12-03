import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';
import { updateUserInfo } from '../../api/User';


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
  console.log('user from store', user);

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  useEffect(() => {
    if (user?.avatar) {
      setAvatarUri(user.avatar);
    }
  }, [user?.avatar]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>未登录</Text>
      </View>
    );
  }

  const menuItems: MenuItem[] = [
    {
      icon: 'star-outline',
      label: '我的收藏',
      navigateTo: 'Favorites'
    },
    {
      icon: 'person-outline',
      label: '联系客服',
      navigateTo: 'HelpSupport'
    },
    {
      icon: 'help-circle-outline',
      label: '帮助中心',
      navigateTo: 'HelpCenter'
    },
    {
      icon: 'settings-outline',
      label: '设置',
      navigateTo: 'SettingScreen'
    },
    {
      icon: 'people-outline',
      label: '会议',
      navigateTo: 'MeetingScreen'
    },
  ];

  const pickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('Permission Denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);

      const updateResult = await updateUserInfo(user.id, { image: { uri, name: 'avatar.jpg', type: 'image/jpeg' } });
      if (updateResult.success) {
        // 更新 store
        setUser({ ...user, avatar: uri });
        Alert.alert('更新成功');
      } else {
        Alert.alert('更新失败', updateResult.message);
      }
    }
  };


  const takePhoto = async () => {
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Denied', 'Cannot access camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
        Alert.alert('Success', 'Avatar updated!');
      }
    } catch (err) {
      console.warn('Failed to take photo', err);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Change Avatar', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("确认登出", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出登录",
        style: "destructive",
        onPress: () => {
          logout(); // ⭐ 自动跳回 Login
        }
      }
    ]);
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFD966', '#FFB84D']}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          {/* Profile Header */}
          <TouchableOpacity
            style={styles.profileHeader}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarPress}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color="#fff" />
                </View>
              )}
              {/* Camera Icon Badge */}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.username}</Text>
              <Text style={styles.profileId}>账号ID：{user.id}</Text>
            </View>

            <TouchableOpacity
              style={styles.qrButton}
              onPress={() => navigation.navigate('QRcode')}
            >
              <Ionicons name="qr-code-outline" size={24} color="#666" />
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      {/* White Background Section */}
      <View style={styles.whiteSection}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Menu Items */}
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => {
                  if (item.onPress) {
                    item.onPress();
                  } else if (item.navigateTo) {
                    navigation.navigate(item.navigateTo);
                  }
                }}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color="#666"
                    />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>退出</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradientHeader: {
    paddingBottom: scaleHeight(20),
  },
  whiteSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: scaleHeight(40),
  },

  /** PROFILE HEADER */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(16),
  },
  avatarContainer: {
    width: scaleWidth(80),
    height: scaleWidth(80),
    marginRight: scaleWidth(12),
    position: 'relative',
  },
  avatar: {
    width: scaleWidth(80),
    height: scaleWidth(80),
    borderRadius: scaleWidth(8),
  },
  avatarPlaceholder: {
    width: scaleWidth(64),
    height: scaleWidth(64),
    backgroundColor: '#666',
    borderRadius: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scaleWidth(24),
    height: scaleWidth(24),
    borderRadius: scaleWidth(12),
    backgroundColor: '#0a0a0aff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#333',
    marginBottom: scaleHeight(4)
  },
  profileId: {
    fontSize: scaleFont(13),
    color: '#999',
  },
  qrButton: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(4),
  },

  /** MENU */
  menuContainer: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(20),
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: scaleWidth(32),
    height: scaleHeight(32),
    backgroundColor: '#F8F9FA',
    borderRadius: scaleWidth(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(12),
  },
  menuLabel: {
    fontSize: scaleFont(15),
    color: '#333',
    fontWeight: '400',
  },

  /** LOGOUT */
  logoutButton: {
    backgroundColor: '#FFD966',
    borderRadius: 25,
    paddingVertical: scaleHeight(14),
    marginHorizontal: scaleWidth(32),
    marginTop: scaleHeight(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFB84D',
  },
  logoutText: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: '#333',
  },
});

function setUser(arg0: { avatar: string; id: string; username: string; phone: string; email?: string; }) {
  throw new Error('Function not implemented.');
}
