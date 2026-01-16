import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MediaStream, RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { readChatMessages, sendChatMessage, startCall, callRoom } from '../../api/Chat';
import WebSocketManager from '../../services/WebSocketManager';
import TcpSocketService from '../../services/TcpSocketService';
import { UnifiedCallService } from '../../services/UnifiedCallService';

import { useUserStore } from '../../store/userStore';
import { useContactStore } from '../../store/contactStore';

const { width } = Dimensions.get('window');

interface CallParticipant {
  userId: string;
  userName: string;
  avatar: string;
  stream?: MediaStream | null;
  isSpeaking?: boolean;
  isMuted?: boolean;
}

// ✅ Helper function to format seconds into MM:SS
const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function GroupCallScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { chatId, isHost, callId: incomingCallId } = route.params || {};

  const currentUser = useUserStore(state => state.user);
  const currentUserId = currentUser?.id || 'me';
  const getContactById = useContactStore(state => state.getContactById);

  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Local control state
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // ✅ Timer state
  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationRef = useRef(0);
  
  // ✅ UnifiedCallService Reference (替代原来的 P2PManager)
  const callServiceRef = useRef<UnifiedCallService | null>(null);

  // ✅ 保存 call_id (从 API 获取)
  const callIdRef = useRef<string | null>(null);

  // ✅ Loading 状态
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('正在初始化...');
  
  // ✅ 标记是否是自己主动挂断（用于区分「自己退出」和「被踢出」）
  const isHangingUpRef = useRef(false);

  // 1. Start Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds(prev => {
        const next = prev + 1;
        durationRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Helper: Add or Update Participant
  const addOrUpdateParticipant = useCallback((userId: string, extraData?: any, stream?: MediaStream) => {
    if (userId === currentUserId) return;

    setParticipants(prev => {
      const exists = prev.find(p => p.userId === userId);
      
      // Update existing
      if (exists) {
        return prev.map(p => p.userId === userId ? {
          ...p,
          stream: stream || p.stream, // Update stream if provided
          userName: extraData?.userName || p.userName,
          avatar: extraData?.avatar || p.avatar
        } : p);
      }

      // Add new
      let name = extraData?.userName || userId;
      let avatar = extraData?.avatar || '';

      // Try fetching from local store if name is missing
      if (!extraData?.userName) {
          const localContact = getContactById(userId);
          if (localContact) {
              name = localContact.name;
              avatar = localContact.avatar || '';
          }
      }

      return [...prev, { 
        userId, 
        userName: name, 
        avatar, 
        stream: stream || null, 
        isSpeaking: false 
      }];
    });
  }, [currentUserId, getContactById]);

  // ✅ 保存群成员列表 (用于非 Host 发送 JOIN_CALL)
  const receiversRef = useRef<string[]>([]);

  // 3. Initialize UnifiedCallService & Local Stream
  useEffect(() => {
    // 组件初始化
    
    // 使用 WebSocketManager 的 callService，或创建新的
    if (WebSocketManager.callService) {
      callServiceRef.current = WebSocketManager.callService;
    } else if (WebSocketManager.ws) {
      callServiceRef.current = new UnifiedCallService(WebSocketManager.ws, currentUserId);
    }
    
    // 设置群聊模式
    callServiceRef.current?.setCallInfo(chatId, incomingCallId || '', 'group');
    
    // 设置远程流回调
    if (callServiceRef.current) {
      callServiceRef.current.onRemoteStream = (userId: string, stream: MediaStream) => {
        addOrUpdateParticipant(userId, null, stream);
      };
      callServiceRef.current.onPeerLeft = (userId: string) => {
        setParticipants(prev => prev.filter(p => p.userId !== userId));
      };
    }

    const initCall = async () => {
      try {
        // 🔊 初始化音频模式 - 确保音频可以正常播放
        setLoadingStatus('正在初始化音频...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: true, // 默认使用听筒
          staysActiveInBackground: true,
        });
        // 收到通话结束信号
        
        setLoadingStatus('正在获取麦克风权限...');
        
        // Get Local Stream via UnifiedCallService
        const stream = await callServiceRef.current?.initLocalStream();
        setLocalStream(stream || null);

        // Add self to grid
        setParticipants([{
          userId: currentUserId,
          userName: currentUser?.name || 'Me',
          avatar: currentUser?.avatar || '',
          stream: stream,
          isSpeaking: false,
        }]);

        setLoadingStatus('正在获取群成员信息...');
        
        // Get Group Members (to broadcast JOIN)
        const result = await readChatMessages({ chat_id: chatId, user_id: currentUserId, offset: 0 });
        const receivers = result.data?.group?.map((m: any) => m.user_id).filter((id: string) => id !== currentUserId) || [];
        receiversRef.current = receivers;

        // =====================================================
        // HOST 流程 (A - Caller)
        // =====================================================
        if (isHost && receivers.length > 0) {
          setLoadingStatus('正在创建通话房间...');
          
          const callResult = await startCall({
            user_id: currentUserId,
            callees: receivers,
            istype: 0,
          });

          if (callResult.success && callResult.data?.call_id) {
            callIdRef.current = callResult.data.call_id;
            callServiceRef.current?.setCallInfo(chatId, callIdRef.current, 'group');

            setLoadingStatus('正在连接通话服务器...');
            
            try {
              await TcpSocketService.connect(currentUserId, callIdRef.current);
              TcpSocketService.sendCall(currentUserId, callIdRef.current);
              
              setLoadingStatus('正在通知群成员...');
              
              // 1. 发送聊天消息（通话卡片）- 让群成员在聊天中看到可加入的通话
              // 注意：这里才发送通话卡片，因为这时候才有 call_id
              const callInviteData = JSON.stringify({
                type: 'GROUP_VOICE_CALL',
                roomId: chatId,
                call_id: callIdRef.current,  // ✅ 重要：包含 call_id 让其他人可以加入
                hostName: currentUser?.name || 'Host',
                status: 'active',
                startTime: new Date().toISOString()
              });

              sendChatMessage({
                sender: currentUserId,
                isreceive: receivers,
                chat_id: chatId,
                message: callInviteData,
                type: 4,
              }).catch(e => console.log('[GroupCall] 发送通话卡片失败:', e));

              // 2. 发送 WebSocket 信令通知在线用户（实时推送）
              WebSocketManager.sendCallSignal({
                type: 'JOIN_CALL', 
                chat_id: chatId,
                sender: currentUserId,
                receiver: receivers,
                call_id: callIdRef.current,
                call_mode: 'group',
                payload: { 
                  userName: currentUser?.name, 
                  avatar: currentUser?.avatar,
                  call_id: callIdRef.current,
                  call_mode: 'group',
                }
              });
              
              // Host 完成初始化
              setIsLoading(false);

            } catch (tcpError) {
              WebSocketManager.sendCallSignal({
                type: 'JOIN_CALL', 
                chat_id: chatId,
                sender: currentUserId,
                receiver: receivers,
                call_id: callIdRef.current,
                call_mode: 'group',
                payload: { 
                  userName: currentUser?.name, 
                  avatar: currentUser?.avatar,
                  call_id: callIdRef.current,
                  call_mode: 'group',
                }
              });
              setIsLoading(false);
            }

          } else {
            WebSocketManager.sendCallSignal({
              type: 'JOIN_CALL', 
              chat_id: chatId,
              sender: currentUserId,
              receiver: receivers,
              call_mode: 'group',
              payload: { 
                userName: currentUser?.name, 
                avatar: currentUser?.avatar,
                call_mode: 'group',
              }
            });
            setIsLoading(false);
          }
        }
        // NON-HOST: 被叫方流程
        else if (!isHost) {
          if (incomingCallId) {
            callIdRef.current = incomingCallId;
            callServiceRef.current?.setCallInfo(chatId, incomingCallId, 'group');
            
            setLoadingStatus('正在加入通话房间...');
            
            try {
              await callRoom({ call_id: incomingCallId, action: 'join', user_id: currentUserId });
            } catch (apiError) {
              // API 失败不影响通话
            }
            
            // 连接 TCP Socket
            try {
              await TcpSocketService.connect(currentUserId, incomingCallId);
              TcpSocketService.sendAccept(currentUserId, incomingCallId);
              console.log('[GroupCall] ✅ 已加入房间');
              setIsLoading(false);
            } catch (tcpError) {
              console.error('[GroupCall] TCP 连接失败');
              Alert.alert('连接失败', '无法连接到通话服务器，请稍后再试');
              navigation.goBack();
            }
          } else {
            // 没有传入 callId，等待收到 JOIN_CALL 信令
            setLoadingStatus('等待主持人开始通话...');
            
            // 超时处理：如果 30 秒内没有收到 JOIN_CALL，提示用户
            const timeoutId = setTimeout(() => {
              if (isLoading && !callIdRef.current) {
                console.log('[GroupCall-Callee] 等待超时，未收到 JOIN_CALL');
                Alert.alert(
                  '连接超时',
                  '未能连接到通话，可能主持人已结束通话或网络问题。',
                  [
                    { text: '返回', onPress: () => navigation.goBack() },
                    { text: '继续等待', style: 'cancel' }
                  ]
                );
              }
            }, 30000);
            
            // 清理定时器（在组件卸载时会执行 cleanup）
            return () => clearTimeout(timeoutId);
          }
        }

      } catch (err) {
        console.error('[GroupCall] 初始化失败:', err);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to access microphone');
      }
    };

    initCall();

    // 4. Signal Handling (Delegated to P2PManager)
    const handleCallSignal = async (data: any) => {
      console.log('[GroupCall] handleCallSignal 被触发, type:', data.type, 'msg:', data.msg);
      
      // 忽略非通话相关的消息
      if (data.msg && data.msg !== 'call_signal') {
        return;
      }
      
      const senderId = data.sender || data.user_id;
      if (String(senderId) === String(currentUserId)) return;

      // 验证 call_id (JOIN_CALL 除外，因为被叫方还不知道 call_id)
      const incomingCallId = data.call_id || data.room_id || data.payload?.call_id;
      if (data.type !== 'JOIN_CALL' && callIdRef.current && incomingCallId && 
          String(incomingCallId) !== String(callIdRef.current)) {
        return;
      }

      console.log('[GroupCall] 收到信令:', data.type, '来自:', senderId);
      const payload = data.payload || {};

     switch (data.type) {
        case 'JOIN_CALL': 
          addOrUpdateParticipant(senderId, payload);
          const joinCallId = payload?.call_id || data.call_id;
          
          // NON-HOST (Callee) 收到 Host 的通话邀请
          if (joinCallId && !isHost && !callIdRef.current) {
            callIdRef.current = joinCallId;
            console.log('[GroupCall-Callee] 收到邀请, call_id:', joinCallId);
            setLoadingStatus('正在加入通话房间...');

            // 第5步：调用 API 告诉服务器「我接听了」(可选，失败不影响通话)
            try {
              const joinResult = await callRoom({ call_id: joinCallId, action: 'join', user_id: currentUserId });
              if (!joinResult.success) {
                // callRoom API failed (not affecting call)
              }
            } catch (apiError) {
              // callRoom API error (not affecting call)
            }

            setLoadingStatus('正在连接通话服务器...');
            
            // 第6步：连接 TCP Socket
            try {
              await TcpSocketService.connect(currentUserId, joinCallId);
              console.log('[GroupCall-Callee] ✅ TCP 连接成功');
              callServiceRef.current?.setCallInfo(chatId, joinCallId, 'group');
              
              // 第7步：发送 accept 命令加入房间
              TcpSocketService.sendAccept(currentUserId, joinCallId);
              
              setLoadingStatus('正在通知其他成员...');

              // 第8步：通知其他群成员
              const otherReceivers = receiversRef.current.filter(id => id !== senderId);
              if (otherReceivers.length > 0) {
                WebSocketManager.sendCallSignal({
                  type: 'JOIN_CALL',
                  chat_id: chatId,
                  sender: currentUserId,
                  receiver: [...otherReceivers, senderId],
                  call_id: joinCallId,
                  payload: {
                    userName: currentUser?.name,
                    avatar: currentUser?.avatar,
                    call_id: joinCallId,
                  }
                });
              }
              
              // Callee 完成初始化
              setIsLoading(false);
              
            } catch (tcpError) {
              console.warn('[GroupCall-Callee] TCP 连接失败，使用 WebSocket 备用');
              callServiceRef.current?.setCallInfo(chatId, joinCallId, 'group');
              setIsLoading(false);
            }
          }
          // 收到 JOIN_CALL 通知（WebSocket）- 只是通知，不发起 offer
          if (callIdRef.current) {
            console.log('[GroupCall] 收到加入通知:', senderId);
          }
          break;

        case 'offer':
          // Received Offer: Handle & Answer
          addOrUpdateParticipant(senderId, payload); // Ensure user shows up
          await callServiceRef.current?.handleGroupOffer(senderId, payload.sdp, data.call_id);
          break;

        case 'answer':
          // Received Answer - 使用 handleSignal 统一处理
          callServiceRef.current?.handleSignal(data);
          break;

        case 'candidate':
          // Received ICE Candidate - 使用 handleSignal 统一处理
          callServiceRef.current?.handleSignal(data);
          break;

        case 'LEAVE_CALL':
          // 某个成员离开了（drop），只移除该成员
          callServiceRef.current?.removePeer(senderId);
          setParticipants(prev => prev.filter(p => p.userId !== senderId));
          break;
          
        case 'end':
          // Host 通过 WebSocket 发送的结束信号，所有人退出
          console.log('[GroupCall] WebSocket: Host 结束了通话');
          callServiceRef.current?.destroy();
          TcpSocketService.disconnect();
          
          Alert.alert('通话结束', '主持人已结束通话', [
            {
              text: '确定',
              onPress: () => {
                (navigation as any).replace('GroupRoom', {
                  chatId: chatId,
                  chatName: route.params?.chatName || '群聊',
                } as never);
              }
            }
          ]);
          break;
      }
    };

    console.log('[GroupCall] 注册 WebSocket 回调');
    WebSocketManager.addCallCallback(handleCallSignal);

    // TCP Socket 消息监听
    const handleTcpMessage = async (data: any) => {
      console.log('[GroupCall] TCP 收到:', JSON.stringify(data));
      
      // 检查是否是 "Call Ended" 响应（服务器对 end/drop 命令的响应）
      if (data.status === 1 && data.message === 'Call Ended.') {
        console.log('[GroupCall] TCP: 收到 Call Ended 响应, isHangingUp:', isHangingUpRef.current);
        
        // 如果是自己主动挂断的，忽略这个响应（hangup 函数会处理）
        if (isHangingUpRef.current) {
          console.log('[GroupCall] TCP: 自己主动挂断，忽略 Call Ended 响应');
          return;
        }
        
        // 不是自己挂断的 = Host 结束了通话，所有人都要退出
        console.log('[GroupCall] TCP: Host 结束了通话，退出');
        
        // 清理资源
        callServiceRef.current?.destroy();
        TcpSocketService.disconnect();
        
        Alert.alert('通话结束', '主持人已结束通话', [
          {
            text: '确定',
            onPress: () => {
              (navigation as any).replace('GroupRoom', {
                chatId: chatId,
                chatName: route.params?.chatName || '群聊',
              } as never);
            }
          }
        ]);
        return;
      }
      
      switch (data.msg) {
        case 'user_joined':
          if (data.user_id && data.user_id !== currentUserId) {
            console.log('[GroupCall] 用户加入:', data.user_id);
            
            // 从本地联系人获取用户信息（TCP 服务器只返回 user_id）
            const contact = getContactById(data.user_id);
            addOrUpdateParticipant(data.user_id, {
              userName: data.userName || contact?.name || data.user_id,
              avatar: data.avatar || contact?.avatar || '',
            });
            // 向新成员发起 offer
            await callServiceRef.current?.makeOffer(data.user_id);
          }
          break;

        case 'user_left':
          if (data.user_id) {
            console.log('[GroupCall] TCP: 用户离开:', data.user_id);
            callServiceRef.current?.removePeer(data.user_id);
            setParticipants(prev => prev.filter(p => p.userId !== data.user_id));
          }
          break;

        case 'signal':
          const tcpSenderId = data.user_id;
          if (tcpSenderId && tcpSenderId !== currentUserId) {
            // 使用 handleSignal 统一处理所有信令
            callServiceRef.current?.handleSignal({
              ...data,
              sender: tcpSenderId,
            });
          }
          break;
      }
    };

    TcpSocketService.addMessageCallback(handleTcpMessage);

    return () => {
      WebSocketManager.removeCallCallback(handleCallSignal);
      TcpSocketService.removeMessageCallback(handleTcpMessage);
      callServiceRef.current?.destroy();
    };
  }, [addOrUpdateParticipant, chatId, currentUser?.avatar, currentUser?.name, currentUserId, getContactById]);

  const toggleMute = () => {
    if (localStream) {
        const newMutedState = !isMicMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !newMutedState;
        });
        setIsMicMuted(newMutedState);
    }
  };

  const toggleSpeaker = async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !newSpeakerState,
        staysActiveInBackground: true,
      });
      setIsSpeakerOn(newSpeakerState);
    } catch (error) {
      Alert.alert('提示', '切换扬声器失败，请重试');
    }
  };

  const hangup = async () => {
    // ✅ 标记为主动挂断，防止 TCP 响应触发「主持人已结束通话」弹窗
    isHangingUpRef.current = true;
    
    const finalDuration = formatDuration(durationRef.current);
    const receivers = participants.filter(p => p.userId !== currentUserId).map(p => p.userId);
    console.log('[GroupCall] 挂断通话, call_id:', callIdRef.current, '时长:', finalDuration, 'isHost:', isHost);

    // 第11步：通过 TCP Socket 发送命令
    // Host 发送 end（结束整个通话），非 Host 发送 drop（只是自己离开）
    if (callIdRef.current && TcpSocketService.isSocketConnected()) {
      if (isHost) {
        TcpSocketService.sendEnd(currentUserId, callIdRef.current);
      } else {
        TcpSocketService.sendDrop(currentUserId, callIdRef.current);
      }
    }

    // 第12步：调用 API 告诉服务器
    if (callIdRef.current) {
      const action = isHost ? 'end' : 'leave';
      await callRoom({ call_id: callIdRef.current, action: action, user_id: currentUserId });
    }

    // 第13步：断开 TCP Socket 连接
    TcpSocketService.disconnect();

    if (isHost) {
        // Host sends system message to end call in chat
        const endCallData = JSON.stringify({
            type: 'GROUP_VOICE_CALL',
            roomId: chatId,
            hostName: currentUser?.name,
            status: 'ended',
            duration: finalDuration,
            startTime: new Date().toISOString(),
            call_id: callIdRef.current,  // ✅ 携带 call_id
        });
        
        sendChatMessage({
            sender: currentUserId,
            isreceive: [],
            chat_id: chatId,
            message: endCallData,
            type: 4
        }).catch(e => console.log('End call msg error', e));
    }

    // Broadcast LEAVE to peers via WebSocket (9501)
    if (receivers.length > 0) {
        WebSocketManager.sendCallSignal({
            type: 'LEAVE_CALL',
            chat_id: chatId,
            sender: currentUserId,
            receiver: receivers,
            call_id: callIdRef.current || undefined,  // ✅ 携带 call_id
        });
    }

    // 清理 P2P 资源
    callServiceRef.current?.destroy();

    // ✅ 根据角色显示不同提示
    if (!isHost) {
      // 非 Host 自己退出 - 显示提示
      Alert.alert('通话结束', '你已成功退出通话', [
        {
          text: '确定',
          onPress: () => {
            (navigation as any).replace('GroupRoom', {
              chatId: chatId,
              chatName: route.params?.chatName || '群聊',
            } as never);
          }
        }
      ]);
    } else {
      // Host 结束通话 - 直接返回
      (navigation as any).replace('GroupRoom', {
        chatId: chatId,
        chatName: route.params?.chatName || '群聊',
      } as never);
    }
  };

  // ✅ Render Single Participant
  const renderParticipant = ({ item }: { item: CallParticipant }) => (
    <View style={styles.gridItem}>
      <View style={[
          styles.avatarContainer, 
          item.isSpeaking && styles.speakingBorder 
      ]}>
        <Image 
          source={
            !item.avatar || 
            item.avatar.trim() === '' || 
            item.avatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
              ? require('../../assets/images/personal.png')
              : { uri: item.avatar }
          } 
          style={styles.avatarImage} 
        />
      </View>
      <Text style={styles.nameText} numberOfLines={1}>
        {item.userId === currentUserId ? 'Me' : item.userName}
      </Text>
    </View>
  );

  // Loading 界面
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD966" />
          <Text style={styles.loadingText}>{loadingStatus}</Text>
          
          {/* 取消按钮 */}
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
      {/* 🔊 隐藏的 RTCView 用于激活所有远程音频流播放 */}
      {participants
        .filter(p => p.userId !== currentUserId && p.stream)
        .map(p => (
          <RTCView
            key={`audio-${p.userId}`}
            streamURL={(p.stream as any)?.toURL?.() || ''}
            style={styles.hiddenAudioView}
            objectFit="cover"
          />
        ))}
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>多人通话 ({participants.length})</Text>
        <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text> 
      </View>

      {/*  */}
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={item => item.userId}
        numColumns={3} 
        contentContainerStyle={styles.gridContainer}
      />

      {/* Footer Controls */}
      <View style={styles.footer}>
        {/* Mute Button */}
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
            <View style={[styles.iconCircle, isMicMuted ? styles.iconActive : null]}>
                <Ionicons name={isMicMuted ? "mic-off" : "mic"} size={28} color={isMicMuted ? "#000" : "#fff"} />
            </View>
            <Text style={styles.controlText}>{isMicMuted ? "已静音" : "静音"}</Text>
        </TouchableOpacity>

        {/* Hangup Button */}
        <TouchableOpacity style={styles.hangupButtonContainer} onPress={hangup}>
            <View style={styles.hangupButton}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text style={styles.controlText}>挂断</Text>
        </TouchableOpacity>

        {/* Speaker Button */}
        <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
            <View style={[styles.iconCircle, isSpeakerOn ? styles.iconActive : null]}>
                <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={isSpeakerOn ? "#000" : "#fff"} />
            </View>
            <Text style={styles.controlText}>{isSpeakerOn ? "免提开" : "免提"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#202020', 
  },
  // 🔊 隐藏的 RTCView - 用于激活远程音频流播放（必须渲染才能有声音）
  // ⚠️ 重要：width/height 必须至少为 1，设为 0 会导致音频流不被激活！
  hiddenAudioView: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  timerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontVariant: ['tabular-nums'], 
  },
  gridContainer: {
    padding: 20,
    alignItems: 'flex-start',
  },
  gridItem: {
    width: width / 3 - 20, 
    alignItems: 'center',
    marginBottom: 30,
    marginHorizontal: 3,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 8, 
    overflow: 'hidden',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  speakingBorder: {
    borderWidth: 3,
    borderColor: '#07C160', 
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: { 
    backgroundColor: '#555', 
    justifyContent: 'center', 
    alignItems: 'center',
    width: '100%',
    height: '100%'
  },
  placeholderText: {
      color: '#fff', 
      fontSize: 24
  },
  nameText: {
    color: 'white',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 30,
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