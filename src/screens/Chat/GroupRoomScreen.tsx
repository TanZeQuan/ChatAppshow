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
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { borders, colors, typography } from "../../styles";

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

    const { addMessage, clearChat, getChatById, setMessages, getMemberInfo, setMemberInfo } = useChatStore();

    // Get real-time data from store
    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '群聊';

    // 生成包含自己的成员列表
    const membersWithSelf = [
        ...(groupChat?.members || params.members || []),
        ...(currentUser
            ? [{
                id: currentUserId,
                name: currentUser.name || '我',
                avatar: currentUser.avatar || '',
            }]
            : []
        ),
    ];

    // 去重，避免重复
    const uniqueMembers = Array.from(new Map(membersWithSelf.map(m => [m.id, m])).values());

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

    // ✅ Use ref for offset to avoid unnecessary re-renders (like ChatRoomScreen)
    const offsetRef = useRef(0);

    // ✅ Use chatStore member cache (reactive)
    const memberCache = useChatStore((state) => state.memberCache);
    const fetchingMemberIdsRef = useRef<Set<string>>(new Set()); // Track IDs being fetched to avoid duplicates

    // ✅ Fetch member info on-demand from /users/read API
    const fetchMemberInfo = useCallback(async (userId: string) => {
        // Skip if already cached or currently fetching
        if (getMemberInfo(userId) || fetchingMemberIdsRef.current.has(userId)) {
            return;
        }

        // Skip fetching for current user (we already have this info)
        if (userId === currentUserId) {
            setMemberInfo(userId, {
                name: currentUser?.name || '我',
                avatar: currentUser?.avatar || '',
            });
            return;
        }

        // Mark as fetching
        fetchingMemberIdsRef.current.add(userId);

        try {
            const result = await readUsers(userId);

            if (result.success && result.data?.response) {
                const userData = result.data.response;

                // ✅ Validate backend avatar
                let backendAvatar = userData.image || '';
                const isInvalidAvatar = !backendAvatar ||
                    backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev' ||
                    backendAvatar === 'https://balkingly-hemitropic-lelah.ngrok-free.dev/' ||
                    (backendAvatar.startsWith('https://balkingly-hemitropic-lelah.ngrok-free.dev') &&
                        !(backendAvatar.includes('/content/') || backendAvatar.includes('/coontent/') ||
                            backendAvatar.includes('/uploads/') || backendAvatar.includes('/uploadds/')));

                const finalAvatar = isInvalidAvatar ? '' : backendAvatar;

                // ✅ Cache using chatStore
                setMemberInfo(userId, {
                    name: userData.name || userData.username || userData.full_name || '未知',
                    avatar: finalAvatar,
                });

                console.log(`✅ [MemberCache] Fetched info for ${userId}:`, {
                    name: userData.name,
                    avatar: finalAvatar
                });
            }
        } catch (error) {
            console.error(`❌ [MemberCache] Failed to fetch info for ${userId}:`, error);
        } finally {
            // Remove from fetching set
            fetchingMemberIdsRef.current.delete(userId);
        }
    }, [currentUserId, currentUser, getMemberInfo, setMemberInfo]);

    // Voice message state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

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

    // ✅ Transform messages with cached member info
    const messages: DisplayMessage[] = useMemo(() => {
        return storedMessages.map(msg => {
            const member = uniqueMembers.find(m => m.id === msg.senderId);

            // ✅ Fetch member info on-demand if not in cache
            if (msg.senderId !== currentUserId && !memberCache[msg.senderId]) {
                fetchMemberInfo(msg.senderId);
            }

            // ✅ Use cached member info from chatStore
            const cachedInfo = memberCache[msg.senderId];

            return {
                ...msg,
                sender: msg.senderId === currentUserId ? 'me' : 'other',
                senderName: msg.senderId === currentUserId
                    ? `${currentUser?.name || '我'} (我)`
                    : (cachedInfo?.name || member?.name || msg.name || '未知成员'),
                avatar: msg.senderId === currentUserId
                    ? currentUser?.avatar
                    : (cachedInfo?.avatar || member?.avatar || msg.avatar),
            };
        });
    }, [storedMessages, uniqueMembers, currentUserId, currentUser, memberCache, fetchMemberInfo]);

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
            console.log('🔄 [loadMessages] Fetching messages...', {
                chatId,
                userId: currentUserId,
                offset: currentOffset,
                isRefresh,
            });

            const result = await readChatMessages({
                chat_id: chatId,
                user_id: currentUserId,
                offset: currentOffset,
            });

            console.log('📥 [loadMessages] API Result:', {
                success: result.success,
                hasData: !!result.data,
                message: result.message,
            });

            if (result.success && result.data) {
                console.log('📨 [loadMessages] API Response:', {
                    hasChatArray: !!result.data.chat,
                    chatLength: result.data.chat?.length || 0,
                    hasGroupArray: !!result.data.group,
                    groupLength: result.data.group?.length || 0,
                });

                // ✅ Messages are always in result.data.chat (for both private and group chats)
                const apiMessages = result.data.chat || [];

                // ✅ Group members info (only for group chats)
                if (result.data.group && Array.isArray(result.data.group)) {
                    const memberIds = result.data.group.map((member: any) => member.user_id);
                    setChatMembers(memberIds);
                    console.log('👥 [loadMessages] Found group members:', memberIds);
                }

                // Check if there are more messages to load
                if (!Array.isArray(apiMessages) || apiMessages.length === 0) {
                    console.log('📭 [loadMessages] No more messages');
                    setHasMoreMessages(false);
                } else {
                    console.log(`📬 [loadMessages] Loaded ${apiMessages.length} messages`);

                    // ✅ Transform API messages to app format (same logic as ChatRoomScreen)
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

                        return {
                            id: msg.message_id || msg.id || String(Date.now() + Math.random()),
                            senderId: msg.sender_id || msg.sender || msg.senderId,
                            senderName: msg.sender_name || msg.senderName || '未知',
                            text: messageText, // ✅ Parsed text
                            type: messageType, // ✅ Message type (1=text, 2=voice, 3=images)
                            imageUrls: imageUrls, // ✅ Image URLs for type 3
                            voiceUrl: voiceUrl, // ✅ Voice URL for type 2
                            createdAt: msg.created_at || msg.createdAt || new Date().toISOString(),
                            name: msg.sender_name || msg.name,
                            avatar: msg.sender_avatar || msg.avatar,
                        };
                    });

                    console.log(`📝 [loadMessages] Transformed messages sample:`, transformedMessages.slice(0, 2).map(m => ({
                        id: m.id,
                        type: m.type,
                        text: m.text.substring(0, 50),
                        hasImageUrls: !!m.imageUrls && m.imageUrls.length > 0,
                        hasVoiceUrl: !!m.voiceUrl,
                    })));


                    if (isRefresh) {
                        // Replace all messages on refresh
                        setMessages(chatId, transformedMessages);
                        offsetRef.current = transformedMessages.length; // ✅ Use offsetRef
                    } else {
                        // Append messages when loading more
                        // Get messages from store at call time to avoid stale dependency
                        const existingMessages = useChatStore.getState().chats[chatId] || [];
                        const allMessages = [...existingMessages, ...transformedMessages];
                        // Remove duplicates based on message id
                        const uniqueMessages = Array.from(
                            new Map(allMessages.map(m => [m.id, m])).values()
                        );
                        setMessages(chatId, uniqueMessages);
                        offsetRef.current = uniqueMessages.length; // ✅ Use offsetRef
                    }
                }
            } else {
                console.warn('⚠️ Failed to load messages:', result.message);
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
    }, [currentUserId, chatId, params.isGroup, setMessages]); // ✅ Remove offset from dependencies

    // ✅ Handle pull-to-refresh (like ChatRoomScreen)
    const handleRefresh = async () => {
        setRefreshing(true);
        await loadMessages(false, false); // No loading spinner, just refresh control
        setRefreshing(false);
    };

    // Load messages on mount
    useEffect(() => {
        offsetRef.current = 0; // ✅ Reset offset when entering new chat (like ChatRoomScreen)
        loadMessages(true);

        // ✅ WebSocket connection check (every 10 seconds) - like ChatRoomScreen
        const connectionCheckInterval = setInterval(() => {
            const connected = WebSocketManager.isWebSocketConnected();
            if (!connected) {
                console.warn('⚠️ WebSocket disconnected!');
            }
        }, 10000);

        // Polling fallback: Check for new messages every 3 seconds (silent, no loading animation)
        const pollingInterval = setInterval(() => {
            loadMessages(false, false); // isRefresh=false, showLoading=false
        }, 3000);

        return () => {
            clearInterval(connectionCheckInterval); // ✅ Clear connection check interval
            clearInterval(pollingInterval);
        };
    }, [loadMessages]);

    // Use refs to store stable references for WebSocket callback
    const chatIdRef = useRef(chatId);
    const loadMessagesRef = useRef(loadMessages);

    // Update refs when values change
    useEffect(() => {
        chatIdRef.current = chatId;
        loadMessagesRef.current = loadMessages;
    }, [chatId, loadMessages]);

    // Listen for WebSocket message notifications (registered only once)
    useEffect(() => {
        const handleWebSocketMessage = (data: any) => {
            if (data.type && data.message) {
                if (!data.chat_id) {
                    loadMessagesRef.current(false, false); // Silent refresh
                } else if (data.chat_id === chatIdRef.current) {
                    loadMessagesRef.current(false, false); // Silent refresh
                } else {
                }
            }
        };

        WebSocketManager.addMessageCallback(handleWebSocketMessage);
        return () => {
            WebSocketManager.removeMessageCallback(handleWebSocketMessage);
        };
    }, []); // Empty dependency array - register only once

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
                    setOffset(0);
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
            members: memberIds,
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

                        console.log(`📤 [GroupRoom File Type] ${fileName} → ${mimeType}`);

                        return {
                            uri: asset.uri,
                            name: fileName,
                            type: mimeType
                        };
                    });

                    console.log('📤 [GroupRoom] Sending images to group...');
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

    const handleRefreshOld = () => { // ✅ This is now unused, remove if needed
        offsetRef.current = 0;
        setHasMoreMessages(true);
        loadMessages(true);
    };

    const renderItem = ({ item }: { item: DisplayMessage }) => {
        // 🔍 Safety check: ensure text is a string (like ChatRoomScreen)
        const messageText = typeof item.text === 'string' ? item.text : String(item.text || '');

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
                ]}>
                    {item.sender === 'other' && (
                        <Text style={roomStyles.senderName}>{item.senderName}</Text>
                    )}

                    {/* Type 1: Text Message */}
                    {item.type === 1 && messageText && (
                        <Text style={roomStyles.messageText}>{messageText}</Text>
                    )}

                    {/* Type 2: Voice Message */}
                    {item.type === 2 && (
                        <View style={roomStyles.voiceMessageContainer}>
                            <Ionicons name="play-circle" size={24} color="#333" />
                            <Text style={roomStyles.voiceMessageText}>语音消息</Text>
                        </View>
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
        if (!isLoading) return null;
        // return (
        //     <View style={roomStyles.loadingFooter}>
        //         <ActivityIndicator size="small" color="#666" />
        //         <Text style={roomStyles.loadingText}>加载更多消息...</Text>
        //     </View>
        // );
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
                <View style={roomStyles.header}>
                    <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={roomStyles.headerCenter}>
                        <Text style={roomStyles.headerTitle}>{chatName}</Text>
                        <Text style={roomStyles.headerSubtitle}>
                            {uniqueMembers.length} 位成员
                        </Text>
                    </View>
                    <TouchableOpacity style={roomStyles.moreButton} onPress={handleOpenSettings}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={roomStyles.keyboardAvoidingView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <FlatList
                        data={messages}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={roomStyles.chatList}
                        inverted
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={renderFooter}
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

const roomStyles = RNStyleSheet.create({
    safeArea: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.yellowBright,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.background.grayLight,
    },
    backButton: { padding: 4 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight500,
        color: colors.text.blackMedium,
    },
    headerSubtitle: {
        fontSize: typography.fontSize12,
        color: colors.text.grayDark,
        marginTop: 2,
    },
    moreButton: { padding: 4 },

    // ✅ Loading styles (like ChatRoomScreen)
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: scaleHeight(12),
        fontSize: scaleFont(14),
        color: colors.text.grayDark,
    },

    keyboardAvoidingView: { flex: 1 },
    chatList: { paddingHorizontal: 12, paddingVertical: 16 },

    messageRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-start' },
    messageRowLeft: { justifyContent: 'flex-start' },
    messageRowRight: { justifyContent: 'flex-end' },

    avatar: {
        width: 40,
        height: 40,
        borderRadius: borders.radius4,
        backgroundColor: colors.background.grayLight,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    avatarImage: { width: 40, height: 40 },

    bubble: { maxWidth: '60%', borderRadius: borders.radius4, paddingHorizontal: 12, paddingVertical: 10 },
    bubbleLeft: { backgroundColor: colors.background.white },
    bubbleRight: { backgroundColor: colors.functional.green },

    senderName: {
        fontWeight: typography.fontWeight600,
        marginBottom: 2,
        fontSize: typography.fontSize12,
        color: colors.text.grayDark,
    },
    messageText: {
        fontSize: typography.fontSize16,
        color: colors.text.blackMedium,
        lineHeight: typography.lineHeight22,
    },
    timestamp: {
        fontSize: typography.fontSize11,
        color: colors.text.grayDark,
        marginTop: 4,
        opacity: 0.7,
    },

    inputSection: { backgroundColor: colors.background.grayLight },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.yellowPale,
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderTopWidth: borders.width1,
        borderTopColor: colors.background.grayLight,
    },
    iconButton: { padding: 8 },
    input: {
        flex: 1,
        minHeight: 36,
        maxHeight: 100,
        backgroundColor: colors.background.white,
        borderRadius: borders.radius10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: typography.fontSize16,
        color: colors.text.blackMedium,
    },

    toolbar: {
        backgroundColor: colors.background.grayLight,
        paddingVertical: scaleHeight(20),
        paddingHorizontal: scaleWidth(10)
    },
    toolbarRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: scaleHeight(10),
    },
    toolbarButton: {
        alignItems: 'center',
        width: scaleWidth(70),
    },
    toolbarIconContainer: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: borders.radius8,
        backgroundColor: colors.background.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scaleHeight(6),
    },
    toolbarLabel: {
        fontSize: scaleFont(12),
        color: colors.text.blackMedium,
        textAlign: 'center',
    },

    loadingFooter: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: typography.fontSize12,
        color: colors.text.grayDark,
    },

    // ✅ Voice message styles (like ChatRoomScreen)
    voiceMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scaleWidth(8),
        paddingVertical: scaleHeight(4),
    },
    voiceMessageText: {
        fontSize: scaleFont(14),
        color: colors.text.blackMedium,
    },

    // ✅ Image message styles (like ChatRoomScreen)
    imageGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scaleWidth(4),
        marginBottom: scaleHeight(4),
    },
    messageImage: {
        width: scaleWidth(120),
        height: scaleWidth(120),
        borderRadius: borders.radius8,
        backgroundColor: colors.background.grayLight,
    },
});
