import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Import API and Store
import { createFriendRequest } from '../api/Friend';
import { useContactStore } from '../store/contactStore';
import { useUserStore } from '../store/userStore';

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;

interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number;
  imageUrls?: string[];
  voiceUrl?: string;
  cardData?: {
    userId: string;
    userName: string;
    userAvatar?: string;
  };
  createdAt: string;
  sender: 'me' | 'other';
  username?: string;
  avatar?: string;
  readBy?: string[];
}

interface MessageBubbleProps {
  item: DisplayMessage;
  index: number;
  playingVoice: string | null;
  voiceDurations: Record<string, number>;
  playbackPosition: number;
  playAudio: (voiceUrl: string, messageId: string) => void;
  stopAudio: () => void;
  formatTime: (millis: number) => string;
  searchMode: boolean;
  searchQuery: string;
  currentMatchId: string | null;
  currentUserAvatar: string;
  roomStyles: any;
  showSenderName?: boolean;
  chatUnreadCount: number;
  totalMembers?: number;
}

// ✅ 性能优化：使用 React.memo 包装组件，避免不必要的重渲染
// 只有当 props 发生变化时才会重新渲染
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  item,
  playingVoice,
  voiceDurations,
  playbackPosition,
  playAudio,
  stopAudio,
  formatTime,
  searchMode,
  searchQuery,
  currentMatchId,
  currentUserAvatar,
  roomStyles,
  showSenderName,
  chatUnreadCount,
  totalMembers,
}) => {
  const navigation = useNavigation<any>();
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const contacts = useContactStore((state) => state.contacts);
  const currentUser = useUserStore((state) => state.user);

  const openImageViewer = (index: number) => {
    setInitialImageIndex(index);
    setImageViewerVisible(true);
  };

  // ---------------------------------------------------------
  // 1. Core Parsing Logic
  // ---------------------------------------------------------
  const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

  let parsedCardData = item.cardData;
  let isCallMessage = false;
  let isContactCard = false;

  // Try to parse JSON if it looks like JSON and isn't already parsed
  if (!parsedCardData && typeof messageText === 'string' && (messageText.startsWith('{') || messageText.startsWith('['))) {
    try {
      const parsed = JSON.parse(messageText);

      // Check for Call
      if (parsed.type === 'GROUP_VIDEO_CALL' || parsed.type === 'GROUP_VOICE_CALL' || parsed.type === 'SINGLE_VOICE_CALL') {
        isCallMessage = true;
      }
      // Check for Contact Card
      else if (parsed.userId && parsed.userName) {
        parsedCardData = parsed;
        isContactCard = true;
      }
    } catch (e) {
      // Not valid JSON, treat as text
    }
  } else {
    // Fallback based on type ID if JSON parse wasn't needed
    if (item.type === 4 && !parsedCardData) isCallMessage = true;
    if (item.cardData) isContactCard = true;
  }

  // ---------------------------------------------------------
  // 2. Logic Helpers
  // ---------------------------------------------------------
  const isSearchMatched = searchMode && searchQuery.trim() && messageText.toLowerCase().includes(searchQuery.toLowerCase());
  const isCurrentMatch = searchMode && currentMatchId && item.id === currentMatchId;

  const getReadStatus = () => {
    if (item.sender !== 'me') return null;
    const readBy = item.readBy || [];
    
    // 群聊：检查是否所有其他成员都已读
    if (totalMembers && totalMembers > 2) {
      const isReadByAll = readBy.length >= (totalMembers - 1);
      return isReadByAll ? 'double' : 'single';
    } 
    // 单聊：检查 readBy 数组是否有对方
    else {
      // 只有当 readBy 数组有值时才显示双勾（对方已读）
      // 不再使用 chatUnreadCount，因为那是「我的未读数」，不是「对方的未读数」
      return readBy.length > 0 ? 'double' : 'single';
    }
  };
  const readStatus = getReadStatus();

  // Helper to get safe avatar source
  const getAvatarSource = (url?: string) => {
    if (!url || url === '' || url.length < 5) {
      return require('../assets/images/personal.png');
    }
    return { uri: url };
  };

  // ---------------------------------------------------------
  // 3. Handlers
  // ---------------------------------------------------------
  const handleContactCardPress = async (cardData: any) => {
    if (!cardData || !cardData.userId) return;

    if (currentUser && cardData.userId === currentUser.id) {
      Alert.alert('提示', '这是你自己的名片');
      return;
    }

    const isAlreadyFriend = contacts.some(contact => contact.id === cardData.userId);
    if (isAlreadyFriend) {
      Alert.alert('提示', `${cardData.userName} 已经是你的好友了`);
      return;
    }

    Alert.alert(
      '添加好友',
      `是否添加 ${cardData.userName} 为好友？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '添加',
          onPress: async () => {
            try {
              const result = await createFriendRequest(cardData.userId);
              if (result.success) {
                Alert.alert('成功', '好友请求已发送');
              } else {
                const msg = result.message || '';
                if (msg.includes('好友') || msg.includes('friend')) Alert.alert('提示', '你们已经是好友了');
                else if (msg.includes('pending')) Alert.alert('提示', '请求已发送，请等待');
                else Alert.alert('错误', msg || '发送失败');
              }
            } catch (error) {
              Alert.alert('错误', '网络请求失败');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------
  // 4. Render Call Card
  // ---------------------------------------------------------
  const renderCallCard = () => {
    let callData: any = {};
    try {
      callData = JSON.parse(messageText);
    } catch (e) {
      return <Text style={roomStyles.messageText}>{messageText}</Text>;
    }

    const isEnded = callData.status === 'ended';
    const isCancelled = callData.status === 'cancelled';
    const isRejected = callData.status === 'rejected';
    const isInactive = isEnded || isCancelled || isRejected;

    const isVideo = callData.type === 'GROUP_VIDEO_CALL';
    const isGroupVoice = callData.type === 'GROUP_VOICE_CALL';
    const iconName = isVideo ? "videocam" : "call";

    // ✅ FIXED: Corrected text logic
    let titleText = '';
    if (isInactive) {
      titleText = isVideo ? '视频通话结束' : '语音通话结束';
    } else {
      titleText = isVideo ? '邀请视频通话' : '邀请语音通话';
    }

    let subText = callData.displayMessage || '点击查看';
    if (!callData.displayMessage) {
      if (isEnded) subText = `通话时长 ${callData.duration || '00:00'}`;
      else if (isCancelled) subText = '已取消';
      else if (isRejected) subText = '已拒绝';
      else subText = '点击加入通话';
    }

    const handlePress = () => {
      if (!isInactive && callData.roomId) {
        // 群聊通话：传递 chatId 和 callId (如果有)
        // callId 可能在 callData.call_id 或 callData.callId 中
        const callId = callData.call_id || callData.callId || null;
        
        console.log('[CallCard] 点击通话卡片:', {
          type: callData.type,
          roomId: callData.roomId,
          call_id: callId,
          status: callData.status,
        });
        
        if (callData.type === 'SINGLE_VOICE_CALL') {
          // 单聊通话卡片 - 通常是已结束的，不需要加入
          // 如果需要回拨，可以在这里添加逻辑
          return;
        }
        
        if (!callId) {
          Alert.alert('无法加入', '通话信息不完整，请等待新的邀请');
          return;
        }
        
        // 群聊通话
        navigation.navigate('GroupCallScreen', {
          chatId: callData.roomId,
          isHost: false,
          callId: callId,  // ✅ 传递 callId (对应 GroupCallScreen 的 incomingCallId)
        });
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.callCardContainer,
          isInactive ? styles.callCardEnded : styles.callCardActive,
          item.sender === 'other' && !isInactive && { backgroundColor: '#fff' }
        ]}
        disabled={isInactive}
        onPress={handlePress}
      >
        <View style={styles.callCardIconContent}>
          <View style={[
            styles.iconCircle,
            isInactive ? styles.iconCircleEnded : styles.iconCircleActive,
            item.sender === 'other' && !isInactive && { backgroundColor: '#FFA500' }
          ]}>
            <Ionicons name={iconName} size={scaleWidth(24)} color="#FFF" />
          </View>
          <View style={styles.callCardTextContent}>
            <Text style={[
              styles.callCardTitle,
              item.sender === 'other' && !isInactive && { color: '#000' }
            ]}>
              {titleText}
            </Text>
            <Text style={[
              styles.callCardSubtext,
              item.sender === 'other' && !isInactive && { color: '#666' }
            ]}>
              {subText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------
  // 5. Main Render
  // ---------------------------------------------------------
  return (
    <>
      <Modal visible={imageViewerVisible} transparent={true} animationType="fade" onRequestClose={() => setImageViewerVisible(false)}>
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <ScrollView horizontal pagingEnabled contentOffset={{ x: initialImageIndex * width, y: 0 }} showsHorizontalScrollIndicator={false}>
            {item.imageUrls?.map((url, imgIndex) => (
              <View key={imgIndex} style={styles.imageContainer}>
                <Image source={{ uri: url }} style={styles.fullScreenImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <View style={[roomStyles.messageRow, item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft]}>

        {/* Left Avatar (Other) */}
        {item.sender === 'other' && (
          <View style={roomStyles.avatar}>
            <Image
              source={getAvatarSource(item.avatar)}
              style={roomStyles.avatarImage}
            />
          </View>
        )}

        {/* Message Bubble */}
        <View style={[
          roomStyles.bubble,
          item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
          // Transparent background for Cards
          (isCallMessage || isContactCard) && { padding: 0, backgroundColor: 'transparent', overflow: 'visible', borderWidth: 0 },
          isSearchMatched && { backgroundColor: '#FFA500' },
          isCurrentMatch && { backgroundColor: '#FF8C00', borderWidth: 1.5, borderColor: '#FF6347' },
        ]}>

          {/* Sender Name */}
          {showSenderName && item.sender === 'other' && !isCallMessage && !isContactCard && (
            <Text style={roomStyles.senderName}>{item.senderName}</Text>
          )}

          {/* --- Content Switching --- */}

          {isCallMessage ? (
            renderCallCard()
          ) : isContactCard && parsedCardData ? (
            // Contact Card
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContactCardPress(parsedCardData)}
              activeOpacity={0.9}
            >
              <Image
                source={getAvatarSource(parsedCardData.userAvatar)}
                style={styles.contactCardAvatar}
              />
              <View style={styles.contactCardInfo}>
                <Text style={styles.contactCardName} numberOfLines={1}>
                  {parsedCardData.userName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="person-circle-outline" size={14} color="#888" style={{ marginRight: 4 }} />
                  <Text style={styles.contactCardLabel}>个人名片</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            // Standard Message (Text, Voice, Image)
            <>
              {item.type === 1 && <Text style={roomStyles.messageText}>{messageText}</Text>}

              {item.type === 2 && item.voiceUrl && (
                <View style={roomStyles.voiceMessageContainer}>
                  <TouchableOpacity 
                    style={roomStyles.voicePlayButton}
                    onPress={() => playingVoice === item.id ? stopAudio() : playAudio(item.voiceUrl!, item.id)}
                  >
                    <Ionicons name={playingVoice === item.id ? "pause-circle" : "play-circle"} size={scaleWidth(28)} color={item.sender === 'me' ? "#000000ff" : "#1c275b"} />
                  </TouchableOpacity>
                  <Text style={[roomStyles.voiceDuration, item.sender === 'me' && { color: '#000000ff' }]}>
                    {playingVoice === item.id 
                      ? `播放中 [ ${Math.max(0, (voiceDurations[item.id] || 0) - Math.floor(playbackPosition / 1000))}秒 ]`
                      : voiceDurations[item.id] 
                        ? `语音 [ ${voiceDurations[item.id]}秒 ]` 
                        : '语音'}
                  </Text>
                </View>
              )}

              {item.type === 3 && (
                <View style={roomStyles.imageGridContainer}>
                  {item.imageUrls?.map((url, idx) => (
                    <TouchableOpacity key={idx} activeOpacity={0.9} onPress={() => openImageViewer(idx)}>
                      <Image source={{ uri: url }} style={roomStyles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Footer (Time & Read Status) */}
          {!isCallMessage && (
            <View style={[styles.bubbleFooter, {
              justifyContent: item.sender === 'me' ? 'flex-end' : 'flex-start',
              marginTop: isContactCard ? 4 : 0,
              marginRight: isContactCard ? 4 : 0,
              marginLeft: isContactCard ? 8 : 0,
            }]}>
              <Text style={[
                roomStyles.timestamp,
                item.sender === 'me' && !isContactCard && { color: '#080808ff' },
                isContactCard && { color: '#999', fontSize: 10 }
              ]}>
                {(() => {
                  // ✅ 统一时间解析：处理后端马来西亚时间 (GMT+8) 和 ISO 格式，显示 AM/PM 格式
                  const timestamp = item.createdAt;
                  if (!timestamp) return '';
                  
                  // 转换为 12 小时制 AM/PM 格式
                  const formatToAmPm = (h: number, m: number): string => {
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const hour12 = h % 12 || 12; // 0 点变成 12
                    const minuteStr = m.toString().padStart(2, '0');
                    return `${hour12}:${minuteStr} ${ampm}`;
                  };
                  
                  // 检查是否是 "YYYY-MM-DD HH:mm:ss" 格式（后端马来西亚时间，无时区标识）
                  const dateTimeMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
                  if (dateTimeMatch) {
                    // 直接提取时间部分，不做时区转换（因为后端已经是正确的显示时间）
                    const [, , , , hour, minute] = dateTimeMatch;
                    return formatToAmPm(parseInt(hour, 10), parseInt(minute, 10));
                  }
                  
                  // ISO 格式或其他格式，使用 Date 解析后转本地时间
                  const date = new Date(timestamp);
                  if (isNaN(date.getTime())) return '';
                  return formatToAmPm(date.getHours(), date.getMinutes());
                })()}
              </Text>
              {readStatus && (
                <Ionicons
                  name={readStatus === 'double' ? "checkmark-done" : "checkmark"}
                  size={16}
                  color={readStatus === 'double' ? "#4facfe" : "#666"}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          )}
        </View>

        {/* Right Avatar (Me) */}
        {item.sender === 'me' && (
          <View style={roomStyles.avatar}>
            <Image
              source={getAvatarSource(item.avatar)}
              style={roomStyles.avatarImage}
            />
          </View>
        )}
      </View>
    </>
  );
};

// ✅ 使用 React.memo 包装并导出
export const MessageBubble = React.memo(MessageBubbleComponent);

// Styles
const styles = StyleSheet.create({
  imageViewerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 25, zIndex: 10 },
  imageContainer: { width: width, height: height, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: width, height: height * 0.85 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  // Call Card
  callCardContainer: {
    padding: 15,
    width: width * 0.53,
    borderRadius: 12,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  callCardActive: { backgroundColor: '#ffc824ff' },
  callCardEnded: { backgroundColor: '#333' },

  callCardIconContent: { flexDirection: 'row', alignItems: 'center' },

  iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconCircleActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  iconCircleEnded: { backgroundColor: 'rgba(255,255,255,0.1)' },

  callCardTextContent: { flex: 1 },
  callCardTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  callCardSubtext: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },

  // Contact Card
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    width: scaleWidth(200),
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactCardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  contactCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  contactCardLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
});