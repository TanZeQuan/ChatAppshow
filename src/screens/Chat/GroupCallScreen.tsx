import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MediaStream, RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import InCallManager from 'react-native-incall-manager';
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

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationRef = useRef(0);

  const callServiceRef = useRef<UnifiedCallService | null>(null);
  const callIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('正在初始化...');

  const isHangingUpRef = useRef(false);
  const receiversRef = useRef<string[]>([]);

  // ✅ timer
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

  const addOrUpdateParticipant = useCallback(
    (userId: string, extraData?: any, stream?: MediaStream) => {
      if (userId === currentUserId) return;

      setParticipants(prev => {
        const exists = prev.find(p => p.userId === userId);

        if (exists) {
          return prev.map(p =>
            p.userId === userId
              ? {
                ...p,
                stream: stream || p.stream,
                userName: extraData?.userName || p.userName,
                avatar: extraData?.avatar || p.avatar,
              }
              : p
          );
        }

        let name = extraData?.userName || userId;
        let avatar = extraData?.avatar || '';

        if (!extraData?.userName) {
          const localContact = getContactById(userId);
          if (localContact) {
            name = localContact.name;
            avatar = localContact.avatar || '';
          }
        }

        return [
          ...prev,
          {
            userId,
            userName: name,
            avatar,
            stream: stream || null,
            isSpeaking: false,
          },
        ];
      });
    },
    [currentUserId, getContactById]
  );

  // ✅✅✅ 核心：进入通话模式（像微信）
  const startInCallAudio = useCallback(async () => {
    try {
      // ✅ 1. 先设置基础音频模式（不要设置 playThroughEarpiece）
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        // ❌ 移除这行，让 InCallManager 完全控制路由
        // playThroughEarpieceAndroid: true, 
        shouldDuckAndroid: false,
      });

      // ✅ 2. 再启动 InCallManager（默认听筒模式）
      InCallManager.start({ media: 'audio', ringback: '' });
      InCallManager.setForceSpeakerphoneOn(false);

      console.log('[InCallManager] started ✅');
    } catch (e) {
      console.log('[InCallManager] start failed:', e);
    }
  }, []);

  const stopInCallAudio = useCallback(() => {
    try {
      InCallManager.stop();
      console.log('[InCallManager] stopped ✅');
    } catch (e) {
      console.log('[InCallManager] stop failed:', e);
    }
  }, []);

  // ✅ 初始化通话
  useEffect(() => {
    if (WebSocketManager.callService) {
      callServiceRef.current = WebSocketManager.callService;
    } else if (WebSocketManager.ws) {
      callServiceRef.current = new UnifiedCallService(WebSocketManager.ws, currentUserId);
    }

    callServiceRef.current?.setCallInfo(chatId, incomingCallId || '', 'group');

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
        const stream = await callServiceRef.current?.initLocalStream();

        if (!stream) {
          throw new Error('无法获取媒体流');
        }

        // ✅ 2. 验证音频轨道
        const audioTracks = stream.getAudioTracks();
        console.log(`[GroupCall] 音频轨道数量: ${audioTracks.length}`);

        if (audioTracks.length === 0) {
          throw new Error('没有可用的音频轨道');
        }

        // ✅ 3. 打印详细信息
        audioTracks.forEach((track, i) => {
          console.log(`[GroupCall] 轨道 ${i}:`, {
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          });
        });

        // ✅ 4. 现在才设置音频模式
        setLoadingStatus('正在初始化音频...');
        await startInCallAudio();

        setLocalStream(stream);

        setParticipants([
          {
            userId: currentUserId,
            userName: currentUser?.name || 'Me',
            avatar: currentUser?.avatar || '',
            stream: stream || null,
            isSpeaking: false,
          },
        ]);

        setLoadingStatus('正在获取群成员信息...');
        const result = await readChatMessages({ chat_id: chatId, user_id: currentUserId, offset: 0 });
        const receivers =
          result.data?.group?.map((m: any) => m.user_id).filter((id: string) => id !== currentUserId) || [];
        receiversRef.current = receivers;

        // HOST
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
            } catch (e) {
              // TCP 失败也继续走 WebSocket
            }

            setLoadingStatus('正在通知群成员...');
            const callInviteData = JSON.stringify({
              type: 'GROUP_VOICE_CALL',
              roomId: chatId,
              call_id: callIdRef.current,
              hostName: currentUser?.name || 'Host',
              status: 'active',
              startTime: new Date().toISOString(),
            });

            sendChatMessage({
              sender: currentUserId,
              isreceive: receivers,
              chat_id: chatId,
              message: callInviteData,
              type: 4,
            }).catch(() => { });

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
              },
            });

            setIsLoading(false);
            return;
          }

          // host startCall 失败也继续通知
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
            },
          });

          setIsLoading(false);
          return;
        }

        // CALLEE
        if (!isHost) {
          if (incomingCallId) {
            callIdRef.current = incomingCallId;
            callServiceRef.current?.setCallInfo(chatId, incomingCallId, 'group');

            setLoadingStatus('正在加入通话房间...');
            try {
              await callRoom({ call_id: incomingCallId, action: 'join', user_id: currentUserId });
            } catch { }

            try {
              await TcpSocketService.connect(currentUserId, incomingCallId);
              TcpSocketService.sendAccept(currentUserId, incomingCallId);
              setIsLoading(false);
              return;
            } catch {
              Alert.alert('连接失败', '无法连接到通话服务器，请稍后再试');
              stopInCallAudio();
              navigation.goBack();
              return;
            }
          }

          setLoadingStatus('等待主持人开始通话...');
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[GroupCall] 初始化失败:', err);
        setIsLoading(false);
        stopInCallAudio();
        Alert.alert('Error', 'Failed to access microphone');
      }
    };

    initCall();

    const handleCallSignal = async (data: any) => {
      if (data.msg && data.msg !== 'call_signal') return;

      const senderId = data.sender || data.user_id;
      if (String(senderId) === String(currentUserId)) return;

      const incoming = data.call_id || data.room_id || data.payload?.call_id;
      if (data.type !== 'JOIN_CALL' && callIdRef.current && incoming && String(incoming) !== String(callIdRef.current)) {
        return;
      }

      const payload = data.payload || {};

      switch (data.type) {
        case 'JOIN_CALL': {
          addOrUpdateParticipant(senderId, payload);

          const joinCallId = payload?.call_id || data.call_id;

          // callee 第一次拿到 call_id 才连接 tcp
          if (joinCallId && !isHost && !callIdRef.current) {
            callIdRef.current = joinCallId;

            try {
              await callRoom({ call_id: joinCallId, action: 'join', user_id: currentUserId });
            } catch { }

            try {
              await TcpSocketService.connect(currentUserId, joinCallId);
              callServiceRef.current?.setCallInfo(chatId, joinCallId, 'group');
              TcpSocketService.sendAccept(currentUserId, joinCallId);

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
                  },
                });
              }
            } catch { }
          }
          break;
        }

        case 'offer':
          addOrUpdateParticipant(senderId, payload);
          await callServiceRef.current?.handleGroupOffer(senderId, payload.sdp, data.call_id);
          break;

        case 'answer':
        case 'candidate':
          callServiceRef.current?.handleSignal(data);
          break;

        case 'LEAVE_CALL':
          callServiceRef.current?.removePeer(senderId);
          setParticipants(prev => prev.filter(p => p.userId !== senderId));
          break;

        case 'end':
          callServiceRef.current?.destroy();
          TcpSocketService.disconnect();
          stopInCallAudio();

          Alert.alert('通话结束', '主持人已结束通话', [
            {
              text: '确定',
              onPress: () => {
                (navigation as any).replace('GroupRoom', {
                  chatId,
                  chatName: route.params?.chatName || '群聊',
                } as never);
              },
            },
          ]);
          break;
      }
    };

    WebSocketManager.addCallCallback(handleCallSignal);

    const handleTcpMessage = async (data: any) => {
      if (data.status === 1 && data.message === 'Call Ended.') {
        if (isHangingUpRef.current) return;

        callServiceRef.current?.destroy();
        TcpSocketService.disconnect();
        stopInCallAudio();

        Alert.alert('通话结束', '主持人已结束通话', [
          {
            text: '确定',
            onPress: () => {
              (navigation as any).replace('GroupRoom', {
                chatId,
                chatName: route.params?.chatName || '群聊',
              } as never);
            },
          },
        ]);
        return;
      }

      switch (data.msg) {
        case 'user_joined':
          if (data.user_id && data.user_id !== currentUserId) {
            const contact = getContactById(data.user_id);
            addOrUpdateParticipant(data.user_id, {
              userName: data.userName || contact?.name || data.user_id,
              avatar: data.avatar || contact?.avatar || '',
            });
            await callServiceRef.current?.makeOffer(data.user_id);
          }
          break;

        case 'user_left':
          if (data.user_id) {
            callServiceRef.current?.removePeer(data.user_id);
            setParticipants(prev => prev.filter(p => p.userId !== data.user_id));
          }
          break;

        case 'signal':
          // ✅ 修复：正确传递 TCP 信令数据
          const tcpSenderId = data.sender || data.payload?.sender_id || data.user_id;

          if (tcpSenderId && String(tcpSenderId) !== String(currentUserId)) {
            console.log(`[TCP] 处理信令: ${data.type} from ${tcpSenderId}`);

            callServiceRef.current?.handleSignal({
              type: data.type,           // ✅ answer / candidate
              sender: tcpSenderId,       // ✅ 发送者 ID
              user_id: tcpSenderId,      // ✅ 兼容字段
              payload: data.payload,     // ✅ 完整 payload（包含 sdp/candidate）
              call_id: data.room_id || data.payload?.call_id,
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
      stopInCallAudio();
    };
  }, [
    addOrUpdateParticipant,
    chatId,
    currentUser?.avatar,
    currentUser?.name,
    currentUserId,
    getContactById,
    incomingCallId,
    isHost,
    navigation,
    route.params?.chatName,
    startInCallAudio,
    stopInCallAudio,
  ]);

  const toggleMute = () => {
    if (!localStream) {
      console.warn('[Mute] No local stream!');
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    console.log('[Mute] Audio tracks before toggle:', audioTracks.length);

    const next = !isMicMuted;
    audioTracks.forEach(track => {
      track.enabled = !next;
      console.log('[Mute] Track', track.id, 'enabled:', track.enabled);
    });

    InCallManager.setMicrophoneMute(next);
    setIsMicMuted(next);
  };

  // ✅✅✅ 用 InCallManager 控制扬声器（不要用 Audio.setAudioModeAsync 切路由）
  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    InCallManager.setForceSpeakerphoneOn(next);
  };

  const hangup = async () => {
    isHangingUpRef.current = true;

    const finalDuration = formatDuration(durationRef.current);
    const receivers = participants.filter(p => p.userId !== currentUserId).map(p => p.userId);

    if (callIdRef.current && TcpSocketService.isSocketConnected()) {
      if (isHost) {
        TcpSocketService.sendEnd(currentUserId, callIdRef.current);
      } else {
        TcpSocketService.sendDrop(currentUserId, callIdRef.current);
      }
    }

    if (callIdRef.current) {
      const action = isHost ? 'end' : 'leave';
      try {
        await callRoom({ call_id: callIdRef.current, action, user_id: currentUserId });
      } catch { }
    }

    TcpSocketService.disconnect();

    if (isHost) {
      const endCallData = JSON.stringify({
        type: 'GROUP_VOICE_CALL',
        roomId: chatId,
        hostName: currentUser?.name,
        status: 'ended',
        duration: finalDuration,
        startTime: new Date().toISOString(),
        call_id: callIdRef.current,
      });

      sendChatMessage({
        sender: currentUserId,
        isreceive: [],
        chat_id: chatId,
        message: endCallData,
        type: 4,
      }).catch(() => { });
    }

    if (receivers.length > 0) {
      WebSocketManager.sendCallSignal({
        type: 'LEAVE_CALL',
        chat_id: chatId,
        sender: currentUserId,
        receiver: receivers,
        call_id: callIdRef.current || undefined,
      });
    }

    callServiceRef.current?.destroy();
    stopInCallAudio();

    if (!isHost) {
      Alert.alert('通话结束', '你已成功退出通话', [
        {
          text: '确定',
          onPress: () => {
            (navigation as any).replace('GroupRoom', {
              chatId,
              chatName: route.params?.chatName || '群聊',
            } as never);
          },
        },
      ]);
    } else {
      (navigation as any).replace('GroupRoom', {
        chatId,
        chatName: route.params?.chatName || '群聊',
      } as never);
    }
  };

  const renderParticipant = ({ item }: { item: CallParticipant }) => (
    <View style={styles.gridItem}>
      <View style={[styles.avatarContainer, item.isSpeaking && styles.speakingBorder]}>
        <Image
          source={
            !item.avatar ||
              item.avatar.trim() === '' ||
              item.avatar.trim() === 'https://balkingly-hemitropic-lelah.ngrok-free.dev'
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
              stopInCallAudio();
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
      {/* ✅ 隐藏 RTCView 激活远程音频 */}
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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>多人通话 ({participants.length})</Text>
        <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text>
      </View>

      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={item => item.userId}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          <View style={[styles.iconCircle, isMicMuted ? styles.iconActive : null]}>
            <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={28} color={isMicMuted ? '#000' : '#fff'} />
          </View>
          <Text style={styles.controlText}>{isMicMuted ? '已静音' : '静音'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangupButtonContainer} onPress={hangup}>
          <View style={styles.hangupButton}>
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </View>
          <Text style={styles.controlText}>挂断</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
          <View style={[styles.iconCircle, isSpeakerOn ? styles.iconActive : null]}>
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
              size={28}
              color={isSpeakerOn ? '#000' : '#fff'}
            />
          </View>
          <Text style={styles.controlText}>{isSpeakerOn ? '免提开' : '免提'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#202020' },
  hiddenAudioView: { width: 0, height: 0, position: 'absolute', opacity: 0 },

  header: { paddingTop: 20, paddingBottom: 10, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 5 },
  timerText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontVariant: ['tabular-nums'] },

  gridContainer: { padding: 20, alignItems: 'flex-start' },
  gridItem: { width: width / 3 - 20, alignItems: 'center', marginBottom: 30, marginHorizontal: 3 },

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
  speakingBorder: { borderWidth: 3, borderColor: '#07C160' },
  avatarImage: { width: '100%', height: '100%' },

  nameText: { color: 'white', fontSize: 13, marginTop: 8, textAlign: 'center' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 30,
  },

  controlButton: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconActive: { backgroundColor: '#fff' },

  hangupButtonContainer: { alignItems: 'center', justifyContent: 'center' },
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

  controlText: { color: '#fff', fontSize: 12, textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 20, textAlign: 'center' },

  cancelButton: { marginTop: 40, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25, borderWidth: 1, borderColor: '#FF3B30' },
  cancelButtonText: { color: '#FF3B30', fontSize: 16 },
});
