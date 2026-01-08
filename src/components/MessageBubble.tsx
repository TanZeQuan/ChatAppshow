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

// 引入 API 和 Store
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
  // 1. 核心解析逻辑
  // ---------------------------------------------------------
  const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

  let parsedCardData = item.cardData;
  let isCallMessage = false;
  let isContactCard = false;

  if (!parsedCardData && typeof messageText === 'string' && (messageText.startsWith('{') || messageText.startsWith('['))) {
    try {
      const parsed = JSON.parse(messageText);

      // 判断通话
      if (parsed.type === 'GROUP_VIDEO_CALL' || parsed.type === 'SINGLE_VOICE_CALL') {
        isCallMessage = true;
      }
      // 判断名片
      else if (parsed.userId && parsed.userName) {
        parsedCardData = parsed;
        isContactCard = true;
      }
    } catch (e) {
      // ignore
    }
  } else {
    if (item.type === 4 && !parsedCardData) isCallMessage = true;
    if (item.cardData) isContactCard = true;
  }

  // ---------------------------------------------------------
  // 2. 状态与逻辑
  // ---------------------------------------------------------
  const isSearchMatched = searchMode && searchQuery.trim() && messageText.toLowerCase().includes(searchQuery.toLowerCase());
  const isCurrentMatch = searchMode && currentMatchId && item.id === currentMatchId;

  const getReadStatus = () => {
    if (item.sender !== 'me') return null;
    const readBy = item.readBy || [];
    if (totalMembers && totalMembers > 2) {
      const isReadByAll = readBy.length >= (totalMembers - 1);
      return isReadByAll ? 'double' : 'single';
    } else {
      if (!item.readBy) return chatUnreadCount === 0 ? 'double' : 'single';
      return readBy.length > 0 ? 'double' : 'single';
    }
  };
  const readStatus = getReadStatus();

  // ---------------------------------------------------------
  // 3. 点击名片处理
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
  // 4. 渲染通话卡片 (优化版)
  // ---------------------------------------------------------
  const renderCallCard = () => {
    let callData: any = {};
    try {
      callData = JSON.parse(messageText);
    } catch (e) {
      return <Text style={roomStyles.messageText}>{messageText}</Text>;
    }

    // 状态判定
    const isEnded = callData.status === 'ended';
    const isCancelled = callData.status === 'cancelled';
    const isRejected = callData.status === 'rejected';
    const isInactive = isEnded || isCancelled || isRejected;

    // 类型判定
    const isVideo = callData.type === 'GROUP_VIDEO_CALL'; // 假设 Single Voice 没有 video
    const iconName = isVideo ? "videocam" : "call";

    // 标题文本
    let titleText = '';
    if (isInactive) {
        titleText = isVideo ? '视频语音结束' : '通话结束';
    } else {
        titleText = isVideo ? '邀请语音通话' : '邀请语音通话';
    }

    // 副标题 (优先用 CallScreen 传过来的 displayMessage)
    let subText = callData.displayMessage || '点击查看';
    if (!callData.displayMessage) {
        if (isEnded) subText = `通话时长 ${callData.duration || '00:00'}`;
        else if (isCancelled) subText = '已取消';
        else if (isRejected) subText = '已拒绝';
        else subText = '点击加入通话';
    }

    // 点击事件：如果是活跃的，点击加入；如果是结束的，点击可能是回拨(暂不实现)
    const handlePress = () => {
        if (!isInactive) {
            // 这里加入群聊或单聊
            if(callData.roomId) {
                navigation.navigate('GroupCallScreen', { 
                    chatId: callData.roomId, 
                    isHost: false, // 既然是点击卡片加入，肯定不是Host
                    isIncoming: false // 主动加入
                });
            }
        }
    };

    return (
      <TouchableOpacity
        style={[
            styles.callCardContainer, 
            isInactive ? styles.callCardEnded : styles.callCardActive,
            // 对方发过来的活跃通话显示为白色背景(类似微信)
            item.sender === 'other' && !isInactive && { backgroundColor: '#fff' } 
        ]}
        disabled={isInactive}
        onPress={handlePress}
      >
        <View style={styles.callCardIconContent}>
          <View style={[
              styles.iconCircle, 
              isInactive ? styles.iconCircleEnded : styles.iconCircleActive,
              item.sender === 'other' && !isInactive && { backgroundColor: '#FFA500' } // 对方发来的活跃卡片图标底色
          ]}>
            <Ionicons name={iconName} size={scaleWidth(24)} color="#FFF" />
          </View>
          <View style={styles.callCardTextContent}>
            <Text style={[
                styles.callCardTitle,
                // 对方发来的活跃通话，文字是黑色
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
  // 5. 渲染组件主体
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
          // 🔑 针对卡片移除默认气泡背景和内边距
          (isCallMessage || isContactCard) && { padding: 0, backgroundColor: 'transparent', overflow: 'visible', borderWidth: 0 },
          isSearchMatched && { backgroundColor: '#FFA500' },
          isCurrentMatch && { backgroundColor: '#FF8C00', borderWidth: 1.5, borderColor: '#FF6347' },
        ]}>

          {/* 发送者名字 */}
          {showSenderName && item.sender === 'other' && !isCallMessage && !isContactCard && (
            <Text style={roomStyles.senderName}>{item.senderName}</Text>
          )}

          {/* === 内容分发 === */}

          {/* A. 通话卡片 */}
          {isCallMessage ? (
            renderCallCard()
          ) : isContactCard && parsedCardData ? (
            // B. 名片卡片
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContactCardPress(parsedCardData)}
              activeOpacity={0.9}
            >
              <Image
                source={
                  !parsedCardData.userAvatar ||
                  parsedCardData.userAvatar.length < 10
                    ? require('../assets/images/personal.png')
                    : { uri: parsedCardData.userAvatar }
                }
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
            // C. 普通消息
            <>
              {item.type === 1 && <Text style={roomStyles.messageText}>{messageText}</Text>}

              {item.type === 2 && item.voiceUrl && (
                <View style={roomStyles.voiceMessageContainer}>
                  <TouchableOpacity onPress={() => playingVoice === item.id ? stopAudio() : playAudio(item.voiceUrl!, item.id)}>
                    <Ionicons name={playingVoice === item.id ? "pause-circle" : "play-circle"} size={scaleWidth(28)} color={item.sender === 'me' ? "#000000ff" : "#1c275b"} />
                  </TouchableOpacity>
                  <Text style={[roomStyles.voiceDuration, item.sender === 'me' && { color: '#000000ff' }]}>
                    {playingVoice === item.id ? '播放中' : '语音'}
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

          {/* D. 页脚 (时间 & 已读) */}
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

// 🎨 样式定义
const styles = StyleSheet.create({
  imageViewerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 25, zIndex: 10 },
  imageContainer: { width: width, height: height, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: width, height: height * 0.85 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  // 通话卡片样式
  callCardContainer: {
    padding: 15,
    width: width * 0.53, // 稍微加宽一点
    borderRadius: 12,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  callCardActive: { backgroundColor: '#ffc824ff' }, // 活跃状态：橙色
  callCardEnded: { backgroundColor: '#333' }, // 结束状态：深灰色 (类似系统通知)
  
  callCardIconContent: { flexDirection: 'row', alignItems: 'center' },
  
  iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconCircleActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  iconCircleEnded: { backgroundColor: 'rgba(255,255,255,0.1)' },
  
  callCardTextContent: { flex: 1 },
  callCardTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  callCardSubtext: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },

  // 名片卡片样式
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    width: scaleWidth(200), // 稍微加宽
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