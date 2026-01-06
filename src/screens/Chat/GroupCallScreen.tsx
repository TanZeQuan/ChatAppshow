import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { mediaDevices, MediaStream } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons'; 

import { readUsers } from '../../api/User';
import WebSocketManager from '../../services/WebSocketManager';
import { useUserStore } from '../../store/userStore';
import { useContactStore } from '../../store/contactStore';
import { sendChatMessage } from '../../api/Chat';

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
  const durationRef = useRef(0); // Use Ref to ensure hangup function accesses the latest value

  // 1. Start Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds(prev => {
        const next = prev + 1;
        durationRef.current = next; // Sync ref update
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 2. Get Local Stream (Audio Only)
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true, 
        video: false, // ❌ Disable video for voice call
      });
      
      setLocalStream(stream);

      // Initialize self
      setParticipants([{
        userId: currentUserId,
        userName: currentUser?.name || 'Me',
        avatar: currentUser?.avatar || '',
        stream: stream,
        isSpeaking: false, 
      }]);

      // Send Join Signal
      WebSocketManager.sendCallSignal({
        type: 'JOIN_CALL',
        chat_id: chatId,
        sender: currentUserId
      });

    } catch (err) {
      console.error('Failed to get local stream', err);
      Alert.alert('Permission Error', 'Cannot access microphone');
    }
  }, [chatId, currentUserId, currentUser]);

  // 3. Fetch and Add Participant Logic
  const fetchAndAddParticipant = useCallback(async (userId: string, stream?: any) => {
    if (userId === currentUserId) return;

    let name = userId;
    let avatar = '';

    const localContact = getContactById(userId);
    if (localContact) {
      name = localContact.name || userId;
      avatar = localContact.avatar || '';
    } else {
      try {
        const result = await readUsers(userId);
        if (result.success && result.data) {
          const userData = result.data.response || result.data;
          name = userData.name || userData.username || userId;
          avatar = userData.image || userData.avatar || '';
        }
      } catch (e) {
        console.error('Fetch user error', e);
      }
    }

    setParticipants(prev => {
      const exists = prev.some(p => p.userId === userId);
      if (exists) {
        return prev.map(p => p.userId === userId ? { ...p, stream: stream || p.stream } : p);
      }
      return [...prev, { userId, userName: name, avatar, stream, isSpeaking: false }];
    });
  }, [getContactById, currentUserId]);

  // 4. Simulate Speaking State (Placeholder for VAD)
  useEffect(() => {
    const interval = setInterval(() => {
        // In real WebRTC, you would monitor audioLevel here
        setParticipants(prev => prev.map(p => ({
            ...p,
            isSpeaking: false 
        })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Initialize & Listen for Signals
  useEffect(() => {
    console.log('🚀 GroupCallScreen Mounted');
    startLocalStream();

    const handleCallSignal = (data: any) => {
      if (data.chat_id !== chatId || data.sender === currentUserId) return;

      switch (data.type) {
        case 'JOIN_CALL':
          fetchAndAddParticipant(data.sender);
          break;
        case 'LEAVE_CALL':
          setParticipants(prev => prev.filter(p => p.userId !== data.sender));
          break;
      }
    };

    WebSocketManager.addCallCallback(handleCallSignal);

    return () => {
      WebSocketManager.removeCallCallback(handleCallSignal);
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      WebSocketManager.sendCallSignal({
        type: 'LEAVE_CALL',
        chat_id: chatId,
        sender: currentUserId
      });
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMicMuted;
        });
        setIsMicMuted(!isMicMuted);
    }
  };

  const hangup = async () => {
    // ✅ Get final duration string
    const finalDuration = formatDuration(durationRef.current);

    if (isHost) {
        const endCallData = JSON.stringify({
            type: 'GROUP_VIDEO_CALL',
            roomId: chatId,
            hostName: currentUser?.name,
            status: 'ended',
            duration: finalDuration, // ✅ Send actual calculated duration
            startTime: new Date().toISOString()
        });
        
        await sendChatMessage({
            sender: currentUserId,
            isreceive: [],
            chat_id: chatId,
            message: endCallData,
            type: 4
        });
    }

    WebSocketManager.sendCallSignal({
        type: 'LEAVE_CALL',
        chat_id: chatId,
        sender: currentUserId
    });
    navigation.goBack();
  };

  // ✅ Render Single Participant (WeChat Voice Style)
  const renderParticipant = ({ item }: { item: CallParticipant }) => (
    <View style={styles.gridItem}>
      <View style={[
          styles.avatarContainer, 
          // 🟢 Green border when speaking
          item.isSpeaking && styles.speakingBorder 
      ]}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarImage, { backgroundColor: '#555', justifyContent: 'center', alignItems: 'center' }]}>
             <Text style={{color:'#fff', fontSize: 24}}>{item.userName?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
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
        <Text style={styles.headerTitle}>聊天室({participants.length})</Text>
        {/* ✅ Dynamic Timer */}
        <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text> 
      </View>

      {/* Grid List (3 Columns) */}
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
            <Text style={styles.controlText}>{isMicMuted ? "Muted" : "Mute"}</Text>
        </TouchableOpacity>

        {/* Hangup Button */}
        <TouchableOpacity style={styles.hangupButtonContainer} onPress={hangup}>
            <View style={styles.hangupButton}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text style={styles.controlText}>End</Text>
        </TouchableOpacity>

        {/* Speaker Button */}
        <TouchableOpacity style={styles.controlButton} onPress={() => setIsSpeakerOn(!isSpeakerOn)}>
            <View style={[styles.iconCircle, isSpeakerOn ? styles.iconActive : null]}>
                <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={isSpeakerOn ? "#000" : "#fff"} />
            </View>
            <Text style={styles.controlText}>{isSpeakerOn ? "Speaker" : "Speaker"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#202020', // Dark grey background like WeChat
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
    fontVariant: ['tabular-nums'], // Prevents numbers jumping
  },
  gridContainer: {
    padding: 20,
    alignItems: 'flex-start',
  },
  gridItem: {
    width: width / 3 - 20, // 3 Columns
    alignItems: 'center',
    marginBottom: 30,
    marginHorizontal: 3,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 8, // Rounded square
    overflow: 'hidden',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  speakingBorder: {
    borderWidth: 3,
    borderColor: '#07C160', // WeChat Green
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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