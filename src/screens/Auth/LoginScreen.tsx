import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setUser } = useUserStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const onLogin = async () => {
    if (phone && password) {
      const userData = {
        id: '1',
        username: 'User001',
        avatar: 'https://wallpapers.com/images/hd/anime-profile-picture-jioug7q8n43yhlwn.jpg',
        name: 'UserTest',
        phone: phone,
      };
      const token = 'dummy-token-123';

      setUser(userData, token);

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } else {
      alert('请输入手机号和密码');
    }
  };

  const isButtonDisabled = !phone || !password || !isChecked;

  return (
    <LinearGradient colors={['#FFE194', '#FFF9E5', '#FFFFFF']} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea}>
        {/* 背景装饰 */}
        <View style={styles.bgShape1} />
        <View style={styles.bgShape2} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/images/sentalk-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.title}>欢迎回来</Text>

          {/* 手机号输入 */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.inputField}
              placeholder="手机号"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* 密码输入 */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.inputField}
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#888"
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>

          {/* 链接 */}
          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>注册账号</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Forget')}>
              <Text style={styles.linkText}>忘记密码？</Text>
            </TouchableOpacity>
          </View>

          {/* 登录按钮 */}
          <TouchableOpacity
            onPress={onLogin}
            disabled={isButtonDisabled}
            style={[
              styles.loginButtonWrapper,
              isButtonDisabled && styles.disabledButton,
            ]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8F8F8']}
              style={styles.loginButtonGradient}
            >
              <Text style={styles.loginButtonText}>登录</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 协议勾选 */}
          <View style={styles.agreementContainer}>
            <TouchableOpacity
              onPress={() => setIsChecked(!isChecked)}
              style={styles.checkbox}
            >
              <Ionicons
                name={isChecked ? 'checkbox' : 'square-outline'}
                size={18}
                color={isChecked ? '#007AFF' : '#888'}
              />
            </TouchableOpacity>
            <Text style={styles.agreementText}>
              我已阅读并同意{' '}
              <Text style={styles.agreementLink}>隐私政策与服务条款</Text>
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 40,
  },
  logoContainer: { marginBottom: 20 },
  logoCard: {
    width: 128,
    height: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoImage: { width: 130, height: 130 },
  bgShape1: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    top: -100,
    right: -120,
    transform: [{ rotate: '45deg' }],
  },
  bgShape2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    top: 50,
    left: -150,
    transform: [{ rotate: '30deg' }],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
    color: '#333333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#2F80ED',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    height: '100%',
  },
  icon: { marginLeft: 10 },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 15,
  },
  linkText: {
    color: '#555555',
    fontSize: 14,
  },
  loginButtonWrapper: {
    width: '100%',
    height: 55,
    borderRadius: 30,
    shadowColor: '#2F80ED',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden',
  },
  loginButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  loginButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: { opacity: 0.6 },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    width: '100%',
    justifyContent: 'center',
  },
  checkbox: { padding: 5 },
  agreementText: {
    marginLeft: 8,
    color: '#666666',
    fontSize: 13,
  },
  agreementLink: { color: '#2F80ED' },
});
