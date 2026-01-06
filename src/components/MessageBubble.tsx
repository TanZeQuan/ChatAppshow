import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { createFriendRequest, searchUser } from '../api/Friend';
import { useContactStore } from '../store/contactStore';
import { useUserStore } from '../store/userStore';

const { width, height } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;

interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number; // 1=text, 2=voice, 3=images, 4=contact card
  imageUrls?: string[]; // For type 3 messages
  voiceUrl?: string; // For type 2 messages
  cardData?: { // For type 4 messages (contact card)
    userId: string;
    userName: string;
    userAvatar?: string;
  };
  createdAt: string;
  sender: 'me' | 'other';
  username?: string;
  avatar?: string;
}

interface MessageBubbleProps {
  item: DisplayMessage;
  index: number;
  // Voice playback state
  playingVoice: string | null;
  voiceDurations: Record<string, number>;
  playbackPosition: number;
  playAudio: (voiceUrl: string, messageId: string) => void;
  stopAudio: () => void;
  formatTime: (millis: number) => string;
  // Search state
  searchMode: boolean;
  searchQuery: string;
  currentMatchId: string | null;
  // Current user info
  currentUserAvatar: string;
  // Styles
  roomStyles: any;
  // Group chat specific
  showSenderName?: boolean; // For group chats
  // Read status (based on unread count from chat)
  chatUnreadCount: number; // Unread count from /chats/read API
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  item,
  index,
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
  const [imageViewerVisible, setImageViewerVisible] = React.useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = React.useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = React.useState<number>(0);

  const contacts = useContactStore((state) => state.contacts);
  const currentUser = useUserStore((state) => state.user);

  const openImageViewer = (url: string, index: number) => {
    setSelectedImageUrl(url);
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  const closeImageViewer = () => {
    setImageViewerVisible(false);
  };

  // Handle contact card press
  const handleContactCardPress = async (cardData: any) => {
    if (!cardData || !cardData.userId) return;

    // Check if it's current user
    if (currentUser && cardData.userId === currentUser.id) {
      Alert.alert('提示', '这是你自己的名片');
      return;
    }

    // Check if already a friend
    const isAlreadyFriend = contacts.some(contact => contact.id === cardData.userId);
    
    if (isAlreadyFriend) {
      Alert.alert('提示', `${cardData.userName} 已经是你的好友了`);
      return;
    }

    // Ask user if they want to add this friend
    Alert.alert(
      '添加好友',
      `是否添加 ${cardData.userName} 为好友？`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '添加',
          onPress: async () => {
            try {
              const result = await createFriendRequest(cardData.userId);

              if (result.success) {
                Alert.alert('成功', '好友请求已发送');
              } else {
                const errorMessage = result.message || '发送请求失败';
                
                if (errorMessage.includes('已经是好友') || errorMessage.includes('already friends')) {
                  Alert.alert('提示', '你们已经是好友了');
                } else if (errorMessage.includes('已发送') || errorMessage.includes('pending')) {
                  Alert.alert('提示', '已有待处理的好友请求');
                } else {
                  Alert.alert('错误', errorMessage);
                }
              }
            } catch (error) {
              console.error('Error adding friend:', error);
              Alert.alert('错误', '发送请求失败，请重试');
            }
          },
        },
      ]
    );
  };
  // Safety check: ensure text is a string
  const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

  // Check if message matches search query (for orange highlight)
  const isSearchMatched = searchMode && searchQuery.trim() &&
                          messageText.toLowerCase().includes(searchQuery.toLowerCase());

  // Check if this is the currently focused match (by message ID)
  const isCurrentMatch = searchMode && currentMatchId && item.id === currentMatchId;

  // ✅ Calculate read status based on unread count (only for messages sent by me)
  const getReadStatus = () => {
    if (item.sender !== 'me') return null; // Don't show ticks for received messages

    // If unread = 0, all messages are read → double tick
    // If unread > 0, messages are unread → single tick
    return chatUnreadCount === 0 ? 'double' : 'single';
  };

  const readStatus = getReadStatus();
  return (
    <>
      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={closeImageViewer}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {item.imageUrls?.map((url, imgIndex) => (
              <View key={imgIndex} style={styles.imageContainer}>
                <Image
                  source={{ uri: url }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <View style={[
      roomStyles.messageRow,
      item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft,
    ]}>
      {item.sender === 'other' && (
        <View style={roomStyles.avatar}>
          <Image
            source={
              !item.avatar || item.avatar.trim() === '' || item.avatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                ? require('../assets/images/personal.png')
                : { uri: item.avatar }
            }
            style={roomStyles.avatarImage}
          />
        </View>
      )}

      <View style={[
        roomStyles.bubble,
        item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
        isSearchMatched && { backgroundColor: '#FFA500' },  // Orange highlight for any match
        isCurrentMatch && {
          backgroundColor: '#FF8C00',  // Darker orange for current match
          borderWidth: 2,
          borderColor: '#FF6347',
        },
      ]}>
        {/* Group chat: Show sender name for 'other' messages */}
        {showSenderName && item.sender === 'other' && (
          <Text style={roomStyles.senderName}>{item.senderName}</Text>
        )}

        {/* Type 1: Text Message */}
        {item.type === 1 && messageText && (
          <Text style={roomStyles.messageText}>{messageText}</Text>
        )}

        {/* Type 2: Voice Message */}
        {item.type === 2 && item.voiceUrl && (
          <View style={roomStyles.voiceMessageContainer}>
            <TouchableOpacity
              onPress={() => {
                if (playingVoice === item.id) {
                  stopAudio();
                } else {
                  playAudio(item.voiceUrl!, item.id);
                }
              }}
              style={roomStyles.voicePlayButton}
            >
              <Ionicons
                name={playingVoice === item.id ? "pause-circle" : "play-circle"}
                size={scaleWidth(25)}
                color="#1c275bff"
              />
            </TouchableOpacity>
            <View style={roomStyles.voiceInfo}>
              <Text style={roomStyles.voiceMessageText}>
                {playingVoice === item.id ? '播放中...' : '语音消息'}
              </Text>
              {voiceDurations[item.id] && (
                <Text style={roomStyles.voiceDuration}>
                  {playingVoice === item.id
                    ? `${formatTime(playbackPosition)} / ${formatTime(voiceDurations[item.id] * 1000)}`
                    : formatTime(voiceDurations[item.id] * 1000)
                  }
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Type 2: Failed Voice Message (no voiceUrl) */}
        {item.type === 2 && !item.voiceUrl && (
          <Text style={roomStyles.messageText}>{messageText || '[语音上传失败]'}</Text>
        )}

        {/* Type 3: Image Message */}
        {item.type === 3 && item.imageUrls && item.imageUrls.length > 0 && (
          <View style={roomStyles.imageGridContainer}>
            {item.imageUrls.map((url, index) => (
              <TouchableOpacity key={index} activeOpacity={0.8} onPress={() => openImageViewer(url, index)}>
                <Image
                  source={{ uri: url }}
                  style={roomStyles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Type 4: Contact Card Message */}
        {item.type === 4 && item.cardData && (
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => handleContactCardPress(item.cardData)}
            activeOpacity={0.8}
          >
            <Image
              source={
                !item.cardData.userAvatar || 
                item.cardData.userAvatar.trim() === '' || 
                item.cardData.userAvatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                  ? require('../assets/images/personal.png')
                  : { uri: item.cardData.userAvatar }
              }
              style={styles.contactCardAvatar}
            />
            <View style={styles.contactCardInfo}>
              <Text style={styles.contactCardName} numberOfLines={1}>
                {item.cardData.userName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-outline" size={13} color="#888" style={{ marginRight: 4 }} />
                <Text style={styles.contactCardLabel}>个人名片</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={roomStyles.timestamp}>
            {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          {/* ✅ Show read status ticks for sent messages */}
          {readStatus && (
            <View style={{ marginLeft: 4 }}>
              {readStatus === 'double' ? (
                <Ionicons name="checkmark-done" size={20} color="#4A90E2" />
              ) : (
                <Ionicons name="checkmark" size={20} color="#999" />
              )}
            </View>
          )}
        </View>
      </View>

      {item.sender === 'me' && (
        <View style={roomStyles.avatar}>
          <Image
            source={
              !currentUserAvatar || currentUserAvatar.trim() === '' || currentUserAvatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                ? require('../assets/images/personal.png')
                : { uri: currentUserAvatar }
            }
            style={roomStyles.avatarImage}
          />
        </View>
      )}
    </View>
    </>
  );
};

const styles = {
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
  },
  closeButton: {
    position: 'absolute' as 'absolute',
    top: 40,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold' as 'bold',
  },
  imageContainer: {
    width: width,
    height: height,
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
  },
  fullScreenImage: {
    width: width,
    height: height * 0.8,
  },
  // Contact Card Styles (WeChat-like design)
  contactCard: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 8,
    width: scaleWidth(180),
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  contactCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  contactCardInfo: {
    flex: 1,
    justifyContent: 'center' as 'center',
  },
  contactCardName: {
    fontSize: 15,
    fontWeight: '500' as '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  contactCardLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '400' as '400',
  },
};
