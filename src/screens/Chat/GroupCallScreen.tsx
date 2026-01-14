import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MediaStream } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';

import { readChatMessages, sendChatMessage } from '../../api/Chat';
import WebSocketManager from '../../services/WebSocketManager';

import { useUserStore } from '../../store/userStore';
import { useContactStore } from '../../store/contactStore';
import { P2PManager } from '../../services/GroupCallService';

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
  const { chatId, isHost } = route.params || {};

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
  
  // ✅ P2P Manager Reference
  const p2pRef = useRef<P2PManager | null>(null);

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

  // 3. Initialize P2P & Local Stream
  useEffect(() => {
    console.log('🚀 GroupCallScreen Mounted');
    
    // Initialize P2P Manager
    p2pRef.current = new P2PManager(currentUserId, chatId);

    const initCall = async () => {
      try {
        // Get Local Stream via P2P Manager
        const stream = await p2pRef.current?.initLocalStream();
        setLocalStream(stream || null);

        // Add self to grid
        setParticipants([{
          userId: currentUserId,
          userName: currentUser?.name || 'Me',
          avatar: currentUser?.avatar || '',
          stream: stream,
          isSpeaking: false,
        }]);

        // Get Group Members (to broadcast JOIN)
        // Note: Ideally fetch from API, here we rely on broadcasting
        const result = await readChatMessages({ chat_id: chatId, user_id: currentUserId, offset: 0 });
        const receivers = result.data?.group?.map((m: any) => m.user_id).filter((id: string) => id !== currentUserId) || [];

        if (receivers.length > 0) {
            console.log('📡 发送 JOIN_CALL (用于触发连接，不应触发弹窗)');
            // ✅ 改回 JOIN_CALL，确保 P2P 握手正常
            WebSocketManager.sendCallSignal({
              type: 'JOIN_CALL', 
              chat_id: chatId,
              sender: currentUserId,
              receiver: receivers,
              payload: { userName: currentUser?.name, avatar: currentUser?.avatar }
            });
        }
        

      } catch (err) {
        console.error('Failed to init call:', err);
        Alert.alert('Error', 'Failed to access microphone');
      }
    };

    initCall();

    // 4. Signal Handling (Delegated to P2PManager)
    const handleCallSignal = async (data: any) => {
      // Basic validation
      const incomingChatId = data.chat_id || chatId;
      if (String(incomingChatId) !== String(chatId)) return;
      
      const senderId = data.sender || data.user_id;
      if (String(senderId) === String(currentUserId)) return;

      const payload = data.payload || {}; // Contains sdp, candidate, or user info

     switch (data.type) {
        // ✅ 监听 JOIN_CALL，这样别人进来时，你才会发 Offer，大家才能互看
        case 'JOIN_CALL': 
          addOrUpdateParticipant(senderId, payload);
          console.log(`⚡以此触发 P2P Offer -> ${senderId}`);
          await p2pRef.current?.makeOffer(senderId, (remoteStream: MediaStream | undefined) => {
             addOrUpdateParticipant(senderId, null, remoteStream);
          });
          break;

        case 'offer':
          // Received Offer: Handle & Answer
          addOrUpdateParticipant(senderId, payload); // Ensure user shows up
          await p2pRef.current?.handleOffer(senderId, payload.sdp, data.call_id, (remoteStream: MediaStream | undefined) => {
             addOrUpdateParticipant(senderId, null, remoteStream);
          });
          break;

        case 'answer':
          // Received Answer
          await p2pRef.current?.handleAnswer(senderId, payload.sdp);
          break;

        case 'candidate':
          // Received ICE Candidate
          await p2pRef.current?.handleCandidate(senderId, payload.candidate);
          break;

        case 'LEAVE_CALL':
        case 'end':
          // User left
          p2pRef.current?.removePeer(senderId);
          setParticipants(prev => prev.filter(p => p.userId !== senderId));
          break;
      }
    };

    WebSocketManager.addCallCallback(handleCallSignal);

    return () => {
      WebSocketManager.removeCallCallback(handleCallSignal);
      p2pRef.current?.destroy(); // Cleanup P2P connections and streams
    };
  }, [addOrUpdateParticipant, chatId, currentUser?.avatar, currentUser?.name, currentUserId]);

  const toggleMute = () => {
    if (localStream) {
        const newMutedState = !isMicMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !newMutedState;  // ✅ 修复：静音时 enabled=false，非静音时 enabled=true
        });
        setIsMicMuted(newMutedState);
        console.log(`🎤 [GroupCall] 麦克风${newMutedState ? '已静音' : '已开启'}`);
    }
  };

  const hangup = async () => {
    const finalDuration = formatDuration(durationRef.current);
    const receivers = participants.filter(p => p.userId !== currentUserId).map(p => p.userId);

    if (isHost) {
        // Host sends system message to end call in chat
        const endCallData = JSON.stringify({
            type: 'GROUP_VOICE_CALL',  // ✅ 修复：语音通话应该是 VOICE_CALL
            roomId: chatId,
            hostName: currentUser?.name,
            status: 'ended',
            duration: finalDuration,
            startTime: new Date().toISOString()
        });
        
        sendChatMessage({
            sender: currentUserId,
            isreceive: [], // Server handles broadcast for system messages usually
            chat_id: chatId,
            message: endCallData,
            type: 4
        }).catch(e => console.log('End call msg error', e));
    }

    // Broadcast LEAVE to peers so they close connection
    if (receivers.length > 0) {
        WebSocketManager.sendCallSignal({
            type: 'LEAVE_CALL',
            chat_id: chatId,
            sender: currentUserId,
            receiver: receivers
        });
    }

    // ✅ 挂断后返回聊天室
    (navigation as any).replace('GroupRoom', {
      chatId: chatId,
      chatName: route.params?.chatName || '群聊',
    } as never);
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

  return (
    <SafeAreaView style={styles.container}>
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
        <TouchableOpacity style={styles.controlButton} onPress={() => setIsSpeakerOn(!isSpeakerOn)}>
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
    alignItems: 'flex-end',
    paddingBottom: 50,
    paddingHorizontal: 30,
  },
  controlButton: {
    alignItems: 'center',
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
    bottom: 10, 
  },
  hangupButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
  },
});