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
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, borders, typography } from "../../styles";
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
  const [isLoading, setIsLoading] = useState(false); // Changed to useState

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

    console.log("Data to be sent to backend:", postData);

    try {
      // Call API
      const res = await createUser(postData);

      // Log FULL backend response
      console.log("=== FULL BACKEND RESPONSE ===");
      console.log(JSON.stringify(res, null, 2));
      console.log("res.success:", res.success);
      console.log("res.message:", res.message);
      console.log("res.error:", res.error);
      console.log("res.data:", res.data);
      console.log("res.user_id:", res.user_id);
      console.log("res.token:", res.token);

      // Check if the message indicates success (case-insensitive)
      const messageText = (res.message || res.error || "").toUpperCase();
      const isSuccess = messageText.includes("SUCCESS") ||
        messageText.includes("SUCCESSFUL") ||
        res.success === true ||
        res.data?.success === true;

      if (isSuccess) {
        console.log("✅ Registration successful!");

        // Extract user_id from response (check different possible locations)
        const userId = res.user_id ||
          res.data?.user_id ||
          res.data?.response?.user_id ||
          res.data?.data?.user_id;

        const token = res.token ||
          res.data?.token ||
          res.data?.response?.token ||
          "";

        console.log("Extracted user_id:", userId);
        console.log("Extracted token:", token);

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
          console.log("✅ Store updated with user data");
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
    } catch (error) {
      console.error("❌ Registration error:", error);
      Alert.alert("错误", "注册失败，请稍后重试");
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

  // Background shapes
  bgShape1: {
    position: "absolute",
    width: scaleWidth(350),
    height: scaleWidth(350),
    borderRadius: borders.radius60,
    backgroundColor: colors.background.transparentWhite50,
    top: scaleHeight(-100),
    right: scaleWidth(-120),
    transform: [{ rotate: "45deg" }],
  },
  bgShape2: {
    position: "absolute",
    width: scaleWidth(300),
    height: scaleWidth(300),
    borderRadius: borders.radius60,
    backgroundColor: colors.background.transparentWhite70,
    top: scaleHeight(50),
    left: scaleWidth(-150),
    transform: [{ rotate: "30deg" }],
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
