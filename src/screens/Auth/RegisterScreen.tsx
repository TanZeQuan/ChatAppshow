import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createUser } from "../../api/User";
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width, height } = Dimensions.get("window");

// Responsive scaling functions
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

// Check if it's a small device
const isSmallDevice = height < 700;

export default function RegisterScreen() {
  const navigation = useNavigation<any>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (password !== confirmPassword) {
      Alert.alert("错误", "两次输入的密码不一致");
      return;
    }

    if (password.length < 6) {
      Alert.alert("错误", "密码长度至少6位");
      return;
    }

    setIsLoading(true);

    // Prepare data to send
    const postData = {
      phone: phone,
      passcode: password,
      name: name,
      email: email,
      roles: "user",
      status: 1,
    };

    // Test if API is reachable
    try {
      const testResponse = await fetch('https://balkingly-hemitropic-lelah.ngrok-free.dev/api');
    } catch (testError) {
      console.error('❌ [Register] API connectivity test failed:', testError);
      Alert.alert(
        '网络错误',
        'API 服务器无法访问，请检查：\n1. 网络连接是否正常\n2. ngrok URL 是否有效\n3. 后端服务器是否运行'
      );
      setIsLoading(false);
      return;
    }

    try {
      // Call API
      const res = await createUser(postData);

      // Check if the message indicates success (case-insensitive)
      const messageText = (res.message || res.error || "").toUpperCase();
      const isSuccess = messageText.includes("SUCCESS") ||
        messageText.includes("SUCCESSFUL") ||
        res.success === true ||
        res.data?.success === true;

      if (isSuccess) {
        // Extract user_id from response (check different possible locations)
        const userId = res.user_id ||
          res.data?.user_id ||
          res.data?.response?.user_id ||
          res.data?.data?.user_id;

        const token = res.token ||
          res.data?.token ||
          res.data?.response?.token ||
          "";

        // Update store with registered user data
        if (userId) {
          useUserStore.getState().setUser(
            {
              id: userId,
              name: name,
              phone: phone,
              email: email,
              avatar: "",
              about: ""
            },
            token
          );
        }

        // Show success message and navigate
        Alert.alert(
          "注册成功",
          "您的账号已创建成功，请登录",
          [
            {
              text: "确定",
              onPress: () => navigation.navigate("Login")
            }
          ]
        );
      } else {
        // Registration failed
        console.error("❌ Registration failed:", res.message || res.error);
        Alert.alert(
          "注册失败",
          res.message || res.error || "请检查您的信息后重试"
        );
      }
    } catch (error: any) {
      console.error("❌ Registration error:", error);

      // Display more detailed error message
      const errorMessage = error?.response?.data?.message ||
                          error?.message ||
                          "网络连接失败，请检查网络后重试";

      Alert.alert("注册失败", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled =
    isLoading || !name || !email || !phone || !password || !confirmPassword || !isChecked;

  return (
    <LinearGradient colors={["#FFE194", "#FFF9E5", "#FFFFFF"]} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* <View style={styles.bgShape1} />
        <View style={styles.bgShape2} /> */}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <View style={styles.logoCard}>
                  <Image
                    source={require("../../assets/images/sentalk-logo.png")}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Text style={styles.title}>创建账号</Text>

              {/* 姓名 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputField}
                  placeholder="请输入姓名"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isLoading}
                  placeholderTextColor="#999"
                />
              </View>

              {/* 邮箱 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputField}
                  placeholder="请输入邮箱"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  placeholderTextColor="#999"
                />
              </View>

              {/* 手机号 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputField}
                  placeholder="请输入手机号"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                  placeholderTextColor="#999"
                />
              </View>

              {/* 密码 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputField}
                  placeholder="请输入密码"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  editable={!isLoading}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <Ionicons
                    name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={scaleFont(20)}
                    color="#888"
                    style={styles.icon}
                  />
                </TouchableOpacity>
              </View>

              {/* 确认密码 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputField}
                  placeholder="确认密码"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!isConfirmPasswordVisible}
                  editable={!isLoading}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                >
                  <Ionicons
                    name={isConfirmPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={scaleFont(20)}
                    color="#888"
                    style={styles.icon}
                  />
                </TouchableOpacity>
              </View>

              {/* 已有账号 */}
              <View style={styles.linksContainer}>
                <View />
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.linkText}>已有账号？</Text>
                </TouchableOpacity>
              </View>

              {/* 注册按钮 */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={isButtonDisabled}
                style={[styles.registerButtonWrapper, isButtonDisabled && styles.disabledButton]}
              >
                <LinearGradient
                  colors={["#FFEFB0", "#FFF9E5"]}
                  style={styles.registerButtonGradient}
                >
                  <Text style={styles.registerButtonText}>
                    {isLoading ? "注册中..." : "注册账号"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* 协议 */}
              <View style={styles.agreementContainer}>
                <TouchableOpacity onPress={() => setIsChecked(!isChecked)} style={styles.checkbox}>
                  <Ionicons
                    name={isChecked ? "checkbox" : "square-outline"}
                    size={scaleFont(16)}
                    color={isChecked ? "#007AFF" : "#888"}
                  />
                </TouchableOpacity>
                <Text style={styles.agreementText}>
                  我已阅读并同意{" "}
                  <Text style={styles.agreementLink}>隐私政策与服务条款</Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scaleHeight(30),
  },
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: scaleWidth(25),
    paddingTop: isSmallDevice ? scaleHeight(20) : scaleHeight(40),
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
    alignItems: "center",
    justifyContent: "center",
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

  // Title
  title: {
    fontSize: typography.fontSize24,
    fontWeight: typography.fontWeight700,
    marginBottom: isSmallDevice ? scaleHeight(16) : scaleHeight(22),
    color: colors.text.blackMedium,
  },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: scaleHeight(isSmallDevice ? 46 : 50),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius25,
    marginBottom: isSmallDevice ? scaleHeight(10) : scaleHeight(14),
    paddingHorizontal: scaleWidth(18),
    shadowColor: colors.shadow.blue,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  inputField: {
    flex: 1,
    fontSize: typography.fontSize15,
    color: colors.text.dark,
    height: "100%",
  },
  icon: {
    marginLeft: scaleWidth(10),
  },

  // Links
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: isSmallDevice ? scaleHeight(16) : scaleHeight(22),
    paddingHorizontal: scaleWidth(15),
  },
  linkText: {
    color: colors.text.grayDark,
    fontSize: typography.fontSize13,
  },

  // Register Button
  registerButtonWrapper: {
    width: "100%",
    height: scaleHeight(isSmallDevice ? 46 : 50),
    borderRadius: borders.radius25,
    shadowColor: colors.shadow.blue,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: scaleHeight(-10),
    overflow: "hidden",
  },
  registerButtonGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borders.radius25,
    borderWidth: 1,
    borderColor: colors.background.white,
  },
  registerButtonText: {
    color: colors.text.dark,
    fontSize: typography.fontSize15,
    fontWeight: typography.fontWeight700,
  },
  disabledButton: {
    opacity: 0.6,
  },

  // Agreement
  agreementContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: isSmallDevice ? scaleHeight(12) : scaleHeight(18),
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: scaleWidth(10),
  },
  checkbox: {
    padding: scaleWidth(5),
  },
  agreementText: {
    marginLeft: scaleWidth(8),
    color: colors.text.grayDark,
    fontSize: typography.fontSize13,
    flexShrink: 1,
  },
  agreementLink: {
    color: colors.functional.blue,
  },
});
