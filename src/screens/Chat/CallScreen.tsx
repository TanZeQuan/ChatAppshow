import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readUsers } from '../../api/User';
import { sendChatMessage } from '../../api/Chat';
import { Emitter } from '../../services/EventEmitter';
import WebSocketManager from '../../services/WebSocketManager';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// 辅助函数：格式化时间
const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function CallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // ✅ 路由参数
  const {
    callerId,     // 对方ID (来电时是呼叫方ID，拨出时是被呼叫方ID)
    chatId,       // 聊天室ID
    isIncoming,   // 是否是来电
    callerName,   // 预传名字 (可选)
    callerAvatar  // 预传头像 (可选)
  } = route.params || {};

  const getContactById = useContactStore(state => state.getContactById);
  const currentUser = useUserStore(state => state.user);
  const currentUserId = currentUser?.id || '';

  // ✅ 状态管理
  const [status, setStatus] = useState(isIncoming ? 'Ringing...' : 'Calling...');
  const [userName, setUserName] = useState<string>(callerName || '');
  const [userAvatar, setUserAvatar] = useState<string>(callerAvatar || '');
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // 计时器
  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 获取对方用户信息
  const fetchUserInfo = useCallback(async (userId: string) => {
    if (userName && userAvatar) return;

    const localContact = getContactById(userId);
    if (localContact && localContact.name) {
      setUserName(localContact.name);
      setUserAvatar(localContact.avatar || '');
      return;
    }

    setLoadingUserInfo(true);
    try {
      const result = await readUsers(userId);
      if (result.success && result.data) {
        let userData = result.data.response || result.data;
        const name = userData.name || userData.username || userData.nickname || '';
        const avatar = userData.image || userData.avatar || '';

        setUserName(name || userId);
        setUserAvatar(avatar);
      }
    } catch (error) {
      setUserName(userId);
    } finally {
      setLoadingUserInfo(false);
    }
  }, [getContactById, userName, userAvatar]);

  // ✅ 计时器
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

  // ✅ 初始化
  useEffect(() => {
    if (!callerId) return;

    const targetId = callerId;

    const initCall = async () => {
      // 1️⃣ 拨出呼叫
      if (!isIncoming) {
        console.log('📞 发起呼叫:', targetId);

        await fetchUserInfo(targetId); // Ensure user info is fetched

        WebSocketManager.startCall(
          targetId,
          userName, // Use the state variable that will be updated by fetchUserInfo
          userAvatar // Use the state variable that will be updated by fetchUserInfo
        );
      }

      // 2️⃣ 来电
      else {
        console.log('📞 收到来电:', targetId);
        await fetchUserInfo(targetId);
      }
    };

    initCall();

    // 监听通话状态
    const handleCallStatus = (newStatus: string) => {
      setStatus(newStatus);
      if (newStatus === 'Connected' || newStatus === '通话中') {
        startTimer();
      }
    };

    const handleEndCall = () => {
      stopTimer();
      setStatus('Ended');
    };

    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('endCall', handleEndCall);

    return () => {
      stopTimer();
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('endCall', handleEndCall);
    };
  }, [callerId, isIncoming]);


  // ✅ 接听
  const answer = () => {
    WebSocketManager.callService?.answerCall();
    setStatus('Connecting...');
  };

  // ✅ 拒接
  const reject = () => {
    WebSocketManager.callService?.rejectCall();
    stopTimer();
    navigation.goBack();
  };

  // ✅ 挂断
  const hangup = async () => {
    const finalDuration = formatDuration(durationRef.current);
    const isCallConnected = durationRef.current > 0;

    if (chatId) {
      const endCallData = JSON.stringify({
        type: 'SINGLE_VOICE_CALL',
        roomId: chatId,
        hostName: currentUser?.name,
        status: 'ended',
        duration: isCallConnected ? finalDuration : '未接通',
        startTime: new Date().toISOString()
      });

      sendChatMessage({
        sender: currentUserId,
        isreceive: [callerId],
        chat_id: chatId,
        message: endCallData,
        type: 4
      }).catch(err => console.error('发送通话结束消息失败', err));
    }

    WebSocketManager.callService?.cleanup();
    stopTimer();
    navigation.goBack();
  };

  // ✅ 翻译状态
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

  const displayName = userName || callerId || '未知用户';

  // ✅ 判断是否显示接听/拒绝按钮
  const showAnswerReject = isIncoming && (status === 'Ringing...' || status === '');
  const showHangup = !showAnswerReject; // 其他情况都显示挂断

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* 顶部：显示对方信息 */}
        <View style={styles.topSection}>
          {loadingUserInfo ? (
            <View style={styles.avatar}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
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