import { Audio } from 'expo-av';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { sendChatMessage } from '../api/Chat';
import WebSocketManager from '../services/WebSocketManager';

interface UseVoiceRecorderProps {
  chatId: string;
  currentUserId: string;
  chatMembers: string[];
  onMessageSent?: () => void; // Callback after message is sent (e.g., loadMessages)
}

export const useVoiceRecorder = ({
  chatId,
  currentUserId,
  chatMembers,
  onMessageSent,
}: UseVoiceRecorderProps) => {
  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false); // 准备录音中
  const [isUploading, setIsUploading] = useState(false);

  // Voice playback state
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [voiceDurations, setVoiceDurations] = useState<Record<string, number>>({});
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // ✅ Start recording
  const startRecording = useCallback(async () => {
    // 立即设置准备状态，让UI即时响应
    setIsPreparing(true);
    
    try {
      // Clean up any existing recording first
      if (recording) {
        console.log('🧹 [Voice] Cleaning up existing recording...');
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {
          console.log('⚠️ [Voice] Failed to clean up recording:', e);
        }
        setRecording(null);
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '需要麦克风权限才能录音');
        setIsPreparing(false);
        return;
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('🎤 [Voice] Starting recording...');

      const recordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
      setIsRecording(true);
      setIsPreparing(false); // 录音开始后关闭准备状态
      console.log('✅ [Voice] Recording started');
    } catch (err: any) {
      console.log('❌ [Voice] Failed to start recording:', err);
      Alert.alert('录音失败', err.message || '无法启动录音，请重试');
      setRecording(null);
      setIsRecording(false);
      setIsPreparing(false);
    }
  }, [recording]);

  // ✅ Stop recording and send
  const stopRecording = useCallback(async () => {
    if (!recording) {
      console.log('⚠️ [Voice] No recording to stop');
      return;
    }

    setIsRecording(false);
    setIsUploading(true);

    try {
      console.log('⏹️ [Voice] Stopping recording...');

      // Get URI before stopping
      const uri = recording.getURI();

      // Stop and unload
      await recording.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (uri) {
        console.log('🎤 [Voice] Recording stopped, URI:', uri);

        const receiver = (chatMembers || []).filter(id => id !== currentUserId);

        // Force Opus filename and MIME type
        const originalFilename = uri.split('/').pop() || 'voice.opus';
        const filename = originalFilename.replace(/\.(m4a|caf|mp4|aac)$/i, '.opus');
        const mimeType = 'audio/opus';

        console.log(`🎤 [Voice] Sending: ${filename}`);

        const result = await sendChatMessage({
          sender: currentUserId,
          isreceive: receiver,
          chat_id: chatId,
          voice: {
            uri: uri,
            name: filename,
            type: mimeType,
          },
        });

        console.log('🎤 [Voice] API Result:', result);

        if (result.success && result.data) {
          console.log('✅ [Voice] Success!');

          const actualReceivers = (result.data.isreceive && result.data.isreceive.length > 0)
            ? result.data.isreceive
            : receiver;

          if (actualReceivers.length > 0) {
            WebSocketManager.sendForwardMessage({
              type: result.data.type,
              message: result.data.message,
              message_id: result.data.message_id,
              sender: currentUserId,
              receiver: actualReceivers,
              chat_id: chatId
            });
          }

          onMessageSent?.(); // Call callback
          Alert.alert('成功', '语音消息已发送');
        } else {
          console.error("❌ [Voice] Failed:", result.message);
          Alert.alert('发送失败', result.message || '语音消息发送失败，请重试');
        }
      } else {
        console.error('❌ [Voice] No URI from recording');
        Alert.alert('错误', '录音文件无效');
      }
    } catch (error: any) {
      console.error('❌ [Voice] Failed to send voice message', error);
      Alert.alert('发送失败', error.message || '网络错误，请重试');
    } finally {
      setIsUploading(false);
      setRecording(null);
      console.log('🧹 [Voice] Recording cleaned up');
    }
  }, [recording, chatMembers, currentUserId, chatId, onMessageSent]);

  // ✅ Playback status update callback
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);

      if (status.durationMillis) {
        const durationSeconds = Math.round(status.durationMillis / 1000);
        if (playingVoice) {
          setVoiceDurations(prev => ({
            ...prev,
            [playingVoice]: durationSeconds
          }));
        }
      }

      if (status.didJustFinish) {
        setPlayingVoice(null);
        setPlaybackPosition(0);
        console.log('🎵 [Voice] Playback finished');
      }
    }
  }, [playingVoice]);

  // ✅ Preload voice duration without playing
  const preloadVoiceDuration = useCallback(async (voiceUrl: string, messageId: string) => {
    // Skip if already loaded
    if (voiceDurations[messageId]) {
      return;
    }

    try {
      console.log('🔍 [Voice] Preloading duration for:', messageId);
      
      const { sound: tempSound, status } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: false }
      );

      if (status.isLoaded && status.durationMillis) {
        const durationSeconds = Math.round(status.durationMillis / 1000);
        setVoiceDurations(prev => ({
          ...prev,
          [messageId]: durationSeconds
        }));
        console.log(`✅ [Voice] Duration loaded for ${messageId}: ${durationSeconds}s`);
      }

      // Unload immediately since we don't need to play
      await tempSound.unloadAsync();
    } catch (error) {
      console.log('⚠️ [Voice] Failed to preload duration:', error);
    }
  }, [voiceDurations]);

  // ✅ Play audio
  const playAudio = useCallback(async (voiceUrl: string, messageId: string) => {
    try {
      console.log('🎵 [Voice] Playing audio:', voiceUrl);

      // Stop current playback if any
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingVoice(null);
      }

      setPlaybackPosition(0);

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and play
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setPlayingVoice(messageId);
      console.log('▶️ [Voice] Playing:', messageId);

    } catch (error: any) {
      console.log('❌ [Voice] Failed to play:', error);
      Alert.alert('播放失败', '无法播放语音消息，请重试');
      setPlayingVoice(null);
    }
  }, [sound, onPlaybackStatusUpdate]);

  // ✅ Stop audio
  const stopAudio = useCallback(async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingVoice(null);
        setPlaybackPosition(0);
        console.log('⏹️ [Voice] Stopped playback');
      } catch (error) {
        console.error('❌ [Voice] Failed to stop:', error);
      }
    }
  }, [sound]);

  // ✅ Format time from milliseconds to MM:SS
  const formatTime = useCallback((millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        console.log('🧹 [Voice] Cleaning up sound on unmount');
        sound.unloadAsync();
      }
    };
  }, [sound]);

  return {
    // State
    recording,
    isRecording,
    isPreparing,
    isUploading,
    playingVoice,
    voiceDurations,
    playbackPosition,

    // Functions
    startRecording,
    stopRecording,
    playAudio,
    stopAudio,
    formatTime,
    preloadVoiceDuration,
  };
};
