import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../../api/Auth';
import { readUsers } from '../../api/User';
import WebSocketManager from '../../services/WebSocketManager';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width, height } = Dimensions.get("window");

// Responsive scaling functions
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;

// Check if it's a small device
const isSmallDevice = height < 700;

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  useUserStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const handleLogin = async () => {
    try {
      console.log('登录参数:', { phone, passcode: password });
      const loginResult = await login({ phone, passcode: password });
      console.log('登录结果:', loginResult);

      if (!loginResult.error) {
        const userId = loginResult.response; 

        // fetch full user info
        const userResult = await readUsers(userId);
        if (userResult.success) {
          const fullUser = {
            id: userResult.data.response.user_id,
            name: userResult.data.response.name,
            phone: userResult.data.response.phone,
            email: userResult.data.response.email,
            avatar: userResult.data.response.image,
            about: userResult.data.response.about,
          };
          
          // Step 1: Connect to WebSocket and wait for login confirmation
          await WebSocketManager.connect(fullUser.id);
          console.log("[LoginScreen] WebSocket connected and logged in.");

          // Step 2: Now set the user state. This will trigger navigation to the main app.
          useUserStore.getState().setUser(fullUser, loginResult.token || "FAKE_TOKEN");
          console.log("最终保存到 Store 的用户资料:", fullUser);

        } else {
          Alert.alert('登录后读取信息失败', userResult.message);
        }
      } else {
        Alert.alert('登录失败', loginResult.message);
      }
    } catch (err: any) {
      console.error('登录异常:', err);
      Alert.alert('登录异常', err.message || '未知错误');
    }
  };

  const isButtonDisabled = !phone || !password || !isChecked;

  return (
    <LinearGradient colors={['#FFE194', '#FFF9E5', '#FFFFFF']} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea}>
        {/* 背景装饰 */}
        {/* <View style={styles.bgShape1} />
        <View style={styles.bgShape2} /> */}

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
            onPress={handleLogin}
            disabled={isButtonDisabled}
            style={[
              styles.loginButtonWrapper,
              isButtonDisabled && styles.disabledButton,
            ]}
          >
            <LinearGradient
              colors={["#FFEFB0", "#FFF9E5"]}
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

  // Logo
  logoContainer: {
    marginBottom: isSmallDevice ? scaleHeight(12) : scaleHeight(16),
  },
  logoCard: {
    width: scaleWidth(isSmallDevice ? 90 : 110),
    height: scaleWidth(isSmallDevice ? 90 : 110),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoImage: {
    width: scaleWidth(isSmallDevice ? 92 : 112),
    height: scaleWidth(isSmallDevice ? 92 : 112),
  },

  // 背景装饰
  // bgShape1: {
  //   position: 'absolute',
  //   width: 350,
  //   height: 350,
  //   borderRadius: borders.radius60,
  //   backgroundColor: colors.background.transparentWhite50,
  //   top: -100,
  //   right: -120,
  //   transform: [{ rotate: '45deg' }],
  // },
  // bgShape2: {
  //   position: 'absolute',
  //   width: 300,
  //   height: 300,
  //   borderRadius: borders.radius60,
  //   backgroundColor: colors.background.transparentWhite70,
  //   top: 50,
  //   left: -150,
  //   transform: [{ rotate: '30deg' }],
  // },

  title: {
    fontSize: typography.fontSize28,
    fontWeight: typography.fontWeight700,
    marginBottom: 30,
    color: colors.text.blackMedium,
  },

  // 输入框
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: colors.background.white,
    borderRadius: borders.radius30,
    marginBottom: 20,
    paddingHorizontal: 20,
    shadowColor: colors.shadow.blue,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  inputField: {
    flex: 1,
    fontSize: typography.fontSize16,
    color: colors.text.dark,
    height: '100%',
  },
  icon: { marginLeft: 10 },

  // 链接
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 15,
  },
  linkText: {
    color: colors.text.grayDark,
    fontSize: typography.fontSize14,
  },

  // 登录按钮
  loginButtonWrapper: {
    width: '100%',
    height: 55,
    borderRadius: borders.radius30,
    shadowColor: colors.shadow.blue,
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
    borderRadius: borders.radius30,
    borderWidth: 1,
    borderColor: colors.background.white,
  },
  loginButtonText: {
    color: colors.text.dark,
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight700,
  },
  disabledButton: { opacity: 0.6 },

  // 协议勾选
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
    color: colors.text.grayDark,
    fontSize: typography.fontSize13,
  },
  agreementLink: { color: colors.functional.blue },
});
