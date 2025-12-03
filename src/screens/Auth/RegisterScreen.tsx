import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { createUser } from "../../api/User";
import { useUserStore } from '../../store/userStore';

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

  const handleCreateUser = async () => {
    if (!isChecked) {
      Alert.alert("请先同意隐私政策与服务条款");
      return;
    }

    if (!name || !email || !phone || !password || !confirmPassword) {
      Alert.alert("请填写完整信息");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);
    try {
      console.log("发送到后端的数据:", { phone: phone, passcode: password, username: name, email: email });

      const result = await createUser({
        phone: phone,
        passcode: password,
        username: name,
        email: email,
      });

      console.log("后端返回:", result);

      if (result.success) {
        console.log("用户创建成功:", result.response);

        // ⭐ 保存到 store（假设 store 有 setUser 方法）
        useUserStore.getState().setUser(
          {
            id: result.response,   // 后端返回的用户ID
            username: name,
            phone,
            email,
          },
          "FAKE_TOKEN" // 注册时没有 token，先用占位
        );

        // 注册成功跳转 Login 页面
        Alert.alert("注册成功", "请登录账号", [
          { text: "确定", onPress: () => navigation.navigate("Login") },
        ]);
      } else {
        console.log("用户创建失败:", result.message);
        Alert.alert("注册失败", result.message);
      }
    } catch (err) {
      console.error("调用 createUser 出错:", err);
      Alert.alert("注册失败", "创建用户时发生错误");
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled =
    isLoading || !name || !email || !phone || !password || !confirmPassword || !isChecked;

  return (
    <LinearGradient colors={["#FFE194", "#FFF9E5", "#FFFFFF"]} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.bgShape1} />
        <View style={styles.bgShape2} />

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
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={styles.linkText}>已有账号？</Text>
                </TouchableOpacity>
              </View>

              {/* 注册按钮 */}
              <TouchableOpacity
                onPress={handleCreateUser}
                disabled={isButtonDisabled}
                style={[styles.registerButtonWrapper, isButtonDisabled && styles.disabledButton]}
              >
                <LinearGradient
                  colors={["#FFFFFF", "#F8F8F8"]}
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
    flex: 1
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
    marginBottom: isSmallDevice ? scaleHeight(12) : scaleHeight(16)
  },
  logoCard: {
    width: scaleWidth(isSmallDevice ? 90 : 110),
    height: scaleWidth(isSmallDevice ? 90 : 110),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(20),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoImage: {
    width: scaleWidth(isSmallDevice ? 92 : 112),
    height: scaleWidth(isSmallDevice ? 92 : 112)
  },

  // Background shapes
  bgShape1: {
    position: "absolute",
    width: scaleWidth(350),
    height: scaleWidth(350),
    borderRadius: scaleWidth(60),
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    top: scaleHeight(-100),
    right: scaleWidth(-120),
    transform: [{ rotate: "45deg" }],
  },
  bgShape2: {
    position: "absolute",
    width: scaleWidth(300),
    height: scaleWidth(300),
    borderRadius: scaleWidth(60),
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    top: scaleHeight(50),
    left: scaleWidth(-150),
    transform: [{ rotate: "30deg" }],
  },

  // Title
  title: {
    fontSize: scaleFont(isSmallDevice ? 22 : 24),
    fontWeight: "700",
    marginBottom: isSmallDevice ? scaleHeight(16) : scaleHeight(22),
    color: "#333333",
  },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: scaleHeight(isSmallDevice ? 46 : 50),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleHeight(25),
    marginBottom: isSmallDevice ? scaleHeight(10) : scaleHeight(14),
    paddingHorizontal: scaleWidth(18),
    shadowColor: "#2F80ED",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  inputField: {
    flex: 1,
    fontSize: scaleFont(15),
    color: "#333333",
    height: "100%",
  },
  icon: {
    marginLeft: scaleWidth(10)
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
    color: "#555555",
    fontSize: scaleFont(13)
  },

  // Register Button
  registerButtonWrapper: {
    width: "100%",
    height: scaleHeight(isSmallDevice ? 46 : 50),
    borderRadius: scaleHeight(25),
    shadowColor: "#2F80ED",
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
    borderRadius: scaleHeight(25),
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  registerButtonText: {
    color: "#333333",
    fontSize: scaleFont(15),
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.6
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
    padding: scaleWidth(5)
  },
  agreementText: {
    marginLeft: scaleWidth(8),
    color: "#666666",
    fontSize: scaleFont(12),
    flexShrink: 1,
  },
  agreementLink: {
    color: "#2F80ED"
  },
});