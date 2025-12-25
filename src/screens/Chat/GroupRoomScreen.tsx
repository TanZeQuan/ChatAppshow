import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    StyleSheet as RNStyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';
import { readChatMessages, sendChatMessage } from '../../api/Chat';
import { readUsers } from '../../api/User';
import { ensureFullImageUrl } from '../../api/service';
import { useSearchChatHistory } from '../../components/ChatHistory';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { borders, colors, typography } from "../../styles";
import { baseRoomStyles, groupRoomSpecificStyles, createRoomStyles } from "../../styles/chatRoomStyles";

const { width, height } = Dimensions.get("window");

// Responsive scaling functions
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

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

interface RouteParams {
    chatId: string;
    chatName?: string;
    isGroup?: boolean;
    members?: any[];
    searchMode?: boolean;  // ✅ Search mode parameter
}

export default function GroupRoomScreen() {
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const params = route.params as RouteParams;
    const { chatId } = params;
    console.log('🆔 GroupRoomScreen chatId:', chatId);

    const currentUserId = useUserStore((state) => state.user?.id) || 'me';
    const currentUser = useUserStore((state) => state.user);

    const { clearChat, getChatById, setMessages } = useChatStore();

    // Get real-time data from store
    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '群聊';
    const memberIds = groupChat?.memberIds || [];

    // Use selector to subscribe to messages for this chat (reactive)
    const messagesFromStore = useChatStore((state) => state.chats[chatId]);
    // Use useMemo to avoid creating new array reference on every render
    const storedMessages = useMemo(() => messagesFromStore || [], [messagesFromStore]);

    const [inputText, setInputText] = useState('');
    const [showToolbar, setShowToolbar] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshing, setRefreshing] = useState(false); // ✅ For RefreshControl
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [chatMembers, setChatMembers] = useState<string[]>([]);  // Store chat member IDs

    // ✅ Search functionality
    const {
        searchMode,
        searchQuery,
        enableSearch,
        disableSearch,
        setSearchQuery,
        filterMessages,
        matchedIndices,
        currentMatchIndex,
        currentMatchNumber,
        totalMatches,
        goToNextMatch,
        goToPrevMatch
    } = useSearchChatHistory();

    // ✅ FlatList ref for scrolling to matched messages
    const flatListRef = useRef<FlatList>(null);

    // ✅ Use ref for offset to avoid unnecessary re-renders (like ChatRoomScreen)
    const offsetRef = useRef(0);

    // Voice message state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Voice playback state
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [voiceDurations, setVoiceDurations] = useState<Record<string, number>>({});
    const [playbackPosition, setPlaybackPosition] = useState(0);

    const startRecording = async () => {
        try {
            // ✅ Clean up any existing recording first
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
                return;
            }

            // ✅ Set audio mode with complete configuration for both iOS and Android
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // console.log('🎤 [Voice] Starting recording with high-quality audio...');

            // ✅ Use custom recording options for high-quality audio
            // Note: expo-av doesn't support native Opus encoding, so we record in AAC and send as .opus to backend
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
            // console.log('✅ [Voice] Recording started (will be sent as .opus)');
        } catch (err: any) {
            console.log('❌ [Voice] Failed to start recording:', err);
            Alert.alert('录音失败', err.message || '无法启动录音，请重试');
            setRecording(null);
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        if (!recording) {
            console.log('⚠️ [Voice] No recording to stop');
            return;
        }

        setIsRecording(false);
        setIsUploading(true);

        try {
            console.log('⏹️ [Voice] Stopping recording...');

            // ✅ Get URI BEFORE stopAndUnloadAsync
            const uri = recording.getURI();

            // ✅ Then stop and unload
            await recording.stopAndUnloadAsync();

            // ✅ Reset audio mode after recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });

            if (uri) {
                console.log('🎤 [Voice] Recording stopped, URI:', uri);

                const receiver = chatMembers.filter(id => id !== currentUserId);

                // ✅ Force Opus filename and MIME type for backend
                const originalFilename = uri.split('/').pop() || 'voice.opus';
                const filename = originalFilename.replace(/\.(m4a|caf|mp4|aac)$/i, '.opus');

                // ✅ Always use audio/opus MIME type
                const mimeType = 'audio/opus';

                // console.log(`🎤 [Voice] File: ${filename} → MIME: ${mimeType}`);

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

                // console.log('🎤 [Voice] API Result:', result);

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

                    await loadMessages(false, false);
                    Alert.alert('成功', '语音消息已发送');
                } else {
                    console.error("❌ [Voice] Failed to send voice message:", result.message);
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
            // ✅ Always clean up recording object
            setIsUploading(false);
            setRecording(null);
            console.log('🧹 [Voice] Recording cleaned up');
        }
    };

    // ✅ Voice playback functions (same as ChatRoomScreen)

    // Playback status update callback
    const onPlaybackStatusUpdate = useCallback((status: any) => {
        if (status.isLoaded) {
            // Update playback position
            setPlaybackPosition(status.positionMillis || 0);

            // Get duration
            if (status.durationMillis) {
                const durationSeconds = Math.round(status.durationMillis / 1000);
                // Update duration for the current playing voice
                if (playingVoice) {
                    setVoiceDurations(prev => ({
                        ...prev,
                        [playingVoice]: durationSeconds
                    }));
                }
            }

            // Playback finished
            if (status.didJustFinish) {
                setPlayingVoice(null);
                setPlaybackPosition(0);
                console.log('🎵 [Voice] Playback finished');
            }
        }
    }, [playingVoice]);

    // Play audio
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

            // Reset playback position
            setPlaybackPosition(0);

            // Set audio mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Create and play new sound
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: voiceUrl },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setPlayingVoice(messageId);
            console.log('▶️ [Voice] Playing:', messageId);

        } catch (error: any) {
            console.error('❌ [Voice] Failed to play:', error);
            Alert.alert('播放失败', '无法播放语音消息，请重试');
            setPlayingVoice(null);
        }
    }, [sound, onPlaybackStatusUpdate]);

    // Stop audio
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

    // Helper function: Format time from milliseconds to MM:SS
    const formatTime = useCallback((millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            if (sound) {
                console.log('🧹 [Voice] Cleaning up sound on unmount');
                sound.unloadAsync();
            }
        };
    }, [sound]);

    // ✅ Transform messages - directly use name/avatar from stored messages
    const messages: DisplayMessage[] = useMemo(() => {
        const transformedMessages = storedMessages.map(msg => {
            const finalName = msg.senderId === currentUserId
                ? `${currentUser?.name || '我'} (我)`
                : (msg.name || '未知成员');

            return {
                ...msg,
                sender: msg.senderId === currentUserId ? 'me' : 'other',
                senderName: finalName,
                avatar: msg.senderId === currentUserId
                    ? currentUser?.avatar
                    : msg.avatar,
            };
        });

        // ✅ Apply search filter if in search mode
        return searchMode ? filterMessages(transformedMessages) : transformedMessages;
    }, [storedMessages, currentUserId, currentUser, searchMode, filterMessages]);

    // Load initial messages
    const loadMessages = useCallback(async (isRefresh = false, showLoading = true) => {
        if (!currentUserId || !chatId) return;

        const currentOffset = isRefresh ? 0 : offsetRef.current; // ✅ Use offsetRef

        if (showLoading) {
            if (isRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
        }

        try {
            const result = await readChatMessages({
                chat_id: chatId,
                user_id: currentUserId,
                offset: currentOffset,
            });

            if (result.success && result.data) {
                const apiMessages = result.data.chat || [];

                // Extract member IDs from group array
                if (result.data.group && Array.isArray(result.data.group)) {
                    const memberIds = result.data.group.map((member: any) => member.user_id);
                    setChatMembers(memberIds);
                }

                // Check if there are more messages to load
                if (!Array.isArray(apiMessages) || apiMessages.length === 0) {
                    setHasMoreMessages(false);
                } else {
                    // Step 1: Extract unique sender IDs
                    const senderIds = [...new Set(apiMessages.map((msg: any) => msg.sender))];

                    // Step 2: Fetch user info for each sender
                    const senderInfoMap: Record<string, { name: string, avatar: string }> = {};

                    await Promise.all(
                        senderIds.map(async (senderId) => {
                            // Skip if is current user
                            if (senderId === currentUserId) {
                                senderInfoMap[senderId] = {
                                    name: currentUser?.name || '我',
                                    avatar: currentUser?.avatar || '',
                                };
                                return;
                            }

                            try {
                                const userResult = await readUsers(senderId);

                                if (userResult.success && userResult.data?.response) {
                                    const userData = userResult.data.response;

                                    // Validate avatar URL
                                    let userAvatar = userData.image || '';
                                    const isInvalidAvatar = !userAvatar ||
                                        userAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
                                        userAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/' ||
                                        (userAvatar.startsWith('https://balkingly-hemitropic-lelah.ngrok-free.dev') &&
                                            !(userAvatar.includes('/content/') || userAvatar.includes('/coontent/') ||
                                                userAvatar.includes('/uploads/') || userAvatar.includes('/uploadds/')));

                                    senderInfoMap[senderId] = {
                                        name: userData.name || userData.username || userData.full_name || '未知',
                                        avatar: isInvalidAvatar ? '' : userAvatar,
                                    };
                                } else {
                                    senderInfoMap[senderId] = { name: '未知', avatar: '' };
                                }
                            } catch (error) {
                                console.error(`Error fetching user ${senderId}:`, error);
                                senderInfoMap[senderId] = { name: '未知', avatar: '' };
                            }
                        })
                    );

                    // Step 3: Transform API messages to app format
                    const transformedMessages = apiMessages.map((msg: any) => {
                        let messageText = '';
                        let messageType = 1; // Default to text
                        let imageUrls: string[] = [];
                        let voiceUrl: string = '';

                        try {
                            // 🔍 Check if msg.message is already an object or a string
                            let parsedMessage: any;

                            if (typeof msg.message === 'string') {
                                try {
                                    parsedMessage = JSON.parse(msg.message);
                                } catch {
                                    // If parsing fails, treat as plain text
                                    parsedMessage = { message: msg.message };
                                }
                            } else if (typeof msg.message === 'object' && msg.message !== null) {
                                parsedMessage = msg.message; // Already an object
                            } else {
                                parsedMessage = { message: String(msg.message || '') };
                            }

                            // Extract type: try msg.type first, then parsedMessage.type
                            if (msg.type) {
                                messageType = msg.type;
                            } else if (parsedMessage.type) {
                                messageType = parsedMessage.type;
                            }

                            // For type 3 (images/files), extract image URLs
                            if (messageType === 3) {
                                // Check if parsedMessage is an array (direct image URLs)
                                if (Array.isArray(parsedMessage)) {
                                    imageUrls = parsedMessage.map((url: string) => ensureFullImageUrl(url));
                                }
                                // Check if parsedMessage.message is an array
                                else if (parsedMessage.message && Array.isArray(parsedMessage.message)) {
                                    imageUrls = parsedMessage.message.map((url: string) => ensureFullImageUrl(url));
                                }
                                // Check if parsedMessage.message is a comma-separated string
                                else if (parsedMessage.message && typeof parsedMessage.message === 'string') {
                                    const urls = parsedMessage.message.split(',').map((url: string) => url.trim());
                                    imageUrls = urls.map((url: string) => ensureFullImageUrl(url));
                                }

                                messageText = `[${imageUrls.length}张图片]`; // Display text
                            }
                            // For type 2 (voice), ensure full URL
                            else if (messageType === 2) {
                                if (typeof parsedMessage === 'string') {
                                    voiceUrl = ensureFullImageUrl(parsedMessage);
                                    messageText = '[语音消息]';
                                } else if (parsedMessage.message) {
                                    voiceUrl = ensureFullImageUrl(String(parsedMessage.message));
                                    messageText = '[语音消息]';
                                }
                            }
                            // For type 1 (text), extract text content
                            else {
                                if (typeof parsedMessage === 'string') {
                                    messageText = parsedMessage;
                                } else if (parsedMessage.message) {
                                    messageText = String(parsedMessage.message);
                                } else {
                                    messageText = String(parsedMessage);
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse message:', msg.message, 'Error:', e);
                            // Fallback: convert to string safely
                            messageText = typeof msg.message === 'string'
                                ? msg.message
                                : JSON.stringify(msg.message);
                        }

                        // Attach sender info from senderInfoMap
                        const senderId = msg.sender_id || msg.sender || msg.senderId;
                        const senderInfo = senderInfoMap[senderId];

                        return {
                            id: msg.message_id || msg.id || String(Date.now() + Math.random()),
                            senderId: senderId,
                            senderName: senderInfo?.name || '未知',
                            text: messageText,
                            type: messageType,
                            imageUrls: imageUrls,
                            voiceUrl: voiceUrl,
                            createdAt: msg.created_at || msg.createdAt || new Date().toISOString(),
                            name: senderInfo?.name || '未知',
                            avatar: senderInfo?.avatar || '',
                        };
                    });

                    if (isRefresh) {
                        // ✅ Always deduplicate, even on refresh (to prevent concurrent calls from creating duplicates)
                        const existingMessages = useChatStore.getState().chats[chatId] || [];
                        const allMessages = [...transformedMessages];

                        // If we have existing messages and new messages, prefer new messages but deduplicate by ID
                        const uniqueMessages = Array.from(
                            new Map(allMessages.map(m => [m.id, m])).values()
                        );

                        setMessages(chatId, uniqueMessages);
                        offsetRef.current = uniqueMessages.length;
                    } else {
                        const existingMessages = useChatStore.getState().chats[chatId] || [];
                        const allMessages = [...existingMessages, ...transformedMessages];
                        const uniqueMessages = Array.from(
                            new Map(allMessages.map(m => [m.id, m])).values()
                        );
                        setMessages(chatId, uniqueMessages);
                        offsetRef.current = uniqueMessages.length;
                    }
                }
            } else {
                console.warn('Failed to load messages:', result.message);
                if (!isRefresh && showLoading) {
                    Alert.alert('提示', result.message || '加载消息失败');
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            if (!isRefresh && showLoading) {
                Alert.alert('错误', '加载消息失败，请重试');
            }
        } finally {
            if (showLoading) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [currentUserId, chatId, params.isGroup, setMessages]);

    // Handle pull-to-refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        offsetRef.current = 0; // Reset offset
        await loadMessages(true, false); // isRefresh=true to reload all messages
        setRefreshing(false);
    };

    // Load messages on mount
    useEffect(() => {
        offsetRef.current = 0;
        loadMessages(true);

        return () => {
            // Cleanup intervals on unmount
        };
    }, [loadMessages]);

    // ✅ Auto-enable search mode if navigated from settings
    useEffect(() => {
        if (params.searchMode === true) {
            enableSearch();
        }
    }, [params.searchMode, enableSearch]);

    // ✅ Scroll to matched message
    const scrollToMatch = useCallback((messageIndex: number) => {
        if (messageIndex >= 0 && flatListRef.current) {
            try {
                flatListRef.current.scrollToIndex({
                    index: messageIndex,
                    animated: true,
                    viewPosition: 0.5, // Center the item
                });
            } catch (error) {
                console.log('Failed to scroll to match:', error);
            }
        }
    }, []);

    // ✅ Handle next match navigation
    const handleNextMatch = useCallback(() => {
        const nextMessageIndex = goToNextMatch(messages);
        if (nextMessageIndex >= 0) {
            scrollToMatch(nextMessageIndex);
        }
    }, [goToNextMatch, scrollToMatch, messages]);

    // ✅ Handle previous match navigation
    const handlePrevMatch = useCallback(() => {
        const prevMessageIndex = goToPrevMatch(messages);
        if (prevMessageIndex >= 0) {
            scrollToMatch(prevMessageIndex);
        }
    }, [goToPrevMatch, scrollToMatch, messages]);

    // ✅ Auto-scroll to first match when search query changes (not when polling refreshes)
    const prevSearchQueryRef = useRef('');
    useEffect(() => {
        if (searchMode && searchQuery.trim() && searchQuery !== prevSearchQueryRef.current) {
            // Search query changed - scroll to first match
            if (matchedIndices.length > 0) {
                scrollToMatch(matchedIndices[0]);
            }
            prevSearchQueryRef.current = searchQuery;
        } else if (!searchMode || !searchQuery.trim()) {
            // Reset when exiting search mode
            prevSearchQueryRef.current = '';
        }
    }, [searchMode, searchQuery, matchedIndices, scrollToMatch]);

    // Use refs to store stable references for WebSocket callback
    const chatIdRef = useRef(chatId);
    const loadMessagesRef = useRef(loadMessages);

    // Update refs when values change
    useEffect(() => {
        chatIdRef.current = chatId;
        loadMessagesRef.current = loadMessages;
    }, [chatId, loadMessages]);

    // Polling and WebSocket monitoring (separate from loadMessages dependency)
    useEffect(() => {
        // Periodic WebSocket connection check (every 10 seconds)
        const connectionCheckInterval = setInterval(() => {
            const connected = WebSocketManager.isWebSocketConnected();
            if (!connected) {
                console.warn('⚠️ WebSocket disconnected!');
            }
        }, 10000);

        // Polling fallback: Check for new messages every 3 seconds (silent, no loading animation)
        const pollingInterval = setInterval(() => {
            loadMessagesRef.current(true, false); // Use ref - isRefresh=true, showLoading=false
        }, 3000);

        return () => {
            clearInterval(connectionCheckInterval);
            clearInterval(pollingInterval);
        };
    }, []); // Empty dependency - only set up once

    // Listen for WebSocket message notifications
    useEffect(() => {
        const handleWebSocketMessage = (data: any) => {
            console.log('📨 [WebSocket] Received message:', data);
            if (data.type && data.message) {
                // Refresh messages when new message arrives
                if (!data.chat_id || data.chat_id === chatIdRef.current) {
                    console.log('🔄 [WebSocket] Refreshing messages for this chat');
                    loadMessagesRef.current(true, false); // isRefresh=true, showLoading=false
                }
            }
        };

        WebSocketManager.addMessageCallback(handleWebSocketMessage);
        return () => {
            WebSocketManager.removeMessageCallback(handleWebSocketMessage);
        };
    }, []);

    useLayoutEffect(() => {
        const parent = navigation.getParent();
        parent?.setOptions({ tabBarStyle: { display: "none" } });

        return () => {
            parent?.setOptions({
                tabBarStyle: getOriginalTabBarStyle(insets),
            });
        };
    }, [insets, navigation]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const messageText = inputText.trim();

        // Clear input field immediately for better UX
        setInputText('');

        try {
            // Step 1: Save message to database via API
            const receiver = chatMembers.filter(id => id !== currentUserId)

            const result = await sendChatMessage({
                sender: currentUserId,
                isreceive: receiver,
                chat_id: chatId,
                message: messageText
            });

            console.log("Send message result:", result);

            if (result.success && result.data) {
                // Step 2: Forward message via WebSocket
                // Use isreceive from API response if available, otherwise use receiver
                const actualReceivers = (result.data.isreceive && result.data.isreceive.length > 0)
                    ? result.data.isreceive
                    : receiver;

                // Only send via WebSocket if there are receivers
                if (actualReceivers.length > 0) {
                    const forwarded = WebSocketManager.sendForwardMessage({
                        type: result.data.type,
                        message: messageText,
                        message_id: result.data.message_id,
                        sender: currentUserId,
                        receiver: actualReceivers,
                        chat_id: chatId
                    });

                    if (!forwarded) {
                        console.warn('⚠️ WebSocket not connected, message saved but not forwarded');
                    }
                } else {
                    console.warn('⚠️ No receivers found, skipping WebSocket forward');
                    console.warn('Group chat members data might be missing');
                }

                // Refresh messages from API to get correct server timestamp (silent)
                await loadMessages(false, false);
            } else {
                console.error("Failed to send message:", result.message);
                Alert.alert('发送失败', result.message || '消息发送失败，请重试');
                // Restore the message in input field
                setInputText(messageText);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            Alert.alert('发送失败', '网络错误，请重试');
            // Restore the message in input field
            setInputText(messageText);
        }
    };

    const handleClearChat = () => {
        Alert.alert('清除聊天记录', `确定要清除群 "${chatName}" 的所有聊天记录吗？`, [
            { text: '取消', style: 'cancel' },
            {
                text: '清除',
                style: 'destructive',
                onPress: () => {
                    clearChat(chatId);
                    offsetRef.current = 0;
                    setHasMoreMessages(true);
                    Alert.alert('成功', '聊天记录已清除');
                }
            }
        ]);
    };

    const handleOpenSettings = () => {
        navigation.navigate('GroupSettingScreen', {
            chatId: chatId,
            chatName: chatName,
            members: groupChat?.members || [],
            memberIds: memberIds,
        });
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('权限被拒绝', '需要相册权限才能选择图片');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
                allowsMultipleSelection: true,
            });

            if (!result.canceled && result.assets.length > 0) {
                setIsUploading(true);
                try {
                    const receiver = chatMembers.filter(id => id !== currentUserId);

                    // ✅ Get proper MIME type based on file extension (same as ChatRoomScreen)
                    const files = result.assets.map(asset => {
                        const fileName = asset.fileName || 'image.jpg';
                        const extension = fileName.split('.').pop()?.toLowerCase();

                        let mimeType = 'image/jpeg'; // default
                        if (extension === 'png') mimeType = 'image/png';
                        else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
                        else if (extension === 'gif') mimeType = 'image/gif';
                        else if (extension === 'webp') mimeType = 'image/webp';

                        // console.log(`📤 [GroupRoom File Type] ${fileName} → ${mimeType}`);

                        return {
                            uri: asset.uri,
                            name: fileName,
                            type: mimeType
                        };
                    });

                    // console.log('📤 [GroupRoom] Sending images to group...');
                    console.log('📤 [GroupRoom] Receiver:', receiver);

                    const apiResult = await sendChatMessage({
                        sender: currentUserId,
                        isreceive: receiver,
                        chat_id: chatId,
                        files: files
                    });

                    if (apiResult.success && apiResult.data) {
                        const actualReceivers = (apiResult.data.isreceive && apiResult.data.isreceive.length > 0)
                            ? apiResult.data.isreceive
                            : receiver;

                        if (actualReceivers.length > 0) {
                            WebSocketManager.sendForwardMessage({
                                type: apiResult.data.type,
                                message: apiResult.data.message, // This should be the URLs of the images
                                message_id: apiResult.data.message_id,
                                sender: currentUserId,
                                receiver: actualReceivers,
                                chat_id: chatId
                            });
                        }

                        await loadMessages(false, false); // Silent refresh after sending
                    } else {
                        console.error("Failed to send image:", apiResult.message);
                        Alert.alert('发送失败', apiResult.message || '图片发送失败，请重试');
                    }
                } catch(error: any) {
                    console.error('Failed to send image', error);
                    Alert.alert('发送失败', error.message || '网络错误，请重试');
                } finally {
                    setIsUploading(false);
                }
            }
        } catch (error) {
            console.error('选择图片错误:', error);
            Alert.alert('选择失败', '选择图片时出错');
        }
    };

    const toggleToolbar = () => {
        setShowToolbar(!showToolbar);
        if (isEmojiPickerOpen) setIsEmojiPickerOpen(false);
    };

    const toggleEmojiPicker = () => {
        setIsEmojiPickerOpen(!isEmojiPickerOpen);
        if (showToolbar) setShowToolbar(false);
    };

    const handleEmojiSelect = (emoji: any) => {
        setInputText((prev) => prev + emoji.emoji);
    };

    const handleLoadMore = () => {
        if (!isLoading && hasMoreMessages) {
            loadMessages(false);
        }
    };

    const renderItem = ({ item, index }: { item: DisplayMessage; index: number }) => {
        // 🔍 Safety check: ensure text is a string (like ChatRoomScreen)
        const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

        // ✅ Check if message matches search query (for orange highlight)
        const isSearchMatched = searchMode && searchQuery.trim() &&
                                messageText.toLowerCase().includes(searchQuery.toLowerCase());

        // ✅ Check if this is the currently focused match
        const isCurrentMatch = searchMode && matchedIndices.length > 0 &&
                               index === matchedIndices[currentMatchIndex];

        return (
            <View style={[
                roomStyles.messageRow,
                item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft,
            ]}>
                {item.sender === 'other' && (
                    <View style={roomStyles.avatar}>
                        <Image
                            source={item.avatar ? { uri: item.avatar } : require('../../assets/images/anonymous.png')}
                            style={roomStyles.avatarImage}
                        />
                    </View>
                )}
                <View style={[
                    roomStyles.bubble,
                    item.sender === 'me' ? roomStyles.bubbleRight : roomStyles.bubbleLeft,
                    isSearchMatched && { backgroundColor: '#FFA500' },  // ✅ Orange highlight for any match
                    isCurrentMatch && {
                        backgroundColor: '#FF8C00',  // ✅ Darker orange for current match
                        borderWidth: 2,
                        borderColor: '#FF6347',
                    },
                ]}>
                    {item.sender === 'other' && (
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
                        <Text style={roomStyles.messageText}>[语音上传失败]</Text>
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
                            source={currentUser?.avatar ? { uri: currentUser.avatar } : require('../../assets/images/anonymous.png')}
                            style={roomStyles.avatarImage}
                        />
                    </View>
                )}
            </View>
        );
    };

    const renderFooter = () => {
        return null;
    };

    const ToolbarButton = ({ icon, label, onPress }: any) => (
        <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
            <View style={roomStyles.toolbarIconContainer}>
                <Ionicons name={icon} size={24} color="#333" />
            </View>
            <Text style={roomStyles.toolbarLabel}>{label}</Text>
        </TouchableOpacity>
    );

    // ✅ Only show loading screen when loading AND messages are empty (like ChatRoomScreen)
    if (isLoading && messages.length === 0) {
        return (
            <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={roomStyles.safeArea}>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={roomStyles.header}>
                        <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={scaleWidth(24)} color="#333" />
                        </TouchableOpacity>
                        <Text style={roomStyles.headerTitle}>{chatName}</Text>
                        <TouchableOpacity style={roomStyles.moreButton} onPress={() => navigation.navigate('GroupMemberList', { chatId })}>
                            <Ionicons name="ellipsis-horizontal" size={scaleWidth(24)} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <View style={roomStyles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FFD966" />
                        <Text style={roomStyles.loadingText}>加载消息中...</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#FFEFB0', '#FFF9E5']} style={roomStyles.safeArea}>
            <SafeAreaView style={{ flex: 1 }}>
                {/* ✅ Dynamic Header: Search mode vs Normal mode */}
                {searchMode ? (
                    // Search mode header
                    <View style={roomStyles.header}>
                        <TextInput
                            style={roomStyles.searchInput}
                            placeholder="搜索消息..."
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        {/* ✅ Navigation controls */}
                        {totalMatches > 0 && (
                            <View style={roomStyles.searchNavigation}>
                                <TouchableOpacity
                                    style={roomStyles.navButton}
                                    onPress={handlePrevMatch}
                                    disabled={totalMatches === 0}
                                >
                                    <Ionicons name="chevron-up" size={20} color={totalMatches > 0 ? "#333" : "#999"} />
                                </TouchableOpacity>
                                <Text style={roomStyles.matchCounter}>
                                    {currentMatchNumber}/{totalMatches}
                                </Text>
                                <TouchableOpacity
                                    style={roomStyles.navButton}
                                    onPress={handleNextMatch}
                                    disabled={totalMatches === 0}
                                >
                                    <Ionicons name="chevron-down" size={20} color={totalMatches > 0 ? "#333" : "#999"} />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity style={roomStyles.iconButton} onPress={disableSearch}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    // Normal mode header
                    <View style={roomStyles.header}>
                        <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <View style={roomStyles.headerCenter}>
                            <Text style={roomStyles.headerTitle}>{chatName}</Text>
                            <Text style={roomStyles.headerSubtitle}>
                                {groupChat?.members?.length || memberIds.length || 0} 位成员
                            </Text>
                        </View>
                        <TouchableOpacity style={roomStyles.moreButton} onPress={handleOpenSettings}>
                            <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                )}

                <KeyboardAvoidingView
                    style={roomStyles.keyboardAvoidingView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={roomStyles.chatList}
                        inverted
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={renderFooter}
                        onScrollToIndexFailed={(info) => {
                            // Handle scroll failure by waiting and retrying
                            setTimeout(() => {
                                if (flatListRef.current) {
                                    flatListRef.current.scrollToIndex({
                                        index: info.index,
                                        animated: true,
                                        viewPosition: 0.5,
                                    });
                                }
                            }, 100);
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing} // ✅ Use refreshing state (like ChatRoomScreen)
                                onRefresh={handleRefresh}
                                colors={['#FFD966']} // Android
                                tintColor="#FFD966" // iOS
                            />
                        }
                    />

                    <View style={roomStyles.inputSection}>
                        <View style={roomStyles.inputContainer}>
                            <TouchableOpacity
                                style={roomStyles.iconButton}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <ActivityIndicator color="#333" />
                                ) : (
                                    <Ionicons name="mic" size={22} color={isRecording ? 'red' : '#333'} />
                                )}
                            </TouchableOpacity>
                            <TextInput
                                style={roomStyles.input}
                                placeholder="输入消息..."
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                            />
                            <TouchableOpacity style={roomStyles.iconButton} onPress={toggleEmojiPicker}>
                                <Ionicons
                                    name={isEmojiPickerOpen ? "close-circle" : "happy-outline"}
                                    size={22}
                                    color="#333"
                                />
                            </TouchableOpacity>
                            {inputText.trim() ? (
                                <TouchableOpacity style={roomStyles.iconButton} onPress={handleSend}>
                                    <Ionicons name="send" size={22} color="#333" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={roomStyles.iconButton} onPress={toggleToolbar}>
                                    <Ionicons
                                        name={showToolbar ? 'close-circle-outline' : 'add-circle-outline'}
                                        size={22}
                                        color="#333"
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {showToolbar && (
                            <View style={roomStyles.toolbar}>
                                <View style={roomStyles.toolbarRow}>
                                    <ToolbarButton icon="image-outline" label="图片" onPress={pickImage} />
                                    <ToolbarButton icon="play-circle-outline" label="视频" onPress={pickImage}  />
                                    <ToolbarButton icon="call-outline" label="群通话" />
                                    <ToolbarButton icon="videocam-outline" label="视频通话" />
                                </View>
                                <View style={roomStyles.toolbarRow}>
                                    <ToolbarButton icon="document-outline" label="文件" />
                                    <ToolbarButton icon="location-outline" label="位置" />
                                    <ToolbarButton icon="trash-outline" label="清除记录" onPress={handleClearChat} />
                                    <ToolbarButton icon="settings-outline" label="群设置" onPress={handleOpenSettings} />
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>

                <EmojiPicker
                    onEmojiSelected={handleEmojiSelect}
                    open={isEmojiPickerOpen}
                    onClose={() => setIsEmojiPickerOpen(false)}
                    categoryPosition="top"
                    enableSearchBar
                    enableRecentlyUsed
                />
            </SafeAreaView>
        </LinearGradient>
    );
}

// Use shared room styles with GroupRoom-specific styles
const roomStyles = createRoomStyles(groupRoomSpecificStyles);

