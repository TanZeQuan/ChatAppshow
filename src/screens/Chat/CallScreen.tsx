import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { readUsers } from '../../api/User';
import { sendChatMessage } from '../../api/Chat'; // ✅ 引入发送消息 API
import { Emitter } from '../../services/EventEmitter';
import WebSocketManager from '../../services/WebSocketManager';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore'; // ✅ 引入用户 Store

const { width, height } = Dimensions.get('window');

// ✅ 辅助函数：格式化时间
const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function CallScreen() {
  const getContactById = useContactStore(state => state.getContactById);
  const currentUser = useUserStore(state => state.user); // ✅ 获取当前用户
  const currentUserId = currentUser?.id || '';

  const [modalVisible, setModalVisible] = useState(false);
  const [status, setStatus] = useState('');
  const [callerId, setCallerId] = useState('');
  const [isIncoming, setIsIncoming] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  
  // ✅ 新增：保存当前的 ChatId，用于发消息
  const [currentChatId, setCurrentChatId] = useState<string>('');

  // 用户信息状态
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // ✅ 新增：计时器状态
  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取用户信息
  const fetchUserInfo = useCallback(async (userId: string) => {
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
        
        if (name) {
          setUserName(name);
          setUserAvatar(avatar);
        } else {
          setUserName(userId);
          setUserAvatar('');
        }
      }
    } catch (error) {
      setUserName(userId);
    } finally {
      setLoadingUserInfo(false);
    }
  }, [getContactById]);

  // ✅ 计时器逻辑
  const startTimer = () => {
    stopTimer(); // 防止重复
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

  useEffect(() => {
    // 监听来电
    const handleIncomingCall = (data: any) => {
      // data 可能是对象 { callerId, chatId } 或 纯字符串 callerId
      const incomingId = typeof data === 'object' ? data.callerId : data;
      const chatId = typeof data === 'object' ? data.chatId : data; // 假设来电带了 chatId

      setCallerId(incomingId);
      setTargetUserId(incomingId);
      setCurrentChatId(chatId); // 保存 chatId
      setIsIncoming(true);
      setModalVisible(true);
      fetchUserInfo(incomingId);
    };

    // 监听通话状态
    const handleCallStatus = (newStatus: string) => {
      setStatus(newStatus);
      // ✅ 如果接通了，开始计时
      if (newStatus === 'Connected' || newStatus === '通话中') {
        startTimer();
      }
    };

    // 监听拨打电话
    const handleStartCall = (data: any) => {
      // data 可能是对象 { targetId, chatId } 或 纯字符串
      const targetId = typeof data === 'object' ? data.targetId : data;
      const chatId = typeof data === 'object' ? data.chatId : targetId; // 如果没有 chatId，通常单聊 chatId 就是对方 ID (视后端逻辑而定)

      setTargetUserId(targetId);
      setCurrentChatId(chatId);
      setIsIncoming(false);
      setModalVisible(true);
      fetchUserInfo(targetId);
    };
    
    // 监听挂断
    const handleEndCall = () => {
      stopTimer();
      setModalVisible(false);
      setStatus('');
      setCallerId('');
      setIsIncoming(false);
      setUserName('');
      setUserAvatar('');
      setDurationSeconds(0);
    };

    Emitter.on('incomingCall', handleIncomingCall);
    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('startCall', handleStartCall);
    Emitter.on('endCall', handleEndCall);

    return () => {
      stopTimer();
      Emitter.off('incomingCall', handleIncomingCall);
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('startCall', handleStartCall);
      Emitter.off('endCall', handleEndCall);
    };
  }, [fetchUserInfo]);

  const answer = () => {
    WebSocketManager.callService?.answerCall();
    setIsIncoming(false);
  };

  const reject = () => {
    WebSocketManager.callService?.rejectCall();
    setModalVisible(false);
    stopTimer();
  };

  // ✅ 挂断逻辑：发送“通话结束”消息
  const hangup = async () => {
    // 1. 获取最终时长
    const finalDuration = formatDuration(durationRef.current);
    const isCallConnected = durationRef.current > 0; // 只有通过话才显示时长

    // 2. 发送消息到聊天室 (仅当我们有 chatId 时)
    if (currentChatId) {
        const endCallData = JSON.stringify({
            type: 'SINGLE_VOICE_CALL', // ✅ 区分单聊类型
            roomId: currentChatId,
            hostName: currentUser?.name,
            status: 'ended',
            duration: isCallConnected ? finalDuration : '未接通',
            startTime: new Date().toISOString()
        });

        // 异步发送，不阻塞 UI 关闭
        sendChatMessage({
            sender: currentUserId,
            isreceive: [targetUserId!], // 单聊发给对方
            chat_id: currentChatId,
            message: endCallData,
            type: 4 // 保持类型 4 (卡片类型)
        }).catch(err => console.error('发送通话结束消息失败', err));
    }

    // 3. 清理连接 & 关闭 UI
    WebSocketManager.callService?.cleanup();
    setModalVisible(false);
    stopTimer();
  };

  // 翻译状态文本
  const translateStatus = (status: string) => {
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
    return statusMap[status] || status;
  };

  const displayName = userName || targetUserId || '未知用户';

  return (
    <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={hangup}>
      <View style={styles.container}>
        {/* 顶部用户信息区域 */}
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
          
          {/* ✅ 状态显示：如果是通话中，显示计时器；否则显示状态文本 */}
          <Text style={styles.statusText}>
            {status === 'Connected' || status === '通话中' 
              ? formatDuration(durationSeconds) 
              : (isIncoming ? '邀请你语音通话...' : translateStatus(status) || '等待接听...')}
          </Text>
        </View>

        {/* 底部按钮区域 */}
        <View style={styles.bottomSection}>
          {isIncoming ? (
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2C2C2C' },
  topSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4A4A4A', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: '#4A4A4A' },
  avatarText: { fontSize: 40, color: '#FFFFFF', fontWeight: '500' },
  
  username: { fontSize: 28, color: '#FFFFFF', fontWeight: '500', marginBottom: 12 },
  
  // ✅ 计时器/状态字体样式优化
  statusText: { fontSize: 18, color: '#FFFFFF', marginTop: 8, fontVariant: ['tabular-nums'] },

  bottomSection: { paddingBottom: 60, alignItems: 'center' },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-around', width: width * 0.8 },
  outgoingButtons: { alignItems: 'center' },
  buttonCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E74C3C', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  answerCircle: { backgroundColor: '#07C160' },
  hangupCircle: { backgroundColor: '#E74C3C' },
  buttonIcon: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  buttonLabel: { fontSize: 14, color: '#FFFFFF', marginTop: 4 },
  rejectButton: { alignItems: 'center' },
  answerButton: { alignItems: 'center' },
  hangupButton: { alignItems: 'center' },
});