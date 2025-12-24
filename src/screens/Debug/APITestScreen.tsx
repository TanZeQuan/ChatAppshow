/**
 * API Connection Diagnostic Component
 *
 * Add this to your app to test API connectivity
 *
 * Usage:
 * import { testAPIConnection } from './api/TestConnection';
 *
 * // In your component
 * useEffect(() => {
 *   testAPIConnection();
 * }, []);
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { testAPIConnection } from '../api/TestConnection';
import { API_BASE_URL } from '../api/service';

export const APITestScreen = () => {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    const result = await testAPIConnection();
    setTestResult(result);
    setTesting(false);

    if (!result.success) {
      Alert.alert('连接失败', result.message);
    } else {
      Alert.alert('连接成功', 'API 可以访问！');
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API 连接测试</Text>
      <Text style={styles.url}>API URL: {API_BASE_URL}</Text>

      <Button
        title={testing ? "测试中..." : "重新测试"}
        onPress={runTest}
        disabled={testing}
      />

      {testResult && (
        <View style={styles.result}>
          <Text style={[styles.status, testResult.success ? styles.success : styles.error]}>
            状态: {testResult.success ? '成功 ✅' : '失败 ❌'}
          </Text>
          <Text style={styles.message}>{testResult.message}</Text>
          {testResult.error && (
            <Text style={styles.errorCode}>错误代码: {testResult.error}</Text>
          )}
        </View>
      )}

      {testResult && !testResult.success && (
        <View style={styles.troubleshooting}>
          <Text style={styles.troubleshootingTitle}>故障排除步骤：</Text>
          <Text style={styles.troubleshootingItem}>1. 检查后端服务器是否运行</Text>
          <Text style={styles.troubleshootingItem}>2. 检查 ngrok 是否运行</Text>
          <Text style={styles.troubleshootingItem}>3. 确认 API URL 正确</Text>
          <Text style={styles.troubleshootingItem}>4. 确认设备可以访问互联网</Text>
          <Text style={styles.troubleshootingItem}>5. 尝试在浏览器中打开 ngrok URL</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  url: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  result: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  status: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  success: {
    color: 'green',
  },
  error: {
    color: 'red',
  },
  message: {
    fontSize: 14,
    color: '#333',
  },
  errorCode: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  troubleshooting: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  troubleshootingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  troubleshootingItem: {
    fontSize: 14,
    marginBottom: 5,
  },
});
