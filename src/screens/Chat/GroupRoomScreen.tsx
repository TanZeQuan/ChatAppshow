import { useUserStore } from '@/src/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';
import { readChatMessages, sendChatMessage } from '../../api/Chat';
import { ensureFullImageUrl } from '../../api/service';
import { useSearchChatHistory } from '../../components/ChatHistory';
import { ChatInputBar } from '../../components/ChatInputBar';
import { MessageBubble } from '../../components/MessageBubble';
import { SearchHeader } from '../../components/SearchHeader';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { createRoomStyles, groupRoomSpecificStyles } from "../../styles/chatRoomStyles";

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
    const [isNearBottom, setIsNearBottom] = useState(true); // ✅ Track if user is near bottom
    const [isUploadingImage, setIsUploadingImage] = useState(false); // ✅ Separate state for image upload

    // ✅ Search functionality
    const {
        searchMode,
        searchQuery,
        enableSearch,
        disableSearch,
        setSearchQuery,
        filterMessages,
        matchedMessageIds,
        currentMatchId,
        currentMatchNumber,
        totalMatches,
        goToNextMatch,
        goToPrevMatch
    } = useSearchChatHistory();

    // ✅ FlatList ref for scrolling to matched messages
    const flatListRef = useRef<FlatList>(null);

    // ✅ Use ref for offset to avoid unnecessary re-renders (like ChatRoomScreen)
    const offsetRef = useRef(0);

    // ✅ Use voice recorder hook
    const {
        isRecording,
        isUploading,
        playingVoice,
        voiceDurations,
        playbackPosition,
        startRecording,
        stopRecording,
        playAudio,
        stopAudio,
        formatTime,
    } = useVoiceRecorder({
        chatId,
        currentUserId,
        chatMembers,
        onMessageSent: () => loadMessages(false, false), // Reload messages after sending
    });


    // ✅ Transform messages - directly use name/avatar from stored messages
    const messages: DisplayMessage[] = useMemo(() => {
        return storedMessages.map(msg => {
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
    }, [storedMessages, currentUserId, currentUser]);

    // ✅ Calculate search matches separately in useEffect
    useEffect(() => {
        if (searchMode && searchQuery.trim()) {
            filterMessages(messages);
        }
    }, [messages, searchMode, searchQuery, filterMessages]);

    // Load initial messages
    const loadMessages = useCallback(async (isRefresh = false, showLoading = true) => {
        if (!currentUserId || !chatId) return;

        // ✅ Load more old messages: use current offset
        // ✅ Refresh/Polling: always use offset 0 to get latest messages
        const currentOffset = isRefresh ? 0 : offsetRef.current;

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

                // ✅ Build member info map from group array
                const memberInfoMap: Record<string, { name: string, avatar: string }> = {};

                // Extract member IDs from group array
                if (result.data.group && Array.isArray(result.data.group)) {
                    const memberIds = result.data.group.map((member: any) => member.user_id);
                    setChatMembers(memberIds);

                    // Build member info map from group array
                    result.data.group.forEach((member: any) => {
                        const memberAvatar = member.image || '';
                        const fullAvatarUrl = ensureFullImageUrl(memberAvatar);

                        memberInfoMap[member.user_id] = {
                            name: member.name || '未知',
                            avatar: fullAvatarUrl,
                        };
                    });
                }

                // Add current user to memberInfoMap
                memberInfoMap[currentUserId] = {
                    name: currentUser?.name || '我',
                    avatar: currentUser?.avatar || '',
                };

                // Check if there are more messages to load
                if (!Array.isArray(apiMessages) || apiMessages.length === 0) {
                    setHasMoreMessages(false);
                } else {
                    // Transform API messages to app format
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

                        // ✅ Attach sender info from memberInfoMap
                        const senderId = msg.sender_id || msg.sender || msg.senderId;
                        const senderInfo = memberInfoMap[senderId] || { name: '未知', avatar: '' };

                        return {
                            id: msg.message_id || msg.id || String(Date.now() + Math.random()),
                            senderId: senderId,
                            senderName: senderInfo.name,
                            text: messageText,
                            type: messageType,
                            imageUrls: imageUrls,
                            voiceUrl: voiceUrl,
                            createdAt: msg.created_at || msg.createdAt || new Date().toISOString(),
                            name: senderInfo.name,
                            avatar: senderInfo.avatar,
                        };
                    });

                    const existingMessages = useChatStore.getState().chats[chatId] || [];

                    if (!isRefresh) {
                        // ✅ Loading more OLD messages - append to END of array (visual TOP)
                        const allMessages = [...existingMessages, ...transformedMessages];
                        const uniqueMessages = Array.from(
                            new Map(allMessages.map((m: any) => [m.id, m])).values()
                        ) as any[];
                        setMessages(chatId, uniqueMessages);
                        offsetRef.current += apiMessages.length; // Increase offset
                    } else {
                        // ✅ Polling/Refresh - only keep NEW messages (newer than current newest)
                        if (existingMessages.length === 0) {
                            // First load - use all messages
                            const uniqueMessages = Array.from(
                                new Map(transformedMessages.map((m: any) => [m.id, m])).values()
                            ) as any[];
                            setMessages(chatId, uniqueMessages);
                            offsetRef.current = uniqueMessages.length;
                        } else {
                            // Filter out messages that are truly new (not already in store)
                            const existingIds = new Set(existingMessages.map(m => m.id));
                            const newMessages = transformedMessages.filter(
                                (msg: any) => !existingIds.has(msg.id)
                            );

                            if (newMessages.length > 0) {
                                // Insert new messages at START of array (visual BOTTOM)
                                const allMessages = [...newMessages, ...existingMessages];
                                const uniqueMessages = Array.from(
                                    new Map(allMessages.map((m: any) => [m.id, m])).values()
                                ) as any[];
                                setMessages(chatId, uniqueMessages);
                                // Don't change offsetRef for polling - keep history
                            }
                            // If no new messages, don't update anything - keep existing messages
                        }
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
        await loadMessages(true, false); // isRefresh=true to get new messages only
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

    // ✅ Reload data when screen gains focus
    useFocusEffect(
        useCallback(() => {
            console.log('🔄 [GroupRoom] Screen focused, reloading messages...');
            loadMessages(false, false); // Silent reload
        }, [loadMessages])
    );

    // ✅ Auto-enable search mode if navigated from settings
    useEffect(() => {
        if (params.searchMode === true) {
            enableSearch();
        }
    }, [params.searchMode, enableSearch]);

    // ✅ Scroll to matched message by ID
    const scrollToMatch = useCallback((messageId: string) => {
        if (!messageId || !flatListRef.current) return;

        // Find the index of the message with this ID
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex >= 0) {
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
    }, [messages]);

    // ✅ Handle next match navigation
    const handleNextMatch = useCallback(() => {
        const nextMessageId = goToNextMatch(messages);
        if (nextMessageId) {
            scrollToMatch(nextMessageId);
        }
    }, [goToNextMatch, scrollToMatch, messages]);

    // ✅ Handle previous match navigation
    const handlePrevMatch = useCallback(() => {
        const prevMessageId = goToPrevMatch(messages);
        if (prevMessageId) {
            scrollToMatch(prevMessageId);
        }
    }, [goToPrevMatch, scrollToMatch, messages]);

    // ✅ Auto-scroll to first match when search query changes (not when polling refreshes)
    const prevSearchQueryRef = useRef('');
    useEffect(() => {
        if (searchMode && searchQuery.trim() && searchQuery !== prevSearchQueryRef.current) {
            // Search query changed - scroll to first match
            if (matchedMessageIds.length > 0) {
                scrollToMatch(matchedMessageIds[0]);
            }
            prevSearchQueryRef.current = searchQuery;
        } else if (!searchMode || !searchQuery.trim()) {
            // Reset when exiting search mode
            prevSearchQueryRef.current = '';
        }
    }, [searchMode, searchQuery, matchedMessageIds, scrollToMatch]);

    // ✅ Handle scroll to detect if user is near bottom
    const handleScroll = useCallback((event: any) => {
        const { contentOffset } = event.nativeEvent;
        // FlatList is inverted, so contentOffset.y near 0 means at bottom (newest messages)
        const distanceFromTop = contentOffset.y;
        const nearBottom = distanceFromTop < 100; // Within 100 pixels of bottom
        setIsNearBottom(nearBottom);
    }, []);

    // ✅ Auto-scroll to bottom when new messages arrive (only if user is near bottom)
    const prevMessageCountRef = useRef(messages.length);
    useEffect(() => {
        // Only scroll if messages increased (new message arrived)
        if (messages.length > prevMessageCountRef.current && isNearBottom && messages.length > 0) {
            // Small delay to ensure FlatList has rendered the new message
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: 0,
                    animated: true,
                    viewPosition: 0
                });
            }, 100);
        }
        prevMessageCountRef.current = messages.length;
    }, [messages.length, isNearBottom]);

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
                setIsUploadingImage(true);
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
                } catch (error: any) {
                    console.error('Failed to send image', error);
                    Alert.alert('发送失败', error.message || '网络错误，请重试');
                } finally {
                    setIsUploadingImage(false);
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
            loadMessages(false, true); // isRefresh=false for loading more old messages
        }
    };

    const renderItem = ({ item, index }: { item: DisplayMessage; index: number }) => (
        <MessageBubble
            item={item}
            index={index}
            playingVoice={playingVoice}
            voiceDurations={voiceDurations}
            playbackPosition={playbackPosition}
            playAudio={playAudio}
            stopAudio={stopAudio}
            formatTime={formatTime}
            searchMode={searchMode}
            searchQuery={searchQuery}
            currentMatchId={currentMatchId}
            currentUserAvatar={currentUser?.avatar || ''}
            roomStyles={roomStyles}
            showSenderName={true} // Group chat, show sender names
        />
    );

    const renderFooter = () => {
        return null;
    };

    // Toolbar buttons configuration
    const toolbarButtons = [
        { icon: 'image-outline', label: '图片', onPress: pickImage },
        { icon: 'videocam-outline', label: '视频', onPress: pickImage },
        { icon: 'document-outline', label: '文件', onPress: () => { } },
        { icon: 'person-outline', label: '名片', onPress: () => { } },
        { icon: 'trash-outline', label: '清空', onPress: handleClearChat },
    ];

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
                {/* Dynamic Header: Search mode vs Normal mode */}
                <SearchHeader
                    searchMode={searchMode}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    disableSearch={disableSearch}
                    totalMatches={totalMatches}
                    currentMatchNumber={currentMatchNumber}
                    handlePrevMatch={handlePrevMatch}
                    handleNextMatch={handleNextMatch}
                    chatName={chatName}
                    onBack={() => navigation.goBack()}
                    onOpenSettings={handleOpenSettings}
                    roomStyles={roomStyles}
                />

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
                        maintainVisibleContentPosition={{
                            minIndexForVisible: 0,
                        }}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        onScroll={handleScroll} // ✅ Track scroll position
                        scrollEventThrottle={16} // ✅ Smooth scroll tracking
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

                    <ChatInputBar
                        inputText={inputText}
                        setInputText={setInputText}
                        isRecording={isRecording}
                        isUploading={isUploading}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        isEmojiPickerOpen={isEmojiPickerOpen}
                        toggleEmojiPicker={toggleEmojiPicker}
                        showToolbar={showToolbar}
                        toggleToolbar={toggleToolbar}
                        handleSend={handleSend}
                        toolbarButtons={toolbarButtons}
                        roomStyles={roomStyles}
                    />
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

