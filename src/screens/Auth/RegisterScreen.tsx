import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function RegisterScreen() {
  const navigation = useNavigation<any>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onRegister = () => {
    console.log("Register:", { name, email, password });
    // 调用 API 注册
    // 保存 user/token 到 Zustand
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account ✨</Text>
      <Text style={styles.subtitle}>Join our chat community</Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Enter name"
        style={styles.input}
      />

      {/* Email */}
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter email"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* Password */}
      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Enter password"
        secureTextEntry
        style={styles.input}
      />

      {/* Register */}
      <TouchableOpacity style={styles.btn} onPress={onRegister}>
        <Text style={styles.btnText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Go Login */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ marginTop: 20 }}
      >
        <Text style={styles.link}>
          Already have an account?{" "}
          <Text style={{ color: "#2F80ED" }}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    marginTop: 12,
    color: "#444",
  },
  input: {
    height: 50,
    backgroundColor: "#F2F4F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#2F80ED",
    paddingVertical: 14,
    marginTop: 30,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  link: {
    fontSize: 14,
    textAlign: "center",
    color: "#444",
  },
});
