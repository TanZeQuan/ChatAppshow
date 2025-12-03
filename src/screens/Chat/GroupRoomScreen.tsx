import React, { useState, useLayoutEffect } from 'react';
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
    Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import { useChatStore } from '../../store/chatStore';
import { getOriginalTabBarStyle } from "../../components/tabstyle";
import { useUserStore } from '@/src/store/userStore';

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

    const { chats, addMessage, clearChat, getChatById } = useChatStore();

    // Get real-time data from store
    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '群聊';
    const members = groupChat?.members || params.members || [];
    const memberIds = groupChat?.memberIds || [];

    const storedMessages = chats[chatId] || [];

    const [inputText, setInputText] = useState('');
    const [showToolbar, setShowToolbar] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    const messages: DisplayMessage[] = storedMessages.map(msg => {
        // Find the member who sent this message
        const member = members.find(m => m.id === msg.senderId);

        return {
            ...msg,
            sender: msg.senderId === currentUserId ? 'me' : 'other',
            senderName: msg.senderId === currentUserId
                ? (currentUser?.username || '我')
                : (member?.name || msg.username || '未知成员'),
            avatar: msg.senderId === currentUserId
                ? currentUser?.avatar
                : (member?.avatar || msg.avatar),
        };
    });

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
                    Alert.alert('成功', '聊天记录已清除');
                }
            }
        ]);
    };

    const handleOpenSettings = () => {
        navigation.navigate('GroupSettingScreen', {
            chatId: chatId,
            chatName: chatName,
            members: members,
            memberIds: memberIds,
        });
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

    const ToolbarButton = ({ icon, label, onPress }: any) => (
        <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
            <View style={roomStyles.toolbarIconContainer}>
                <Ionicons name={icon} size={24} color="#333" />
            </View>
            <Text style={roomStyles.toolbarLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <LinearGradient colors={['#FFF9E6', '#FFFBF0']} style={roomStyles.safeArea}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={roomStyles.header}>
                    <TouchableOpacity style={roomStyles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={roomStyles.headerCenter}>
                        <Text style={roomStyles.headerTitle}>{chatName}</Text>
                        <Text style={roomStyles.headerSubtitle}>
                            {members.length} 位成员
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
                    />

                    <View style={roomStyles.inputSection}>
                        <View style={roomStyles.inputContainer}>
                            <TouchableOpacity style={roomStyles.iconButton}>
                                <Ionicons name="mic" size={22} color="#333" />
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
                                    <ToolbarButton icon="image-outline" label="图片" />
                                    <ToolbarButton icon="play-circle-outline" label="视频" />
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
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: { padding: 4 },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
    },
    moreButton: { padding: 4 },
    keyboardAvoidingView: { flex: 1 },
    chatList: { paddingHorizontal: 12, paddingVertical: 16 },
    messageRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-start' },
    messageRowLeft: { justifyContent: 'flex-start' },
    messageRowRight: { justifyContent: 'flex-end' },
    avatar: { width: 40, height: 40, borderRadius: 4, backgroundColor: '#E0E0E0', marginHorizontal: 8, overflow: 'hidden' },
    avatarImage: { width: 40, height: 40 },
    bubble: { maxWidth: '60%', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10 },
    bubbleLeft: { backgroundColor: '#FFFFFF' },
    bubbleRight: { backgroundColor: '#95EC69' },
    senderName: { fontWeight: 'bold', marginBottom: 2, fontSize: 12, color: '#666666' },
    messageText: { fontSize: 16, color: '#333333', lineHeight: 22 },
    timestamp: { fontSize: 10, color: '#666666', marginTop: 4, opacity: 0.7 },
    inputSection: { backgroundColor: '#F5F5F5' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    iconButton: { padding: 8 },
    input: {
        flex: 1,
        minHeight: 36,
        maxHeight: 100,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        color: '#333333',
    },
    toolbar: { backgroundColor: '#F5F5F5', paddingVertical: 25, paddingHorizontal: 15 },
    toolbarRow: { flexDirection: 'row', justifyContent: 'space-around' },
    toolbarButton: { alignItems: 'center', width: 70, margin: 10 },
    toolbarIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    toolbarLabel: { fontSize: 12, color: '#333333' },
});