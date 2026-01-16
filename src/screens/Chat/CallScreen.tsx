import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RTCView } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

// API & Service
import { readUsers } from '../../api/User';
import { createPrivateChat, sendChatMessage, startCall, callRoom } from '../../api/Chat';
import { Emitter } from '../../services/EventEmitter';
import WebSocketManager from '../../services/WebSocketManager';
import TcpSocketService, { TcpServerMessage } from '../../services/TcpSocketService';
import { useContactStore } from '../../store/contactStore';
import { useUserStore } from '../../store/userStore';

const { width } = Dimensions.get('window');

// 格式化时间 00:00
const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function CallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    isIncoming,
    callerId,
    targetId,
    chatId: initialChatId,
    userName: paramName,
    userAvatar: paramAvatar
  } = route.params || {};

  const insets = useSafeAreaInsets();

  // ---------------------------------------------------------
  // 🔥🔥🔥 核心修复：权限 + 激活通话模式 (默认为扬声器) 🔥🔥🔥
  // ---------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initAudio = async () => {
      try {
        console.log('🔊 [Audio] 正在检查麦克风权限...');
        // 1. 必须先获取权限，否则 Android 无法建立 Voice Communication 通道
        const { status } = await Audio.requestPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert('权限错误', '必须授予麦克风权限才能进行通话');
          return;
        }

        console.log('🔊 [Audio] 权限获取成功，正在配置音频模式...');

        // 2. 配置音频模式
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          // 👇 确保这一行是 false，先走扬声器，打通了再切听筒
          playThroughEarpieceAndroid: false,
        });
        if (isMounted) {
          setIsSpeakerOn(true); // UI 同步显示为免提开启
          console.log('✅ [Audio] 通话模式已激活 (默认扬声器)');
        }
      } catch (e) {
        console.error('❌ [Audio] 音频初始化失败:', e);
      }
    };

    initAudio();

    return () => { isMounted = false; };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: getOriginalTabBarStyle(insets) });
      };
    }, [navigation, insets])
  );

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: "none" } });
    }
    return () => {
      if (parent) {
        parent.setOptions({ tabBarStyle: { display: "flex" } });
      }
    };
  }, [navigation]);

  useEffect(() => {
    const handleRemoteSignal = (data: any) => {
      console.log('📡 [CallScreen] 收到对方信令:', data.type);

      if (data.type === 'answer') {
        console.log('✅ 对方已接听');
        setStatus('Connected');
        startTimer();
      } else if (data.type === 'reject') {
        if (isEndedRef.current) return;
        isEndedRef.current = true;
        console.log('❌ 对方已拒绝');
        setStatus('Rejected');
        stopTimer();
        TcpSocketService.disconnect();
        setTimeout(() => {
          goBackOrToChat();
        }, 1000);
      } else if (data.type === 'end') {
        if (isEndedRef.current) return;
        isEndedRef.current = true;
        console.log('🛑 对方已挂断');
        setStatus('Ended');
        stopTimer();
        TcpSocketService.disconnect();
        setTimeout(() => {
          goBackOrToChat();
        }, 800);
      }
    };

    WebSocketManager.addCallCallback(handleRemoteSignal);
    return () => {
      WebSocketManager.removeCallCallback(handleRemoteSignal);
    };
  }, [navigation]);

  const remoteUserId = (isIncoming ? callerId : targetId) || '';

  const getContactById = useContactStore(state => state.getContactById);
  const currentUser = useUserStore(state => state.user);
  const currentUserId = currentUser?.id || '';

  const [status, setStatus] = useState(isIncoming ? 'Ringing...' : 'Calling...');
  const [displayName, setDisplayName] = useState<string>(paramName || '未知用户');
  const [displayAvatar, setDisplayAvatar] = useState<string>(paramAvatar || '');
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // 🔥 默认为 true，因为我们初始化时 playThroughEarpieceAndroid: false
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const [durationSeconds, setDurationSeconds] = useState(0);

  const durationRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeChatIdRef = useRef<string | null>(initialChatId || null);
  const isProcessingRef = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const isEndedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(!isIncoming);
  const [loadingStatus, setLoadingStatus] = useState('正在连接...');

  useEffect(() => {
    if (status === 'Connected' || status === '通话中') {
      const checkRemoteStream = () => {
        const callService = WebSocketManager.callService;
        const stream = callService?.remoteStream;
        if (stream) {
          const url = (stream as any).toURL();
          console.log('🔊 [CallScreen] 获取到远程音频流 URL:', url);
          setRemoteStreamUrl(url);
        } else {
          setTimeout(checkRemoteStream, 100);
        }
      };
      checkRemoteStream();
    }
  }, [status]);

  const goBackOrToChat = () => {
    if (activeChatIdRef.current) {
      navigation.replace('ChatRoom', {
        chatId: activeChatIdRef.current,
        chatName: displayName,
      });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };

  const ensureTargetChatId = async (retries = 2): Promise<string | null> => {
    if (activeChatIdRef.current) return activeChatIdRef.current;
    if (!currentUserId || !remoteUserId) return null;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await createPrivateChat({
          name: displayName || 'Chat',
          user_id: currentUserId,
          chat_with: remoteUserId,
          image: displayAvatar || ''
        });
        const newId = res.data?.chat_id || res.data?.id || res.data?.response?.chat_id;
        if (newId) {
          const strId = newId.toString();
          activeChatIdRef.current = strId;
          return strId;
        }
      } catch (error) { }
    }
    return null;
  };

  const fetchUserInfo = useCallback(async (userId: string) => {
    if (!userId) return;

    // 1. 先尝试用 route params 更新 (如果有的话)
    if (paramName) setDisplayName(paramName);
    if (paramAvatar) setDisplayAvatar(paramAvatar);

    // 2. 如果已经有头像了，就不用去查了 (节省资源)
    // 注意：这里要排除默认头像或 ngrok 这种无效头像
    if (displayAvatar && !displayAvatar.includes('personal.png') && !displayAvatar.includes('ngrok')) {
      return;
    }

    // 3. 尝试从本地缓存获取
    const localContact = getContactById(userId);
    if (localContact) {
      if (localContact.name) setDisplayName(localContact.name);
      if (localContact.avatar) setDisplayAvatar(localContact.avatar);
      // 如果本地有，就不去网络查了，除非你想强制刷新
      return;
    }

    // 4. 最后手段：从网络拉取
    console.log('👤 [CallScreen] 本地无头像，正在从服务器拉取:', userId);
    setLoadingUserInfo(true);
    try {
      const result = await readUsers(userId);
      if (result.success && result.data) {
        const userData = result.data.response || result.data;
        const newName = userData.name || userData.nickname || '未知用户';
        const newAvatar = userData.image || userData.avatar || '';

        setDisplayName(newName);
        setDisplayAvatar(newAvatar);
        console.log('✅ [CallScreen] 用户信息更新:', newName);
      }
    } catch (error) {
      console.log('❌ [CallScreen] 拉取用户信息失败', error);
    } finally {
      setLoadingUserInfo(false);
    }
  }, [getContactById, paramName, paramAvatar, displayAvatar]);

  const startTimer = () => {
    if (timerRef.current) return;
    console.log('⏱️ [Timer] 通话接通，开始计时');
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
      console.log('⏱️ [Timer] 停止计时，总时长:', durationRef.current);
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleMute = () => {
    const callService = WebSocketManager.callService;
    const localStream = callService?.getLocalStream;
    if (localStream) {
      const newMutedState = !isMicMuted;
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !newMutedState;
      });
      setIsMicMuted(newMutedState);
      console.log(`🎤 [CallScreen] 麦克风${newMutedState ? '已静音' : '已开启'}`);
    }
  };

  // 🔥 切换免提/听筒
  const toggleSpeaker = async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        // false = 扬声器(免提), true = 听筒
        playThroughEarpieceAndroid: !newSpeakerState,
      });
      setIsSpeakerOn(newSpeakerState);
      console.log(`🔊 [CallScreen] 切换到: ${newSpeakerState ? '免提 (扬声器)' : '听筒'}`);
    } catch (error) {
      console.log('❌ [CallScreen] 切换扬声器失败:', error);
      Alert.alert('提示', '切换失败，请重试');
    }
  };

  const sendCallRecord = async (
    recordStatus: 'active' | 'rejected' | 'cancelled' | 'ended' | 'answered',
    displayMessage: string,
    duration: string = '00:00'
  ) => {
    if (!currentUserId || !remoteUserId) return false;
    try {
      const targetId = await ensureTargetChatId();
      if (!targetId) return false;
      const callData = JSON.stringify({
        type: 'SINGLE_VOICE_CALL',
        roomId: targetId,
        hostName: currentUser?.name || displayName,
        status: recordStatus,
        duration: duration,
        startTime: new Date().toISOString(),
        displayMessage: displayMessage
      });
      await sendChatMessage({
        sender: currentUserId,
        isreceive: [remoteUserId],
        chat_id: targetId,
        message: callData,
        type: 4
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const sendCallSignal = (signalType: 'end' | 'reject' | 'answer') => {
    if (!remoteUserId || !currentUserId) return;
    WebSocketManager.sendCallSignal({
      type: signalType,
      chat_id: activeChatIdRef.current || '',
      sender: currentUserId,
      receiver: [remoteUserId]
    });
  };

  useEffect(() => {
    if (!remoteUserId) {
      console.error('[CallScreen] 错误: 缺少 remoteUserId');
      return;
    }

    const initCall = async () => {
      if (!isIncoming) {
        // ... Caller Logic ...
        console.log('[CallScreen] 发起呼叫:', remoteUserId);
        try {
          setLoadingStatus('正在创建通话...');
          const callResult = await startCall({
            user_id: currentUserId,
            callees: [remoteUserId],
            istype: 0,
          });

          if (callResult.success && callResult.data?.call_id) {
            callIdRef.current = callResult.data.call_id;
            setLoadingStatus('正在连接服务器...');
            try {
              await TcpSocketService.connect(currentUserId, callIdRef.current);
              TcpSocketService.sendCall(currentUserId, callIdRef.current);
              setLoadingStatus('正在呼叫对方...');
              WebSocketManager.startCall(
                remoteUserId,
                paramName || displayName,
                paramAvatar || displayAvatar,
                activeChatIdRef.current || undefined,
                callIdRef.current
              );
              setIsLoading(false);
            } catch (tcpError) {
              console.warn('TCP 失败，使用 WebSocket');
              WebSocketManager.startCall(
                remoteUserId,
                paramName || displayName,
                paramAvatar || displayAvatar,
                activeChatIdRef.current || undefined
              );
              setIsLoading(false);
            }
          } else {
            WebSocketManager.startCall(
              remoteUserId,
              paramName || displayName,
              paramAvatar || displayAvatar,
              activeChatIdRef.current || undefined
            );
            setIsLoading(false);
          }
        } catch (error) {
          setIsLoading(false);
        }
        fetchUserInfo(remoteUserId);
      } else {
        // ... Callee Logic ...
        console.log('[CallScreen] 收到来电:', remoteUserId);
        fetchUserInfo(remoteUserId);
      }
    };

    initCall();

    const handleCallStatus = (newStatus: string) => {
      console.log('🔄 [Status Change]', newStatus);
      setStatus(newStatus);
      if (newStatus === 'Connected' || newStatus === '通话中') {
        startTimer();
      }
    };

    const handleEndCall = () => {
      if (isEndedRef.current) return;
      isEndedRef.current = true;
      console.log('📞 [Passive End] 收到对方挂断信号');
      stopTimer();
      setStatus('Ended');
      TcpSocketService.disconnect();
      setTimeout(() => {
        goBackOrToChat();
      }, 800);
    };

    const handleTcpMessage = (data: TcpServerMessage) => {
      console.log('📡 [CallScreen-TCP] 收到 TCP 消息:', data.msg, data.type);
      if (data.msg === 'signal' && data.type) {
        const callService = WebSocketManager.callService;
        if (callService) {
          const signalData = {
            type: data.type,
            user_id: data.user_id,
            sender: data.user_id,
            payload: data.payload || {},
            call_id: data.room_id,
          };
          callService.handleSignal(signalData);
        }
      }
      if (data.msg === 'end' || data.msg === 'user_left') {
        if (!isEndedRef.current) {
          isEndedRef.current = true;
          stopTimer();
          setStatus('Ended');
          TcpSocketService.disconnect();
          setTimeout(() => {
            goBackOrToChat();
          }, 800);
        }
      }
    };

    TcpSocketService.addMessageCallback(handleTcpMessage);
    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('endCall', handleEndCall);

    return () => {
      stopTimer();
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('endCall', handleEndCall);
      TcpSocketService.removeMessageCallback(handleTcpMessage);
    };
  }, [remoteUserId, isIncoming, displayName, fetchUserInfo]);

  const answer = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      setStatus('Connecting...'); // 先显示连接中

      // 🔥🔥🔥 补充逻辑 1：接听瞬间，再次强制激活音频硬件 🔥🔥🔥
      // 防止 App 在后台或锁屏时音频被挂起
      console.log('🔊 [Answer] 接听中，强制激活音频模式...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // ⚠️ 强制先用免提！听筒声音太小容易被误判为没声音
      });
      setIsSpeakerOn(true); // 更新 UI 状态

      // 🔥🔥🔥 补充逻辑 2：手动检查并开启麦克风轨道 (这是你缺少的！) 🔥🔥🔥
      const callService = WebSocketManager.callService;
      if (callService && callService.getLocalStream) {
        callService.getLocalStream.getAudioTracks().forEach((track: any) => {
          if (!track.enabled) {
            console.log('🎤 [Answer] 发现麦克风被禁用，正在强制开启...');
            track.enabled = true; // <--- 强行打开开关
          }
        });
      }

      // 3. 原有逻辑：WebSocket 应答
      WebSocketManager.callService?.answerCall();

      // 4. 原有逻辑：发送信令给对方
      sendCallSignal('answer');

      // 注意：这里不直接 startTimer，而是等待 'Connected' 事件触发 startTimer
    } catch (e) {
      console.warn(e);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const reject = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopTimer();
    try {
      WebSocketManager.callService?.rejectCall();
      sendCallSignal('reject');
      await sendCallRecord('ended', '通话结束', '00:00');
      setTimeout(() => {
        goBackOrToChat();
      }, 500);
    } catch (e) {
      console.warn(e);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const hangup = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopTimer();
    const finalDuration = formatDuration(durationRef.current);
    const isCallConnected = durationRef.current > 0 || status === 'Connected' || status === '通话中';

    try {
      if (callIdRef.current && TcpSocketService.isSocketConnected()) {
        TcpSocketService.sendEnd(currentUserId, callIdRef.current);
      }
      if (callIdRef.current) {
        try { await callRoom({ call_id: callIdRef.current, action: 'end', user_id: currentUserId }); } catch (e) { }
      }
      TcpSocketService.disconnect();
      sendCallSignal('end');
      let msgStatus: 'ended' | 'cancelled' | 'rejected' = 'ended';
      let displayMsg = '';
      if (isCallConnected) {
        msgStatus = 'ended';
        displayMsg = `通话时长 ${finalDuration}`;
      } else if (!isIncoming) {
        msgStatus = 'cancelled';
        displayMsg = '已取消';
      } else {
        msgStatus = 'rejected';
        displayMsg = '通话结束';
      }
      await sendCallRecord(msgStatus, displayMsg, isCallConnected ? finalDuration : '00:00');
      WebSocketManager.callService?.cleanup(true, true);
      setTimeout(() => {
        goBackOrToChat();
      }, 500);
    } catch (e) {
      console.warn(e);
    } finally {
      isProcessingRef.current = false;
    }
  };

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

  const showAnswerReject = isIncoming && (status === 'Ringing...' || status === '');
  const isConnected = status === 'Connected' || status === '通话中';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD966" />
          <Text style={styles.loadingText}>{loadingStatus}</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => { TcpSocketService.disconnect(); navigation.goBack(); }}>
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔊 必须保留 1x1 像素，否则系统会杀后台流 */}
      {remoteStreamUrl && (
        <RTCView
          streamURL={remoteStreamUrl}
          style={styles.hiddenAudioView}
          objectFit="cover"
        />
      )}
      <View style={styles.contentContainer}>
        <View style={styles.topSection}>
          {loadingUserInfo ? (
            <View style={styles.avatar}><ActivityIndicator size="large" color="#FFFFFF" /></View>
          ) : (
            <Image
              source={
                !displayAvatar ||
                  displayAvatar.trim() === '' ||
                  displayAvatar.includes('ngrok') ||
                  displayAvatar.includes('null')
                  ? require('../../assets/images/personal.png') // 默认头像
                  : { uri: displayAvatar }
              }
              style={styles.avatarImage}
            />
          )}

          <Text style={styles.username}>{displayName}</Text>
          <Text style={styles.statusText}>
            {status === 'Ended' ? '通话结束' :
              isConnected ? formatDuration(durationSeconds) :
                (isIncoming && status === 'Ringing...') ? '邀请你语音通话...' :
                  translateStatus(status)}
          </Text>
        </View>

        <View style={styles.bottomSection}>
          {showAnswerReject ? (
            <View style={styles.incomingButtons}>
              <TouchableOpacity style={styles.rejectButton} onPress={reject} disabled={isProcessingRef.current}>
                <View style={styles.buttonCircle}><Text style={styles.buttonIcon}>✕</Text></View>
                <Text style={styles.buttonLabel}>拒接</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.answerButton} onPress={answer} disabled={isProcessingRef.current}>
                <View style={[styles.buttonCircle, styles.answerCircle]}><Text style={styles.buttonIcon}>✓</Text></View>
                <Text style={styles.buttonLabel}>接听</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                <View style={[styles.iconCircle, isMicMuted ? styles.iconActive : null]}>
                  <Ionicons name={isMicMuted ? "mic-off" : "mic"} size={28} color={isMicMuted ? "#000" : "#fff"} />
                </View>
                <Text style={styles.controlText}>{isMicMuted ? "已静音" : "静音"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.hangupButtonContainer} onPress={hangup} disabled={isProcessingRef.current}>
                <View style={styles.hangupButton}>
                  <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={styles.controlText}>挂断</Text>
              </TouchableOpacity>

              {/* 🔥 免提按钮: 现在默认为 True */}
              <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
                <View style={[styles.iconCircle, isSpeakerOn ? styles.iconActive : null]}>
                  <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={isSpeakerOn ? "#000" : "#fff"} />
                </View>
                <Text style={styles.controlText}>{isSpeakerOn ? "免提开" : "免提"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#202020' },

  // 🔥🔥🔥 核心修复：1x1 像素防止被优化掉 🔥🔥🔥
  hiddenAudioView: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },

  contentContainer: { flex: 1, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', marginTop: 100 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4A4A4A', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: '#4A4A4A' },
  username: { fontSize: 28, color: '#FFFFFF', fontWeight: '500', marginBottom: 12 },
  statusText: { fontSize: 18, color: '#FFFFFF', marginTop: 8, fontVariant: ['tabular-nums'] },
  bottomSection: { paddingBottom: 50, alignItems: 'center' },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-around', width: width * 0.8 },
  buttonCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  answerCircle: { backgroundColor: '#07C160' },
  buttonIcon: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  buttonLabel: { fontSize: 14, color: '#FFFFFF', marginTop: 4 },
  rejectButton: { alignItems: 'center' },
  answerButton: { alignItems: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
    width: '100%',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconActive: {
    backgroundColor: '#fff',
  },
  hangupButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 40,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
  },
});