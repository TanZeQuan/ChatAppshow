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

  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar when screen is focused
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });

      // Show tab bar when leaving the screen with ORIGINAL STYLE
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: getOriginalTabBarStyle(insets) // Restore your custom yellow style
        });
      };
    }, [navigation, insets])
  );

  useLayoutEffect(() => {
    // 尝试获取父级导航（通常是 TabNavigator）
    const parent = navigation.getParent();

    if (parent) {
      // 进入页面时：隐藏 TabBar
      parent.setOptions({
        tabBarStyle: { display: "none" }
      });
    }

    // 🔥🔥🔥 核心修复：离开页面时恢复 TabBar 🔥🔥🔥
    return () => {
      if (parent) {
        parent.setOptions({
          // 恢复默认显示 (通常是 flex)
          tabBarStyle: { display: "flex" }
        });
      }
    };
  }, [navigation]);

  useEffect(() => {
    const handleRemoteSignal = (data: any) => {
      // 收到对方信令

      // --------------------------
      // 1. 对方接听了 (Answer)
      // --------------------------
      if (data.type === 'answer') {
        // 对方已接听
        setStatus('Connected');
        startTimer();
      }

      // --------------------------
      // 2. 对方拒绝了 (Reject)
      // --------------------------
      else if (data.type === 'reject') {
        // 防止重复处理
        if (isEndedRef.current) return;
        isEndedRef.current = true;
        
        // 对方已拒绝
        setStatus('Rejected');
        stopTimer();
        TcpSocketService.disconnect();  // 断开 TCP

        setTimeout(() => {
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
        }, 1000);
      }

      // --------------------------
      // 3. 对方挂断了 (End) - 通话中挂断
      // --------------------------
      else if (data.type === 'end') {
        // 防止重复处理
        if (isEndedRef.current) return;
        isEndedRef.current = true;
        
        // 对方已挂断
        setStatus('Ended');
        stopTimer();
        TcpSocketService.disconnect();  // 断开 TCP
        
        setTimeout(() => {
          if (activeChatIdRef.current) {
            navigation.replace('ChatRoom', {
              chatId: activeChatIdRef.current,
              chatName: displayName,
            });
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 800);
      }
    };

    // 注册监听
    WebSocketManager.addCallCallback(handleRemoteSignal);

    // 清理监听
    return () => {
      WebSocketManager.removeCallCallback(handleRemoteSignal);
    };
  }, [navigation]); // 依赖项加上 navigation

  const remoteUserId = (isIncoming ? callerId : targetId) || '';

  const getContactById = useContactStore(state => state.getContactById);
  const currentUser = useUserStore(state => state.user);
  const currentUserId = currentUser?.id || '';

  const [status, setStatus] = useState(isIncoming ? 'Ringing...' : 'Calling...');
  const [displayName, setDisplayName] = useState<string>(paramName || '未知用户');
  const [displayAvatar, setDisplayAvatar] = useState<string>(paramAvatar || '');
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // 🔊 远程音频流 URL (用于激活音频播放)
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);

  // 🎤 静音状态
  const [isMicMuted, setIsMicMuted] = useState(false);
  
  // 🔊 免提状态
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // ⏱️ 计时器状态
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Refs
  const durationRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeChatIdRef = useRef<string | null>(initialChatId || null);
  const isProcessingRef = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const isEndedRef = useRef(false);  // 防止重复处理挂断

  // Loading 状态
  const [isLoading, setIsLoading] = useState(!isIncoming); // 主叫方需要 loading，被叫方不需要
  const [loadingStatus, setLoadingStatus] = useState('正在连接...');

  // 🔊 监听远程音频流 - 当通话连接成功时激活音频
  useEffect(() => {
    if (status === 'Connected' || status === '通话中') {
      const checkRemoteStream = () => {
        const callService = WebSocketManager.callService;
        // 使用 UnifiedCallService 的 remoteStream getter
        const stream = callService?.remoteStream;
        if (stream) {
          const url = (stream as any).toURL();
          // 获取到远程音频流
          setRemoteStreamUrl(url);
        } else {
          // 如果还没获取到，100ms 后重试
          setTimeout(checkRemoteStream, 100);
        }
      };
      checkRemoteStream();
    }
  }, [status]);

  // ---------------------------------------------------------
  // 🛠️ 确保获取 ChatID
  // ---------------------------------------------------------
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
      } catch (error) {
        // ignore
      }
    }
    return null;
  };

  // ---------------------------------------------------------
  // 📡 获取用户信息
  // ---------------------------------------------------------
  const fetchUserInfo = useCallback(async (userId: string) => {
    if (!userId) return;
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
        const userData = result.data.response || result.data;
        setDisplayName(userData.name || userData.nickname || '未知用户');
        setDisplayAvatar(userData.image || userData.avatar || '');
      }
    } catch (error) {
      console.error('❌ [CallScreen] Fetch user error');
    } finally {
      setLoadingUserInfo(false);
    }
  }, [getContactById, paramName, paramAvatar]);

  // ---------------------------------------------------------
  // ⏱️ 计时器逻辑 (核心)
  // ---------------------------------------------------------
  const startTimer = () => {
    // 防止重复启动
    if (timerRef.current) return;

    // 通话接通，开始计时
    setDurationSeconds(0);
    durationRef.current = 0;

    timerRef.current = setInterval(() => {
      setDurationSeconds(prev => {
        const next = prev + 1;
        durationRef.current = next; // 实时更新 ref 用于挂断时读取
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      // 停止计时
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ---------------------------------------------------------
  // 🎤 静音切换功能
  // ---------------------------------------------------------
  const toggleMute = () => {
    const callService = WebSocketManager.callService;
    const localStream = callService?.getLocalStream;
    if (localStream) {
      const newMutedState = !isMicMuted;
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !newMutedState; // 静音时 enabled=false，非静音时 enabled=true
      });
      setIsMicMuted(newMutedState);
      // 麦克风状态切换
    } else {
      // 无法切换静音
    }
  };

  // ---------------------------------------------------------
  // 🔊 免提切换功能
  // ---------------------------------------------------------
  const toggleSpeaker = async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      
      // 使用 expo-av 的 Audio API 切换音频输出模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // playThroughEarpieceAndroid: true 表示使用听筒，false 表示使用扬声器
        playThroughEarpieceAndroid: !newSpeakerState,
        // staysActiveInBackground: 保持后台音频活跃
        staysActiveInBackground: true,
      });
      
      setIsSpeakerOn(newSpeakerState);
      // 扬声器状态切换
    } catch (error) {
      console.error('❌ [CallScreen] Speaker toggle error');
      Alert.alert('提示', '切换扬声器失败，请重试');
    }
  };

  // ---------------------------------------------------------
  // 📤 发送聊天记录 (API)
  // ---------------------------------------------------------
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

      // 发送通话记录

      await sendChatMessage({
        sender: currentUserId,
        isreceive: [remoteUserId],
        chat_id: targetId,
        message: callData,
        type: 4
      });
      return true;
    } catch (error) {
      console.error('❌ [CallScreen] Send call record error');
      return false;
    }
  };

  // ---------------------------------------------------------
  // 📞 发送 WebSocket 信令
  // ---------------------------------------------------------
  const sendCallSignal = (signalType: 'end' | 'reject' | 'answer') => {
    if (!remoteUserId || !currentUserId) return;
    WebSocketManager.sendCallSignal({
      type: signalType,
      chat_id: activeChatIdRef.current || '',
      sender: currentUserId,
      receiver: [remoteUserId]
    });
  };

  // ---------------------------------------------------------
  // 🚀 初始化
  // ---------------------------------------------------------
  useEffect(() => {
    if (!remoteUserId) {
      console.error('❌ [CallScreen] Missing remoteUserId');
      return;
    }

    const initCall = async () => {
      // 🔊 初始化音频模式 - 确保音频可以正常播放
      // 这一步对于 Android 和 iOS 都非常重要，必须在通话开始前设置
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,           // iOS: 允许录音
          playsInSilentModeIOS: true,         // iOS: 静音模式下也能播放
          playThroughEarpieceAndroid: true,   // Android: 使用听筒播放
          staysActiveInBackground: true,      // 保持后台音频活跃
        });
        // 音频模式初始化成功
      } catch (audioError) {
        console.warn('⚠️ [CallScreen] Audio init failed');
      }

      if (!isIncoming) {
        // =====================================================
        // 主叫方 (Caller) 流程
        // =====================================================
        console.log('📞 [CallScreen] Call | remoteId:', remoteUserId);
        
        try {
          // 第1步：调用 API 获取 call_id
          setLoadingStatus('正在创建通话...');
          // 调用 startCall API
          
          const callResult = await startCall({
            user_id: currentUserId,
            callees: [remoteUserId],
            istype: 0, // 0 = 语音通话
          });

          if (callResult.success && callResult.data?.call_id) {
            callIdRef.current = callResult.data.call_id;
            console.log('📞 [CallScreen] call_id:', callIdRef.current);

            // 第2步：连接 TCP Socket
            setLoadingStatus('正在连接服务器...');
            // 连接 TCP Socket
            
            try {
              await TcpSocketService.connect(currentUserId, callIdRef.current);
              // TCP 连接成功

              // 第3步：发送 call 命令占领房间
              // 发送 call 命令
              TcpSocketService.sendCall(currentUserId, callIdRef.current);
              
              setLoadingStatus('正在呼叫对方...');

              // 第4步：发起 WebRTC 通话 + 通过 WebSocket 通知对方
              // 发送 offer 信令
              WebSocketManager.startCall(
                remoteUserId,
                paramName || displayName,
                paramAvatar || displayAvatar,
                activeChatIdRef.current || undefined,
                callIdRef.current // 传递 call_id
              );
              
              // 完成初始化
              setIsLoading(false);

            } catch (tcpError) {
              console.warn('⚠️ [CallScreen] TCP failed, using WebSocket');
              // TCP 失败时仍发起通话，但走 WebSocket
              WebSocketManager.startCall(
                remoteUserId,
                paramName || displayName,
                paramAvatar || displayAvatar,
                activeChatIdRef.current || undefined
              );
              setIsLoading(false);
            }

          } else {
            console.warn('⚠️ [CallScreen] startCall API failed');
            // API 失败时仍发起通话（无 call_id）
            WebSocketManager.startCall(
              remoteUserId,
              paramName || displayName,
              paramAvatar || displayAvatar,
              activeChatIdRef.current || undefined
            );
            setIsLoading(false);
          }
        } catch (error) {
          console.error('❌ [CallScreen] Init failed');
          setIsLoading(false);
        }
        
        fetchUserInfo(remoteUserId);
      } else {
        // =====================================================
        // 被叫方 (Callee) 流程 - 来电时不需要 loading
        // =====================================================
        // 收到来电
        fetchUserInfo(remoteUserId);
      }
    };

    initCall();

    // ✅ 监听状态变化：接通时自动开始计时
    const handleCallStatus = (newStatus: string) => {
      // Status change
      setStatus(newStatus);

      // 当底层 WebRTC 连接成功 或 状态变为 "通话中" 时
      if (newStatus === 'Connected' || newStatus === '通话中') {
        startTimer();
      }
    };

    // 对方挂断处理
    const handleEndCall = () => {
      // 防止重复处理
      if (isEndedRef.current) return;
      isEndedRef.current = true;
      
      // 收到对方挂断信号
      stopTimer();
      setStatus('Ended');
      TcpSocketService.disconnect();  // 断开 TCP
      
      setTimeout(() => {
        if (activeChatIdRef.current) {
          navigation.replace('ChatRoom', {
            chatId: activeChatIdRef.current,
            chatName: displayName,
          });
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 800);
    };

    // ✅ 监听 TCP Socket 消息 - 处理通过 TCP 收到的 WebRTC 信令
    const handleTcpMessage = (data: TcpServerMessage) => {
      // 收到 TCP 消息

      // 处理 WebRTC 信令
      if (data.msg === 'signal' && data.type) {
        const callService = WebSocketManager.callService;
        if (!callService) {
          console.warn('⚠️ [CallScreen] CallService not initialized');
          return;
        }

        // 转换为 CallService 可以处理的格式
        const signalData = {
          type: data.type,
          user_id: data.user_id,
          sender: data.user_id,
          payload: data.payload || {},
          call_id: data.room_id,
        };

        // 转发信令
        callService.handleSignal(signalData);
      }

      // 处理用户加入房间通知
      if (data.msg === 'user_joined') {
        // 对方已加入房间
        // 对方加入后，主叫方会收到这个消息
        // WebRTC offer 应该已经在 startCall 时发送了
      }

      // 处理通话结束通知
      if (data.msg === 'end' || data.msg === 'user_left') {
        // 收到结束/离开通知
        if (!isEndedRef.current) {
          isEndedRef.current = true;
          stopTimer();
          setStatus('Ended');
          TcpSocketService.disconnect();
          
          setTimeout(() => {
            if (activeChatIdRef.current) {
              navigation.replace('ChatRoom', {
                chatId: activeChatIdRef.current,
                chatName: displayName,
              });
            } else if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }, 800);
        }
      }
    };

    // 注册 TCP 消息监听
    TcpSocketService.addMessageCallback(handleTcpMessage);

    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('endCall', handleEndCall);

    return () => {
      stopTimer();
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('endCall', handleEndCall);
      TcpSocketService.removeMessageCallback(handleTcpMessage);
    };
  }, [remoteUserId, isIncoming]);

  // ---------------------------------------------------------
  // ✅ 接听 (开始通话)
  // ---------------------------------------------------------
  const answer = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      setStatus('Connecting...'); // 先显示连接中

      // 获取来电的 call_id (从 UnifiedCallService 中获取)
      const incomingCallId = WebSocketManager.callService?.currentCallId;
      
      if (incomingCallId) {
        callIdRef.current = incomingCallId;
        console.log('📞 [CallScreen] Incoming call_id:', incomingCallId);

        // 第5步：调用 API 告诉服务器「我接听了」
        try {
          await callRoom({ call_id: incomingCallId, action: 'join', user_id: currentUserId });
        } catch (apiError) {
          // callRoom API failed
        }

        // 第6步：连接 TCP Socket
        // 连接 TCP Socket
        try {
          await TcpSocketService.connect(currentUserId, incomingCallId);
          // TCP 连接成功

          // 第7步：发送 accept 命令加入房间
          TcpSocketService.sendAccept(currentUserId, incomingCallId);

        } catch (tcpError) {
          console.warn('[CallScreen-Callee] TCP 连接失败，使用 WebSocket 备用');
        }
      }

      // WebRTC 应答 - answerCall() 内部会：
      // 1. 初始化本地音频流
      // 2. 创建 PeerConnection 并添加音频轨道
      // 3. 设置 remote description (来电的 offer)
      // 4. 创建并发送 answer (包含 SDP)
      // ⚠️ 注意：不要再调用 sendCallSignal('answer')，因为 answerCall 内部已经发送了带 SDP 的 answer
      // 重复发送会导致主叫方收到一个空的 answer，覆盖正确的 SDP，导致无法建立音频连接
      await WebSocketManager.callService?.answerCall();

      // 注意：这里不直接 startTimer，而是等待 'Connected' 事件触发 startTimer
    } catch (e) {
      console.warn(e);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // ---------------------------------------------------------
  // ❌ 拒接
  // ---------------------------------------------------------
  const reject = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopTimer();

    try {
      WebSocketManager.callService?.rejectCall();
      sendCallSignal('reject');

      // 拒接记录为 "通话结束 00:00"
      await sendCallRecord('ended', '通话结束', '00:00');

      setTimeout(() => {
        // ✅ 拒接后返回聊天室，而不是 goBack
        if (activeChatIdRef.current) {
          navigation.replace('ChatRoom', {
            chatId: activeChatIdRef.current,
            chatName: displayName,
          });
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 500);
    } catch (e) {
      console.warn(e);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // ---------------------------------------------------------
  // 🛑 挂断 (我方主动挂断)
  // ---------------------------------------------------------
  const hangup = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // 1. 停止计时并获取最终时长
    stopTimer();
    const finalDuration = formatDuration(durationRef.current);

    // 2. 判断是否真正接通过 (有时间 或者 状态是Connected)
    const isCallConnected = durationRef.current > 0 || status === 'Connected' || status === '通话中';

    console.log('[CallScreen] 挂断, call_id:', callIdRef.current, '时长:', finalDuration);

    try {
      // 第11步：通过 TCP Socket 发送 end 命令
      if (callIdRef.current && TcpSocketService.isSocketConnected()) {
        TcpSocketService.sendEnd(currentUserId, callIdRef.current);
      }

      // 第12步：调用 API 告诉服务器「通话结束」
      if (callIdRef.current) {
        try {
          await callRoom({ call_id: callIdRef.current, action: 'end', user_id: currentUserId });
        } catch (apiError) {
          // callRoom API failed (not affecting hangup)
        }
      }

      // 第13步：断开 TCP Socket 连接
      TcpSocketService.disconnect();

      // 告诉对方挂断
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

      // 发送最终记录
      await sendCallRecord(msgStatus, displayMsg, isCallConnected ? finalDuration : '00:00');

      // 清理资源，跳过事件触发（因为是主动挂断，UI 已经处理了）
      WebSocketManager.callService?.cleanup(true, true);

      setTimeout(() => {
        // ✅ 挂断后返回聊天室，而不是 goBack
        if (activeChatIdRef.current) {
          navigation.replace('ChatRoom', {
            chatId: activeChatIdRef.current,
            chatName: displayName,
          });
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
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

  // 判断是否正在显示时间 (Connected状态)
  const isConnected = status === 'Connected' || status === '通话中';

  // Loading 界面 (主叫方初始化时显示)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD966" />
          <Text style={styles.loadingText}>{loadingStatus}</Text>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => {
              TcpSocketService.disconnect();
              navigation.goBack();
            }}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 隐藏的 RTCView 用于激活远程音频流播放 */}
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
                displayAvatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                  ? require('../../assets/images/personal.png')
                  : { uri: displayAvatar }
              } 
              style={styles.avatarImage} 
            />
          )}

          <Text style={styles.username}>{displayName}</Text>

          {/* 状态显示区 */}
          <Text style={styles.statusText}>
            {status === 'Ended' ? '通话结束' :
              isConnected ? formatDuration(durationSeconds) : // ✅ 接通后显示计时 00:00
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
              {/* 静音按钮 */}
              <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                <View style={[styles.iconCircle, isMicMuted ? styles.iconActive : null]}>
                  <Ionicons name={isMicMuted ? "mic-off" : "mic"} size={28} color={isMicMuted ? "#000" : "#fff"} />
                </View>
                <Text style={styles.controlText}>{isMicMuted ? "已静音" : "静音"}</Text>
              </TouchableOpacity>

              {/* 挂断按钮 */}
              <TouchableOpacity style={styles.hangupButtonContainer} onPress={hangup} disabled={isProcessingRef.current}>
                <View style={styles.hangupButton}>
                  <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={styles.controlText}>挂断</Text>
              </TouchableOpacity>

              {/* 免提按钮 */}
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
  // 🔊 RTCView 必须有尺寸才能激活音频播放，width/height 为 0 会导致没声音
  hiddenAudioView: { width: 1, height: 1, position: 'absolute', opacity: 0 },
  contentContainer: { flex: 1, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', marginTop: 100 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4A4A4A', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: '#4A4A4A' },
  avatarText: { fontSize: 40, color: '#FFFFFF', fontWeight: '500' },
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
  // 与群聊一致的底部控制栏样式
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
  // Loading 样式
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