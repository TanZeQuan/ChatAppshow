import React, { useState, useLayoutEffect, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet as RNStyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Alert,
    ActivityIndicator,
    Dimensions,
    RefreshControl
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import { colors, borders, typography } from "../../styles";
import { useChatStore } from '../../store/chatStore';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useUserStore } from '@/src/store/userStore';
import { readChatMessages } from '../../api/Chat';
import { Audio } from 'expo-av';
import { sendVoiceMessageToApi } from '../../api/VoiceMessage';
import * as ImagePicker from 'expo-image-picker';

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

    const currentUserId = useUserStore((state) => state.user?.id) || 'me';
    const currentUser = useUserStore((state) => state.user);

    const { chats, addMessage, clearChat, getChatById, setMessages } = useChatStore();

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
                avatar: currentUser.avatar || `https://i.pravatar.cc/150?u=${currentUserId}`,
            }]
            : []
        ),
    ];

    // 去重，避免重复
    const uniqueMembers = Array.from(new Map(membersWithSelf.map(m => [m.id, m])).values());

    const memberIds = groupChat?.memberIds || [];

    const storedMessages = chats[chatId] || [];

    const [inputText, setInputText] = useState('');
    const [showToolbar, setShowToolbar] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    // Voice message state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission not granted', 'Failed to get recording permissions');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) {
            return;
        }

        console.log('Stopping recording..');
        setIsRecording(false);
        setIsUploading(true);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped and stored at', uri);

            if (uri) {
                // Now, send the voice message
                // const result = await sendVoiceMessageToApi(uri);
                console.log('Simulating sending voice message with URI:', uri);
                // console.log('Voice message sent, result:', result);
            }
        } catch (error) {
            console.error('Failed to send voice message', error);
        } finally {
            setIsUploading(false);
            setRecording(null);
        }
    };

    const messages: DisplayMessage[] = storedMessages.map(msg => {
        const member = uniqueMembers.find(m => m.id === msg.senderId);
        return {
            ...msg,
            sender: msg.senderId === currentUserId ? 'me' : 'other',
            senderName: msg.senderId === currentUserId
                ? `${currentUser?.name || '我'} (我)`
                : (member?.name || msg.name || '未知成员'),
            avatar: msg.senderId === currentUserId
                ? currentUser?.avatar
                : (member?.avatar || msg.avatar),
        };
    });

    // Load initial messages
    const loadMessages = useCallback(async (isRefresh = false) => {
        if (!currentUserId || !chatId) return;

        const currentOffset = isRefresh ? 0 : offset;

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const result = await readChatMessages({
                chat_id: chatId,
                user_id: currentUserId,
                offset: currentOffset,
            });


            if (result.success && result.data) {
                // API returns { chat: [], group: [] }
                // Determine which array to use based on chat type
                const isGroupChat = chatId.startsWith('group_') || params.isGroup;
                const apiMessages = isGroupChat
                    ? (result.data.group || [])
                    : (result.data.chat || []);

                // Check if there are more messages to load
                if (!Array.isArray(apiMessages) || apiMessages.length === 0) {
                    setHasMoreMessages(false);
                } else {
                    // Transform API messages to app format
                    const transformedMessages = apiMessages.map((msg: any) => ({
                        id: msg.message_id || msg.id || String(Date.now() + Math.random()),
                        senderId: msg.sender_id || msg.senderId,
                        senderName: msg.sender_name || msg.senderName || '未知',
                        text: msg.message || msg.text || '',
                        createdAt: msg.created_at || msg.createdAt || new Date().toISOString(),
                        name: msg.sender_name || msg.name,
                        avatar: msg.sender_avatar || msg.avatar,
                    }));


                    if (isRefresh) {
                        // Replace all messages on refresh
                        setMessages(chatId, transformedMessages);
                        setOffset(transformedMessages.length);
                    } else {
                        // Append messages when loading more
                        const existingMessages = chats[chatId] || [];
                        const allMessages = [...existingMessages, ...transformedMessages];
                        // Remove duplicates based on message id
                        const uniqueMessages = Array.from(
                            new Map(allMessages.map(m => [m.id, m])).values()
                        );
                        setMessages(chatId, uniqueMessages);
                        setOffset(uniqueMessages.length);
                    }
                }
            } else {
                console.warn('⚠️ Failed to load messages:', result.message);
                if (!isRefresh) {
                    Alert.alert('提示', result.message || '加载消息失败');
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            if (!isRefresh) {
                Alert.alert('错误', '加载消息失败，请重试');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [currentUserId, chatId, offset, params.isGroup, setMessages, chats]);

    // Load messages on mount
    useEffect(() => {
        loadMessages(true);
    }, [chatId, currentUserId, loadMessages]);

    useLayoutEffect(() => {
        const parent = navigation.getParent();
        parent?.setOptions({ tabBarStyle: { display: "none" } });

        return () => {
            parent?.setOptions({
                tabBarStyle: getOriginalTabBarStyle(insets),
            });
        };
    }, [insets, navigation]);

    const handleSend = () => {
        if (!inputText.trim()) return;

        addMessage(chatId, inputText);
        setInputText('');
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
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
                allowsMultipleSelection: true,
            });

            if (!result.canceled && result.assets.length > 0) {
                // TODO: 实现图片发送功能
                Alert.alert('选择成功', `已选择 ${result.assets.length} 张图片\n\n图片发送功能即将推出...`);
                console.log('Selected images:', result.assets);
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

    const handleRefresh = () => {
        setOffset(0);
        setHasMoreMessages(true);
        loadMessages(true);
    };

    const renderItem = ({ item }: { item: DisplayMessage }) => (
        <View style={[
            roomStyles.messageRow,
            item.sender === 'me' ? roomStyles.messageRowRight : roomStyles.messageRowLeft,
        ]}>
            {item.sender === 'other' && (
                <View style={roomStyles.avatar}>
                    <Image
                        source={{ uri: item.avatar || `https://i.pravatar.cc/150?img=${item.senderId}` }}
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
                <Text style={roomStyles.messageText}>{item.text}</Text>
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
                        source={{ uri: currentUser?.avatar || `https://i.pravatar.cc/150?img=${currentUserId}` }}
                        style={roomStyles.avatarImage}
                    />
                </View>
            )}
        </View>
    );

    const renderFooter = () => {
        if (!isLoading) return null;
        return (
            <View style={roomStyles.loadingFooter}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={roomStyles.loadingText}>加载更多消息...</Text>
            </View>
        );
    };

    const ToolbarButton = ({ icon, label, onPress }: any) => (
        <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
            <View style={roomStyles.toolbarIconContainer}>
                <Ionicons name={icon} size={24} color="#333" />
            </View>
            <Text style={roomStyles.toolbarLabel}>{label}</Text>
        </TouchableOpacity>
    );

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
                        data={[...messages].reverse()}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={roomStyles.chatList}
                        inverted
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={renderFooter}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                                tintColor="#666"
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
});
