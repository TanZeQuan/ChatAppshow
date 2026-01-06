import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;

// ... 保持 Interface 定义不变 ...
interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number;
  imageUrls?: string[];
  voiceUrl?: string;
  createdAt: string;
  sender: 'me' | 'other';
  username?: string;
  avatar?: string;
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
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
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
}) => {
  const navigation = useNavigation<any>();
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const openImageViewer = (index: number) => {
    setInitialImageIndex(index);
    setImageViewerVisible(true);
  };

  const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');
  const isSearchMatched = searchMode && searchQuery.trim() && messageText.toLowerCase().includes(searchQuery.toLowerCase());
  const isCurrentMatch = searchMode && currentMatchId && item.id === currentMatchId;
  
  const readStatus = item.sender === 'me' ? (chatUnreadCount === 0 ? 'double' : 'single') : null;

  // 🕵️‍♂️ 智能检测：是否为通话信令消息
  // 即使后端 type 传错了，这里也能拦截到
  const isCallMessage = item.type === 4 || (typeof messageText === 'string' && messageText.includes('"type":"GROUP_VIDEO_CALL"'));

  // ✅ 渲染微信风格通话卡片
  const renderCallCard = () => {
    let callData: any = {};
    let isEnded = false;

    try {
      callData = JSON.parse(messageText);
      if (callData.status === 'ended') {
        isEnded = true;
      }
    } catch (e) {
      // 如果解析失败，回退显示文本
      return <Text style={roomStyles.messageText}>{messageText}</Text>;
    }

    return (
      <TouchableOpacity 
        style={[
          styles.callCardContainer, 
          isEnded ? styles.callCardEnded : styles.callCardActive
        ]} 
        disabled={isEnded}
        onPress={() => navigation.navigate('GroupCallScreen', { chatId: callData.roomId, isHost: false })}
      >
        <View style={styles.callCardIconContent}>
          <View style={[styles.iconCircle, isEnded && styles.iconCircleEnded]}>
              <Ionicons name="videocam" size={scaleWidth(24)} color={isEnded ? "#FFF" : "#FFF"} />
          </View>
          <View style={styles.callCardTextContent}>
            <Text style={styles.callCardTitle}>
              {isEnded ? '通话已结束' : '邀请你加入群聊视频'}
            </Text>
            <Text style={styles.callCardSubtext}>
              {isEnded 
                ? `通话时长 ${callData.duration || '00:00'}` 
                : '点击加入通话'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={imageViewerVisible} transparent={true} animationType="fade" onRequestClose={() => setImageViewerVisible(false)}>
        {/* ... 图片预览 Modal 代码不变 ... */}
      </Modal>

      <View style={[roomStyles.messageRow, item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft]}>
        {item.sender === 'other' && (
          <View style={roomStyles.avatar}>
            <Image
              source={!item.avatar || item.avatar.length < 10 ? require('../assets/images/personal.png') : { uri: item.avatar }}
              style={roomStyles.avatarImage}
            />
          </View>
        )}

        <View style={[
          roomStyles.bubble,
          item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
          
          // 🔑 关键修复：如果是通话卡片，移除气泡的默认背景色和内边距，让卡片自己控制样式
          isCallMessage && { padding: 0, backgroundColor: 'transparent', overflow: 'visible', borderWidth: 0 },
          
          isSearchMatched && { backgroundColor: '#FFA500' },
          isCurrentMatch && { backgroundColor: '#FF8C00', borderWidth: 1.5, borderColor: '#FF6347' },
        ]}>
          
          {showSenderName && item.sender === 'other' && !isCallMessage && (
            <Text style={roomStyles.senderName}>{item.senderName}</Text>
          )}

          {/* 渲染逻辑分流 */}
          {isCallMessage ? (
            renderCallCard()
          ) : (
            <>
              {/* 普通文本 */}
              {item.type === 1 && <Text style={roomStyles.messageText}>{messageText}</Text>}

              {/* 语音消息 */}
              {item.type === 2 && item.voiceUrl && (
                <View style={roomStyles.voiceMessageContainer}>
                  {/* ... 语音逻辑不变 ... */}
                  <TouchableOpacity onPress={() => playingVoice === item.id ? stopAudio() : playAudio(item.voiceUrl!, item.id)}>
                    <Ionicons name={playingVoice === item.id ? "pause-circle" : "play-circle"} size={scaleWidth(28)} color={item.sender === 'me' ? "#FFF" : "#1c275b"} />
                  </TouchableOpacity>
                  <Text style={[roomStyles.voiceDuration, item.sender === 'me' && { color: '#EEE' }]}>
                    {playingVoice === item.id ? '播放中' : '语音'}
                  </Text>
                </View>
              )}

              {/* 图片消息 */}
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

          {/* 时间戳 (通话卡片不显示这个时间戳，因为卡片样式里通常不带外置时间) */}
          {!isCallMessage && (
            <View style={[styles.bubbleFooter, { justifyContent: item.sender === 'me' ? 'flex-end' : 'flex-start' }]}>
              <Text style={[
                roomStyles.timestamp, 
                item.sender === 'me' && { color: '#EEE' }
              ]}>
                {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {readStatus && (
                <Ionicons 
                  name={readStatus === 'double' ? "checkmark-done" : "checkmark"} 
                  size={16} 
                  color={readStatus === 'double' ? "#4facfe" : "#CCC"} 
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          )}
        </View>

        {item.sender === 'me' && (
          <View style={roomStyles.avatar}>
            <Image
              source={!currentUserAvatar || currentUserAvatar.length < 10 ? require('../assets/images/personal.png') : { uri: currentUserAvatar }}
              style={roomStyles.avatarImage}
            />
          </View>
        )}
      </View>
    </>
  );
};

// 🎨 微信/WhatsApp 风格样式
const styles = StyleSheet.create({
  // ... 图片预览样式不变 ...
  imageViewerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 25, zIndex: 10 },
  closeButtonText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  imageContainer: { width: width, height: height, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: width, height: height * 0.85 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  // ✅ 通话卡片样式
  callCardContainer: {
    padding: 15,
    width: width * 0.65,
    borderRadius: 12,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  // 正在通话：橙色背景 (类似微信邀请)
  callCardActive: {
    backgroundColor: '#FA9D3B', 
  },
  // 通话结束：深灰色背景
  callCardEnded: {
    backgroundColor: '#333', 
  },
  callCardIconContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
  },
  iconCircle: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255,255,255,0.2)', // 半透明白底
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  iconCircleEnded: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  callCardTextContent: { 
    flex: 1 
  },
  callCardTitle: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 16,
    marginBottom: 4
  },
  callCardSubtext: { 
    color: 'rgba(255,255,255,0.9)', 
    fontSize: 12, 
  },
});