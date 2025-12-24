/**
 * Message Send Test Component
 *
 * This component tests different types of message sending
 * to help diagnose the Network Error issue
 */

import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { sendChatMessage } from '../api/Chat';
import { API_BASE_URL } from '../api/service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MessageTestScreen = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (test: string, success: boolean, message: string, details?: any) => {
    setTestResults(prev => [...prev, { test, success, message, details, timestamp: new Date().toISOString() }]);
  };

  const testTextMessage = async () => {
    setTesting(true);
    console.log('🧪 [Test] Starting text message test...');

    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        addResult('Text Message', false, 'User not logged in');
        setTesting(false);
        return;
      }

      const result = await sendChatMessage({
        sender: userId,
        isreceive: [userId], // Send to self for testing
        chat_id: 'TEST_CHAT',
        message: 'Test message from diagnostic tool',
      });

      if (result.success) {
        addResult('Text Message', true, 'Text message sent successfully', result.data);
        Alert.alert('成功', '文本消息发送成功！');
      } else {
        addResult('Text Message', false, result.message || 'Failed', result);
        Alert.alert('失败', result.message || '文本消息发送失败');
      }
    } catch (error: any) {
      addResult('Text Message', false, error.message, error);
      Alert.alert('错误', error.message);
    }

    setTesting(false);
  };

  const testAPIConnection = async () => {
    setTesting(true);
    console.log('🧪 [Test] Testing API connection...');

    try {
      const axios = require('axios');
      const response = await axios.get(API_BASE_URL.replace('/api', ''), {
        timeout: 10000,
      });

      addResult('API Connection', true, 'API is reachable', { status: response.status });
      Alert.alert('成功', 'API 连接正常！');
    } catch (error: any) {
      addResult('API Connection', false, error.message, error);
      Alert.alert('失败', `无法连接到 API: ${error.message}`);
    }

    setTesting(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>消息发送诊断工具</Text>
      <Text style={styles.subtitle}>API URL: {API_BASE_URL}</Text>

      <View style={styles.buttonContainer}>
        <Button
          title="测试 API 连接"
          onPress={testAPIConnection}
          disabled={testing}
        />
        <View style={styles.spacer} />
        <Button
          title="测试文本消息"
          onPress={testTextMessage}
          disabled={testing}
        />
        <View style={styles.spacer} />
        <Button
          title="清除结果"
          onPress={clearResults}
          color="#999"
        />
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>测试结果:</Text>
        {testResults.length === 0 && (
          <Text style={styles.noResults}>暂无测试结果</Text>
        )}
        {testResults.map((result, index) => (
          <View
            key={index}
            style={[
              styles.resultItem,
              result.success ? styles.resultSuccess : styles.resultError
            ]}
          >
            <Text style={styles.resultTest}>
              {result.success ? '✅' : '❌'} {result.test}
            </Text>
            <Text style={styles.resultMessage}>{result.message}</Text>
            <Text style={styles.resultTime}>
              {new Date(result.timestamp).toLocaleTimeString()}
            </Text>
            {result.details && (
              <Text style={styles.resultDetails}>
                {JSON.stringify(result.details, null, 2)}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>常见问题：</Text>
        <Text style={styles.infoItem}>
          1. Network Error - 无法连接到服务器
        </Text>
        <Text style={styles.infoItem}>
          2. Timeout - 请求超时
        </Text>
        <Text style={styles.infoItem}>
          3. 401 - 未授权（token 问题）
        </Text>
        <Text style={styles.infoItem}>
          4. 404 - 端点不存在
        </Text>
        <Text style={styles.infoItem}>
          5. 500 - 服务器错误
        </Text>
      </View>
    </ScrollView>
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  spacer: {
    height: 10,
  },
  resultsContainer: {
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noResults: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  resultItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  resultError: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  resultTest: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultMessage: {
    fontSize: 14,
    marginBottom: 5,
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
  },
  resultDetails: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  infoContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoItem: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
});
