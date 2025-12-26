import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;

interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: number; // 1=text, 2=voice, 3=images
  imageUrls?: string[]; // For type 3 messages
  voiceUrl?: string; // For type 2 messages
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
  showSenderName = false,
}) => {
  // Safety check: ensure text is a string
  const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

  // Check if message matches search query (for orange highlight)
  const isSearchMatched = searchMode && searchQuery.trim() &&
                          messageText.toLowerCase().includes(searchQuery.toLowerCase());

  // Check if this is the currently focused match (by message ID)
  const isCurrentMatch = searchMode && currentMatchId && item.id === currentMatchId;

  return (
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
              <TouchableOpacity key={index} activeOpacity={0.8}>
                <Image
                  source={{ uri: url }}
                  style={roomStyles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={roomStyles.timestamp}>
          {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
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
  );
};
