import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { readUsers } from '../../api/User';
import { sendChatMessage } from '../../api/Chat';
import { Emitter } from '../../services/EventEmitter';
import WebSocketManager from '../../services/WebSocketManager';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore';

const { width } = Dimensions.get('window');

// 格式化时间
const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function CallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // ✅ 1. 明确参数定义
  const {
    isIncoming,      // true=来电, false=去电
    callerId,        // 来电时的对方ID
    targetId,        // 去电时的对方ID
    chatId,          // 聊天室ID
    userName: paramName,   // 预传名字
    userAvatar: paramAvatar // 预传头像
  } = route.params || {};

  // ✅ 2. 统一使用 remoteUserId 代表“对方”
  // 无论是打出去还是接进来，我们只关心屏幕上显示的那个“对方”是谁
  const remoteUserId = isIncoming ? callerId : targetId;

  const getContactById = useContactStore(state => state.getContactById);
  const currentUser = useUserStore(state => state.user);
  const currentUserId = currentUser?.id || '';

  const [status, setStatus] = useState(isIncoming ? 'Ringing...' : 'Calling...');

  // UI 显示信息 (优先使用路由传过来的参数)
  const [displayName, setDisplayName] = useState<string>(paramName || '未知用户');
  const [displayAvatar, setDisplayAvatar] = useState<string>(paramAvatar || '');
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // 计时器
  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 3. 获取用户信息逻辑优化
  const fetchUserInfo = useCallback(async (userId: string) => {
    // 如果已有信息（从路由传过来的），就不重新请求了
    if (paramName && paramAvatar) return;

    const localContact = getContactById(userId);
    if (localContact && localContact.name) {
      setDisplayName(localContact.name);
      setDisplayAvatar(localContact.avatar || '');
      return;
    }

    setLoadingUserInfo(true);
    try {
      const result = await readUsers(userId);
      if (result.success && result.data) {
        let userData = result.data.response || result.data;
        const name = userData.name || userData.username || userData.nickname || '';
        const avatar = userData.image || userData.avatar || '';

        setDisplayName(name || '未知用户');
        setDisplayAvatar(avatar);
      }
    } catch (error) {
      console.log('Fetch user error', error);
    } finally {
      setLoadingUserInfo(false);
    }
  }, [getContactById, paramName, paramAvatar]);

  // 计时器逻辑
  const startTimer = () => {
    stopTimer();
    setDurationSeconds(0);
    durationRef.current = 0;
    timerRef.current = setInterval(() => {
      setDurationSeconds(prev => {
        const next = prev + 1;
        durationRef.current = next;
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ✅ 4. 核心初始化逻辑
  useEffect(() => {
    if (!remoteUserId) return;

    // A. 立即发起呼叫 (如果是去电)
    if (!isIncoming) {
      console.log('📞 发起呼叫:', remoteUserId);

      // 🚨 关键修复：直接使用 paramName 或 displayName，而不是依赖可能还没更新的 state
      // 这里的逻辑确保发送给对方的信令里包含“我方”认为的“对方”名字（这通常不重要，重要的是startCall内部应该传“我方”的信息）
      // 其实 WebSocketManager.startCall 内部应该负责把 CURRENT USER 的名字发给对方
      // 但如果你的 startCall 接口设计是传 target 的信息，那就照传

      WebSocketManager.startCall(
        remoteUserId,
        paramName || displayName,
        paramAvatar || displayAvatar
      );

      // 同时去获取一下最新信息
      fetchUserInfo(remoteUserId);
    } else {
      // B. 如果是来电，只获取信息
      console.log('📞 收到来电:', remoteUserId);
      fetchUserInfo(remoteUserId);
    }

    // C. 监听状态
    const handleCallStatus = (newStatus: string) => {
      setStatus(newStatus);
      if (newStatus === 'Connected' || newStatus === '通话中') {
        startTimer();
      }
    };

    const handleEndCall = () => {
      console.log('Call Ended Signal Received');
      stopTimer();
      setStatus('Ended');
      setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, 800);
    };

    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('endCall', handleEndCall);

    return () => {
      stopTimer();
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('endCall', handleEndCall);
    };
  }, [remoteUserId, isIncoming, fetchUserInfo, navigation]); // 移除 displayName 依赖，防止死循环

  // 接听
  const answer = () => {
    WebSocketManager.callService?.answerCall();
    setStatus('Connecting...');
  };

  // 拒接
  const reject = () => {
    WebSocketManager.callService?.rejectCall();
    stopTimer();
    navigation.goBack();
  };

  // 挂断
  const hangup = async () => {
    const finalDuration = formatDuration(durationRef.current);
    const isCallConnected = durationRef.current > 0;

    if (chatId && isCallConnected) {
      const endCallData = JSON.stringify({
        type: 'SINGLE_VOICE_CALL',
        roomId: chatId,
        hostName: currentUser?.name,
        status: 'ended',
        duration: finalDuration,
        startTime: new Date().toISOString()
      });

      // 发送消息
      sendChatMessage({
        sender: currentUserId,
        isreceive: [remoteUserId],
        chat_id: chatId,
        message: endCallData,
        type: 4
      }).catch(err => console.error('发送通话结束消息失败', err));
    }

    WebSocketManager.callService?.cleanup();
  };

  // 翻译状态
  const translateStatus = (st: string) => {
    const statusMap: { [key: string]: string } = {
      'Calling...': '正在呼叫...',
      'Ringing...': '对方手机响铃中...',
      'Connected': '通话中',
      'Connecting...': '连接中...',
      'Ended': '通话结束',
      'Rejected': '对方已拒绝',
      'Busy': '对方忙碌中',
      'No Answer': '无人接听',
    };
    return statusMap[st] || st;
  };

  // 按钮显示逻辑
  const showAnswerReject = isIncoming && (status === 'Ringing...' || status === '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* 顶部：显示对方信息 */}
        <View style={styles.topSection}>
          {loadingUserInfo ? (
            <View style={styles.avatar}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.username}>{displayName}</Text>

          {/* 状态或计时 */}
          <Text style={styles.statusText}>
            {status === 'Connected' || status === '通话中'
              ? formatDuration(durationSeconds)
              : (isIncoming && status === 'Ringing...' ? '邀请你语音通话...' : translateStatus(status))}
          </Text>
        </View>

        {/* 底部按钮 */}
        <View style={styles.bottomSection}>
          {showAnswerReject ? (
            // 来电：显示接听和拒绝
            <View style={styles.incomingButtons}>
              <TouchableOpacity style={styles.rejectButton} onPress={reject}>
                <View style={styles.buttonCircle}>
                  <Text style={styles.buttonIcon}>✕</Text>
                </View>
                <Text style={styles.buttonLabel}>拒接</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.answerButton} onPress={answer}>
                <View style={[styles.buttonCircle, styles.answerCircle]}>
                  <Text style={styles.buttonIcon}>✓</Text>
                </View>
                <Text style={styles.buttonLabel}>接听</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 拨出或通话中：显示挂断
            <View style={styles.outgoingButtons}>
              <TouchableOpacity style={styles.hangupButton} onPress={hangup}>
                <View style={[styles.buttonCircle, styles.hangupCircle]}>
                  <Text style={styles.buttonIcon}>✕</Text>
                </View>
                <Text style={styles.buttonLabel}>挂断</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... 样式保持不变 ...
  container: { flex: 1, backgroundColor: '#2C2C2C' },
  contentContainer: { flex: 1, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', marginTop: 100 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4A4A4A', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: '#4A4A4A' },
  avatarText: { fontSize: 40, color: '#FFFFFF', fontWeight: '500' },
  username: { fontSize: 28, color: '#FFFFFF', fontWeight: '500', marginBottom: 12 },
  statusText: { fontSize: 18, color: '#FFFFFF', marginTop: 8, fontVariant: ['tabular-nums'] },
  bottomSection: { paddingBottom: 60, alignItems: 'center' },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-around', width: width * 0.8 },
  outgoingButtons: { alignItems: 'center' },
  buttonCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  answerCircle: { backgroundColor: '#07C160' },
  hangupCircle: { backgroundColor: '#FF3B30' },
  buttonIcon: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  buttonLabel: { fontSize: 14, color: '#FFFFFF', marginTop: 4 },
  rejectButton: { alignItems: 'center' },
  answerButton: { alignItems: 'center' },
  hangupButton: { alignItems: 'center' },
});