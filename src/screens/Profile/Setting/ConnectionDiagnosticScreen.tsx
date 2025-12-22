import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, borders, typography } from '../../styles';
import {
  runAllDiagnostics,
  formatDiagnosticResults,
  DiagnosticResult,
} from '../../utils/connectionDiagnostics';
import { useUserStore } from '../../store/userStore';
import config from '../../config/api';

export default function ConnectionDiagnosticScreen() {
  const navigation = useNavigation();
  const user = useUserStore((state) => state.user);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      const diagnosticResults = await runAllDiagnostics(user?.id);
      setResults(diagnosticResults);

      // Show summary alert
      const allSuccess = diagnosticResults.every((r) => r.status === 'success');
      if (allSuccess) {
        Alert.alert('✅ 诊断成功', '所有连接测试通过！');
      } else {
        Alert.alert('❌ 诊断失败', '部分连接测试失败，请查看详情');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '诊断过程出错');
    } finally {
      setIsRunning(false);
    }
  };

  const copyResults = () => {
    const formattedResults = formatDiagnosticResults(results);
    // In a real app, you'd use Clipboard API
    Alert.alert('结果', formattedResults);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
      case 'warning':
        return <Ionicons name="warning" size={24} color="#FF9800" />;
      case 'failed':
        return <Ionicons name="close-circle" size={24} color="#F44336" />;
      default:
        return <Ionicons name="help-circle" size={24} color="#999" />;
    }
  };

  return (
    <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>连接诊断</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Configuration Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>当前配置</Text>
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>API URL:</Text>
              <Text style={styles.configValue}>{config.API_BASE_URL}</Text>
            </View>
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>WebSocket URL:</Text>
              <Text style={styles.configValue}>{config.WS_URL}</Text>
            </View>
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>用户 ID:</Text>
              <Text style={styles.configValue}>{user?.id || '未登录'}</Text>
            </View>
          </View>

          {/* Run Diagnostics Button */}
          <TouchableOpacity
            onPress={runDiagnostics}
            disabled={isRunning}
            style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          >
            {isRunning ? (
              <ActivityIndicator color="#333" />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color="#333" />
                <Text style={styles.runButtonText}>运行诊断测试</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Results */}
          {results.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>诊断结果</Text>
                <TouchableOpacity onPress={copyResults}>
                  <Ionicons name="copy-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {results.map((result, index) => (
                <View key={index} style={styles.resultItem}>
                  <View style={styles.resultHeader}>
                    {getStatusIcon(result.status)}
                    <Text style={styles.resultTitle}>{result.test}</Text>
                  </View>
                  <Text style={styles.resultMessage}>{result.message}</Text>
                  {result.details && (
                    <View style={styles.resultDetails}>
                      <Text style={styles.detailsTitle}>详细信息:</Text>
                      {Object.entries(result.details).map(([key, value]) => (
                        <Text key={key} style={styles.detailsText}>
                          • {key}: {JSON.stringify(value)}
                        </Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.timestamp}>{new Date(result.timestamp).toLocaleString('zh-CN')}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Troubleshooting Tips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>常见问题</Text>
            <View style={styles.tipItem}>
              <Ionicons name="alert-circle-outline" size={20} color="#FF9800" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>WebSocket 连接失败</Text>
                <Text style={styles.tipText}>
                  1. 检查后端 WebSocket 服务器是否运行{'\n'}
                  2. 验证 ngrok 隧道是否激活{'\n'}
                  3. 确认 URL 是否正确
                </Text>
              </View>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="alert-circle-outline" size={20} color="#FF9800" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>API 连接失败</Text>
                <Text style={styles.tipText}>
                  1. 检查后端 API 服务器是否运行{'\n'}
                  2. 验证网络连接{'\n'}
                  3. 确认防火墙设置
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.yellowBright,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.grayLight,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: colors.background.white,
    borderRadius: borders.radius12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginBottom: 12,
  },
  configItem: {
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: typography.fontWeight500,
    color: colors.text.grayDark,
    marginBottom: 4,
  },
  configValue: {
    fontSize: 13,
    color: colors.text.blackMedium,
    fontFamily: 'monospace',
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.functional.green,
    borderRadius: borders.radius12,
    padding: 16,
    marginBottom: 16,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginLeft: 8,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: colors.border.grayLight,
    borderRadius: borders.radius8,
    padding: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginLeft: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: colors.text.grayDark,
    marginBottom: 8,
  },
  resultDetails: {
    backgroundColor: colors.background.grayLight,
    borderRadius: borders.radius4,
    padding: 8,
    marginTop: 8,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: typography.fontWeight500,
    color: colors.text.blackMedium,
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12,
    color: colors.text.grayDark,
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 11,
    color: colors.text.grayMedium,
    marginTop: 8,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: colors.text.grayDark,
    lineHeight: 20,
  },
});
