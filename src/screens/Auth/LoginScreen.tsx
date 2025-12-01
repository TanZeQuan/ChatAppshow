import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setUser } = useUserStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    if (email && password) {
      const userData = {
        id: '1',
        username: 'ZeQuan',
        avatar: 'https://i.pravatar.cc/150',
        email: email,
        name: 'ZeQuan Li',
      };
      const token = 'dummy-token-123';

      setUser(userData, token);

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } else {
      alert('Please enter email and password');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back 👋</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity onPress={onLogin} style={styles.btn}>
        <Text style={styles.btnText}>Login</Text>
      </TouchableOpacity>

      {/* Register Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
        style={{ marginTop: 20 }}
      >
        <Text style={styles.registerText}>
          Don&apos;t have an account? <Text style={{ color: '#2F80ED' }}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  input: {
    height: 50,
    backgroundColor: '#F2F4F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  btn: { backgroundColor: '#2F80ED', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  registerText: { fontSize: 14, textAlign: 'center', color: '#444' },
});
