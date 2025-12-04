import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';
import { readUsers, updateUserInfo } from '../../api/User'; // Import the API functions

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
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch complete user data on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchUser = async () => {
      try {
        const res = await readUsers(user.id);

        // Log the exact API response
        console.log('=== FULL API RESPONSE ===');
        console.log('res.data:', JSON.stringify(res.data, null, 2));
        console.log('res.data.response:', JSON.stringify(res.data?.response, null, 2));

        if (res.success && res.data?.response) {
          const userData = res.data.response;

          // Log each field individually
          console.log('=== INDIVIDUAL FIELDS ===');
          console.log('user_id:', userData.user_id);
          console.log('name:', userData.name);
          console.log('username:', userData.username); // Maybe it's called username?
          console.log('full_name:', userData.full_name); // Or full_name?
          console.log('display_name:', userData.display_name); // Or display_name?

          // Log all keys in the response
          console.log('All keys in userData:', Object.keys(userData));

          const updatedUser = {
            id: userData.user_id || user.id,
            name: userData.name || userData.username || userData.full_name || user.name || 'Unknown',
            phone: userData.phone || user.phone || '',
            email: userData.email || user.email || '',
            avatar: userData.image || user.avatar || '',
            about: userData.about || user.about || '',
          };

          console.log('updatedUser:', JSON.stringify(updatedUser, null, 2));

          useUserStore.getState().setUser(updatedUser, useUserStore.getState().token || "");
          setAvatarUri(updatedUser.avatar);
        }
      } catch (err) {
        console.error('readUsers 错误:', err);
      }
    };

    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>未登录</Text>
      </View>
    );
  }

  const menuItems: MenuItem[] = [
    { icon: 'star-outline', label: '我的收藏', navigateTo: 'Favorites' },
    { icon: 'person-outline', label: '联系客服', navigateTo: 'HelpSupport' },
    { icon: 'help-circle-outline', label: '帮助中心', navigateTo: 'HelpCenter' },
    { icon: 'settings-outline', label: '设置', navigateTo: 'SettingScreen' },
    { icon: 'people-outline', label: '会议', navigateTo: 'MeetingScreen' },
  ];

  const pickImage = async () => {
    if (isUpdating) return;

    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('权限被拒绝', '无法访问相册');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const previousAvatar = avatarUri;

      // Optimistic update
      setAvatarUri(uri);
      setIsUpdating(true);

      try {
        // Upload image to server
        const res = await updateUserInfo(user.id, {
          name: user.name,
          image: { uri, type: "image/jpeg", name: "avatar.jpg" },
        });

        console.log('updateUserInfo 返回:', res);

        if (res.success) {
          // Fetch updated user data
          const info = await readUsers(user.id);

          if (info.success && info.data?.response) {
            const userData = info.data.response;

            const updatedUser = {
              id: userData.user_id || user.id,
              name: userData.name || user.name,
              phone: userData.phone || user.phone,
              email: userData.email || user.email,
              avatar: userData.image,
              about: userData.about || user.about || '', // Add this
            };

            useUserStore.getState().setUser(
              updatedUser,
              useUserStore.getState().token || ""
            );

            setAvatarUri(userData.image);
            Alert.alert('成功', '头像更新成功');
          }
        } else {
          setAvatarUri(previousAvatar);
          Alert.alert('失败', res.message || '头像更新失败');
        }
      } catch (error) {
        console.error('上传头像错误:', error);
        setAvatarUri(previousAvatar);
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
      const previousAvatar = avatarUri;

      // Optimistic update
      setAvatarUri(uri);
      setIsUpdating(true);

      try {
        // Upload image to server
        const res = await updateUserInfo(user.id, {
          name: user.name,
          image: { uri, type: "image/jpeg", name: "avatar.jpg" },
        });

        console.log('updateUserInfo 返回:', res);

        if (res.success) {
          // Fetch updated user data
          const info = await readUsers(user.id);

          if (info.success && info.data?.response) {
            const userData = info.data.response;

            const updatedUser = {
              id: userData.user_id || user.id,
              name: userData.name || user.name,
              phone: userData.phone || user.phone,
              email: userData.email || user.email,
              avatar: userData.image,
              about: userData.about || user.about || '', // Add this line
            };

            useUserStore.getState().setUser(
              updatedUser,
              useUserStore.getState().token || ""
            );

            setAvatarUri(userData.image);
            Alert.alert('成功', '头像更新成功');
          }
        } else {
          setAvatarUri(previousAvatar);
          Alert.alert('失败', res.message || '头像更新失败');
        }
      } catch (error) {
        console.error('拍照上传错误:', error);
        setAvatarUri(previousAvatar);
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
      { text: "退出登录", style: "destructive", onPress: logout }
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFD966', '#FFB84D']} style={styles.gradientHeader}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity style={styles.profileHeader} onPress={() => navigation.navigate('EditProfile')}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarPress}
              disabled={isUpdating}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color="#fff" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileId}>账号ID：{user.id}</Text>
            </View>

            <TouchableOpacity style={styles.qrButton} onPress={() => navigation.navigate('QRcode')}>
              <Ionicons name="qr-code-outline" size={24} color="#666" />
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.whiteSection}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => item.onPress ? item.onPress() : navigation.navigate(item.navigateTo!)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon} size={20} color="#666" />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>退出</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  gradientHeader: { paddingBottom: scaleHeight(20) },
  whiteSection: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: scaleHeight(40) },

  profileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(16) },
  avatarContainer: { width: scaleWidth(80), height: scaleWidth(80), marginRight: scaleWidth(12), position: 'relative' },
  avatar: { width: scaleWidth(80), height: scaleWidth(80), borderRadius: scaleWidth(8) },
  avatarPlaceholder: { width: scaleWidth(80), height: scaleWidth(80), backgroundColor: '#666', borderRadius: scaleWidth(8), justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: scaleWidth(24), height: scaleWidth(24), borderRadius: scaleWidth(12), backgroundColor: '#0a0a0aff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: scaleFont(18), fontWeight: '600', color: '#333', marginBottom: scaleHeight(4) },
  profileId: { fontSize: scaleFont(13), color: '#999' },
  qrButton: { width: scaleWidth(36), height: scaleWidth(36), justifyContent: 'center', alignItems: 'center', marginRight: scaleWidth(4) },

  menuContainer: { paddingHorizontal: scaleWidth(16), paddingTop: scaleHeight(20) },
  menuItem: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: scaleHeight(16), paddingHorizontal: scaleWidth(16), marginBottom: scaleHeight(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 5, height: 8 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIconContainer: { width: scaleWidth(32), height: scaleHeight(32), backgroundColor: '#F8F9FA', borderRadius: scaleWidth(16), justifyContent: 'center', alignItems: 'center', marginRight: scaleWidth(12) },
  menuLabel: { fontSize: scaleFont(15), color: '#333', fontWeight: '400' },

  logoutButton: { backgroundColor: '#FFD966', borderRadius: 25, paddingVertical: scaleHeight(14), marginHorizontal: scaleWidth(32), marginTop: scaleHeight(30), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFB84D' },
  logoutText: { fontSize: scaleFont(16), fontWeight: '500', color: '#333' },
});