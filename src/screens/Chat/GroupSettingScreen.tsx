import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readChatMessages, updateGroup, updateGroupImage, updateGroupName } from '../../api/Chat';
import { blockUser, deleteFriend, readFriends } from '../../api/Friend';
import { ensureFullImageUrl } from '../../api/service';
import WebSocketManager from '../../services/WebSocketManager';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from "../../styles";

const { width } = Dimensions.get('window');
const scaleWidth = (size: number) => (width / 375) * size;

interface RouteParams {
    chatId: string;
    chatName: string;
    members?: any[];
    memberIds?: string[];
}

interface Member {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
    isAdmin?: boolean; // true if isadmin === 2
}

export default function GroupSettingScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const params = route.params as RouteParams;
    const { chatId } = params;

    const { removeChat, getChatById, addChat, clearChat } = useChatStore();
    const currentUserId = useUserStore((state) => state.user?.id) || 'me';
    const currentUser = useUserStore((state) => state.user);

    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '';

    // Memoized members list
    const allMembers: Member[] = useMemo(() => {
        const storeMembers = groupChat?.members || [];
        const storeMemberIds = groupChat?.memberIds || [];

        if (currentUser && !storeMemberIds.includes(currentUserId)) {
            return [
                ...storeMembers,
                {
                    id: currentUserId,
                    name: currentUser.name || '我',
                    avatar: currentUser.avatar || '',
                }
            ];
        }
        return storeMembers;
    }, [groupChat?.members, groupChat?.memberIds, currentUser, currentUserId]);

    const allMemberIds = useMemo(() => allMembers.map(member => member.id), [allMembers]);

    // State
    const [muteNotifications, setMuteNotifications] = useState(groupChat?.rawData?.push_notification || false);
    const [pinToTop, setPinToTop] = useState(groupChat?.rawData?.top_notification || false);
    const [showOnTop, setShowOnTop] = useState(groupChat?.rawData?.show_nicknames || false);
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState(chatName);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
    const [friendsList, setFriendsList] = useState<any[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [groupImage, setGroupImage] = useState(''); // ✅ Group avatar from API

    // ✅ Use ref to keep the latest function reference for WebSocket callback
    const chatIdRef = useRef(chatId);
    const loadFriendsListRef = useRef<((showLoading?: boolean) => Promise<void>) | undefined>(undefined);

    // Update refs when values change
    useEffect(() => {
        chatIdRef.current = chatId;
    }, [chatId]);

    // Sync state with store
    useEffect(() => {
        setNewGroupName(chatName);
    }, [chatName]);

    useEffect(() => {
        if (groupChat) {
            setMuteNotifications(groupChat.rawData?.push_notification || false);
            setPinToTop(groupChat.rawData?.top_notification || false);
            setShowOnTop(groupChat.rawData?.show_nicknames || false);
        }
    }, [groupChat]);

    useEffect(() => {
        loadFriendsList();
        loadGroupMembers();  // ✅ Load group members on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load friends list with optional loading state (for silent refresh)
    const loadFriendsList = useCallback(async (showLoading = true) => {
        if (!currentUserId) return;

        if (showLoading) {
            setLoadingFriends(true);
        }

        try {
            // Get ACCEPTED friends
            const result = await readFriends(2);
            if (result.success && result.data) {
                const allFriends = [
                    ...(result.data.request || []),
                    ...(result.data.approve || [])
                ];
                setFriendsList(allFriends);
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            if (showLoading) {
                setLoadingFriends(false);
            }
        }
    }, [currentUserId]);

    // ✅ Load group members from API - now includes name, image, and isadmin directly!
    const loadGroupMembers = useCallback(async () => {
        if (!currentUserId || !chatId) return;

        try {
            console.log('📥 [GroupSetting] Loading group members...');

            // Get group members with all info from readChatMessages API
            const result = await readChatMessages({
                chat_id: chatId,
                user_id: currentUserId,
                offset: 0,
            });

            if (result.success && result.data?.group && Array.isArray(result.data.group)) {
                const groupMembers = result.data.group; // Array with user_id, name, image, isadmin
                console.log('📥 [GroupSetting] Got group members:', groupMembers);

                // ✅ Build members array directly from API response - no additional API calls needed!
                const membersInfo: Member[] = groupMembers.map((member: any) => {
                    const isAdmin = member.isadmin === 2; // isadmin: 2 means owner/admin, 1 means normal member

                    // ✅ Use ensureFullImageUrl to process avatar URL
                    const memberAvatar = member.image || '';
                    const fullAvatarUrl = ensureFullImageUrl(memberAvatar);

                    return {
                        id: member.user_id,
                        name: member.name || '未知',
                        avatar: fullAvatarUrl,
                        isAdmin: isAdmin,
                    };
                });

                // ✅ Extract owner ID (isadmin === 2)
                const ownerMember = groupMembers.find((m: any) => m.isadmin === 2);
                const ownerId = ownerMember?.user_id || '';

                // ✅ Extract all admins (for now, only owner is admin, but could have multiple in future)
                const adminIds = groupMembers
                    .filter((m: any) => m.isadmin === 2)
                    .map((m: any) => m.user_id);

                console.log('✅ [GroupSetting] Processed member info:', {
                    total: membersInfo.length,
                    admins: membersInfo.filter(m => m.isAdmin).length,
                    members: membersInfo.filter(m => !m.isAdmin).length,
                    ownerId: ownerId,
                    adminIds: adminIds,
                });

                // ✅ Get group info (name and image)
                const groupInfo = result.data.info || {};
                const groupName = groupInfo.name || chatName;
                const groupImageUrl = groupInfo.image || '';

                // ✅ Use ensureFullImageUrl to process group image URL
                const fullGroupImageUrl = ensureFullImageUrl(groupImageUrl);

                console.log('📷 [GroupSetting] Group image:', {
                    raw: groupImageUrl,
                    full: fullGroupImageUrl,
                });

                // ✅ Save group image to state
                setGroupImage(fullGroupImageUrl);

                // ✅ Update chatStore with complete member info and group info
                const currentChat = getChatById(chatId);
                if (currentChat) {
                    addChat({
                        ...currentChat,
                        name: groupName,
                        avatar: fullGroupImageUrl,
                        members: membersInfo,
                        memberIds: groupMembers.map((m: any) => m.user_id),
                        ownerId: ownerId,  // ✅ Save owner ID
                        admins: adminIds,  // ✅ Save admin IDs
                    });
                    console.log('✅ [GroupSetting] Saved members and group info to chatStore with ownerId:', ownerId);
                }
            } else {
                console.warn('⚠️ [GroupSetting] No group members in API response');
            }
        } catch (error) {
            console.error('❌ [GroupSetting] Failed to load group members:', error);
        }
    }, [currentUserId, chatId, chatName, getChatById, addChat]);

    // ✅ Reload data when screen gains focus
    useFocusEffect(
        useCallback(() => {
            console.log('🔄 [GroupSetting] Screen focused, reloading data...');
            loadGroupMembers();
            loadFriendsList(false); // Silent reload
        }, [loadGroupMembers, loadFriendsList])
    );

    // Update ref when function changes
    useEffect(() => {
        loadFriendsListRef.current = loadFriendsList;
    }, [loadFriendsList]);

    // ✅ Listen for WebSocket messages (silent refresh - same as ChatRoomScreen)
    useEffect(() => {
        const handleWebSocketMessage = (data: any) => {
            if (data.type && data.message) {
                // If chat_id matches or not provided, do silent refresh
                if (!data.chat_id || data.chat_id === chatIdRef.current) {
                    // Silent refresh - no loading animation (showLoading = false)
                    loadFriendsListRef.current?.(false);
                }
            }
        };

        WebSocketManager.addMessageCallback(handleWebSocketMessage);

        return () => {
            WebSocketManager.removeMessageCallback(handleWebSocketMessage);
        };
    }, []);

    // Refresh handler
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            loadFriendsList(),
            loadGroupMembers(),  // ✅ Also refresh group members
        ]);
        setRefreshing(false);
    }, [loadFriendsList, loadGroupMembers]);

    // Update chat helper
    const updateChatData = useCallback((updates: any) => {
        if (groupChat) {
            const updatedChat = {
                ...groupChat,
                ...updates,
                rawData: {
                    ...groupChat.rawData,
                    ...updates.rawData,
                }
            };
            addChat(updatedChat);
        }
    }, [groupChat, addChat]);

    // Toggle handlers
    const handleToggleMuteNotifications = useCallback((value: boolean) => {
        setMuteNotifications(value);
        updateChatData({ rawData: { push_notification: value } });
    }, [updateChatData]);

    const handleTogglePinToTop = useCallback((value: boolean) => {
        setPinToTop(value);
        updateChatData({ rawData: { top_notification: value } });
    }, [updateChatData]);

    const handleToggleShowNicknames = useCallback((value: boolean) => {
        setShowOnTop(value);
        updateChatData({ rawData: { show_nicknames: value } });
    }, [updateChatData]);

    // Navigation handlers
    const handleSearchHistory = useCallback(() => {
        // ✅ Replace instead of navigate to avoid navigation stack buildup
        navigation.replace('GroupRoom', {
            chatId,
            chatName,
            isGroup: true,
            members: groupChat?.members || [],
            memberIds: allMemberIds,
            searchMode: true,  // ✅ Enable search mode
        });
    }, [navigation, chatId, chatName, groupChat?.members, allMemberIds]);

    const handleClearHistory = useCallback(() => {
        Alert.alert(
            '清空聊天记录',
            `确定要清空群 "${chatName}" 的所有聊天记录吗？此操作不可恢复。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '清空',
                    style: 'destructive',
                    onPress: () => {
                        clearChat(chatId);
                        Alert.alert('成功', '聊天记录已清空');
                    }
                }
            ]
        );
    }, [chatId, chatName, clearChat]);

    // Permission check
    const checkKickPermission = useCallback((targetMemberId: string) => {
        const isOwner = groupChat?.ownerId === currentUserId;
        const isAdmin = groupChat?.admins?.includes(currentUserId);
        const isTargetOwner = groupChat?.ownerId === targetMemberId;
        const isTargetAdmin = groupChat?.admins?.includes(targetMemberId);
        if (isOwner) {
            if (targetMemberId === currentUserId) {
                return { hasPermission: false, message: '群主不能踢出自己' };
            }
            return { hasPermission: true, message: '' };
        }

        if (isAdmin) {
            if (isTargetOwner || isTargetAdmin) {
                return { hasPermission: false, message: '管理员不能踢出群主或其他管理员' };
            }
            if (targetMemberId === currentUserId) {
                return { hasPermission: false, message: '不能踢出自己' };
            }
            return { hasPermission: true, message: '' };
        }

        return { hasPermission: false, message: '只有群主或管理员可以踢人' };
    }, [groupChat, currentUserId]);

    // Kick member
    const handleKickMember = useCallback(async (memberId: string, memberName: string) => {
        const permission = checkKickPermission(memberId);
        if (!permission.hasPermission) {
            Alert.alert('权限不足', permission.message);
            return;
        }

        setKickingMemberId(memberId);

        Alert.alert(
            '踢出成员',
            `确定要将 ${memberName} 踢出群聊吗？`,
            [
                { text: '取消', style: 'cancel', onPress: () => setKickingMemberId(null) },
                {
                    text: '踢出',
                    style: 'destructive',
                    onPress: async () => {
                        try {

                            // Call backend API
                            const result = await updateGroup({
                                chat_id: chatId,
                                user_id: currentUserId,
                                action: 'remove',
                                target_id: memberId,
                            });

                            // console.log('✅ [KickMember] API response:', result);

                            if (result.success) {
                                // ✅ Reload group members from API to get updated list
                                await loadGroupMembers();
                                Alert.alert('成功', `已成功将 ${memberName} 踢出群聊`);
                            } else {
                                console.error('❌ [KickMember] Failed:', result.message);
                                Alert.alert('错误', result.message || '踢出成员失败，请重试');
                            }
                        } catch (error) {
                            console.error('❌ [KickMember] Exception:', error);
                            Alert.alert('错误', '踢出成员失败，请重试');
                        } finally {
                            setKickingMemberId(null);
                        }
                    }
                }
            ]
        );
    }, [checkKickPermission, chatId, currentUserId, loadGroupMembers]);

    // Delete friend
    const handleDeleteFriend = useCallback(async (memberId: string, memberName: string) => {
        Alert.alert(
            '删除好友',
            `确定要删除好友 ${memberName} 吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // ✅ Find friend by checking approve_id or request_id
                            const friendToDelete = friendsList.find(f =>
                                f.approve_id === memberId || f.request_id === memberId
                            );

                            if (!friendToDelete || !friendToDelete.list_id) {
                                Alert.alert('错误', '无法找到该好友的关系ID，请刷新后重试');
                                setIsLoading(false);
                                return;
                            }

                            const result = await deleteFriend(friendToDelete.list_id);

                            if (result.success) {
                                setFriendsList(prev => prev.filter(f => f.list_id !== friendToDelete.list_id));
                                Alert.alert('成功', '已删除好友');
                            } else {
                                Alert.alert('错误', result.message || '删除好友失败');
                            }
                        } catch (error) {
                            console.error('Delete friend error:', error);
                            Alert.alert('错误', '删除好友失败，请重试');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    }, [friendsList]);

    // Block user
    const handleBlockUser = useCallback(async (memberId: string, memberName: string) => {
        Alert.alert(
            '拉黑用户',
            `确定要拉黑 ${memberName} 吗？拉黑后将无法接收对方消息。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '拉黑',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // ✅ Find friend by checking approve_id or request_id
                            const friendToBlock = friendsList.find(f =>
                                f.approve_id === memberId || f.request_id === memberId
                            );

                            if (!friendToBlock || !friendToBlock.list_id) {
                                Alert.alert('错误', '无法找到该好友的关系ID，请刷新后重试');
                                setIsLoading(false);
                                return;
                            }

                            const result = await blockUser(friendToBlock.list_id);

                            if (result.success) {
                                Alert.alert('成功', '已拉黑该用户');
                                // Refresh the friends list to reflect the change
                                await loadFriendsList();
                            } else {
                                Alert.alert('错误', result.message || '拉黑用户失败');
                            }
                        } catch (error) {
                            console.error('Block user error:', error);
                            Alert.alert('错误', '拉黑用户失败，请重试');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    }, [friendsList, loadFriendsList]);

    // View member profile
    const handleViewMemberProfile = useCallback((member: Member) => {
        if (member.id === currentUserId) return;

        const permission = checkKickPermission(member.id);
        const canKick = permission.hasPermission;

        // ✅ Correctly check if member is a friend
        const isFriend = friendsList.some(f => {
            // If I sent the request, friend is approve_id
            if (f.approve_id === member.id) return true;
            // If friend sent the request, friend is request_id
            if (f.request_id === member.id) return true;
            return false;
        });

        const options: any[] = [
            { text: '取消', style: 'cancel' },
            {
                text: '查看资料',
                onPress: () => navigation.navigate('UserProfile', {
                    userId: member.id,
                    userName: member.name,
                }),
            },
            {
                text: '发送消息',
                onPress: () => navigation.navigate('ChatRoom', {
                    chatId: member.id,
                    chatName: member.name,
                    avatar: member.avatar,
                }),
            },
        ];

        if (isFriend) {
            options.push({
                text: '删除好友',
                style: 'destructive',
                onPress: () => handleDeleteFriend(member.id, member.name),
            });
        }

        options.push({
            text: '拉黑',
            style: 'destructive',
            onPress: () => handleBlockUser(member.id, member.name),
        });

        if (canKick) {
            options.push({
                text: '踢出群聊',
                style: 'destructive',
                onPress: () => handleKickMember(member.id, member.name),
            });
        }

        Alert.alert(member.name, isFriend ? '好友 • 群成员' : '群成员', options);
    }, [currentUserId, checkKickPermission, friendsList, navigation, handleDeleteFriend, handleBlockUser, handleKickMember]);

    // Add members
    const handleAddMembers = useCallback(() => {
        // ✅ Check if current user is owner
        const isOwner = groupChat?.ownerId === currentUserId;
        console.log('🔐 [AddMembers] Permission check:', {
            currentUserId,
            ownerId: groupChat?.ownerId,
            isOwner,
        });

        if (!isOwner) {
            Alert.alert('权限不足', '只有群主才能添加成员');
            return;
        }

        navigation.navigate('AddGroupMembers', {
            chatId,
            chatName,
            currentMembers: allMemberIds,
        });
    }, [navigation, chatId, chatName, allMemberIds, groupChat, currentUserId]);

    // Update group name
    const handleUpdateGroupName = useCallback(async () => {
        if (!newGroupName.trim()) {
            Alert.alert('错误', '群聊名称不能为空');
            return;
        }

        // ✅ Check if current user is owner
        const isOwner = groupChat?.ownerId === currentUserId;

        if (!isOwner) {
            Alert.alert('权限不足', '只有群主才能修改群聊名称');
            return;
        }

        try {
            setIsLoading(true);

            // ✅ Call new API that only sends chat_id, user_id, name (no action field)
            const result = await updateGroupName(chatId, currentUserId, newGroupName.trim());

            console.log('✅ [UpdateGroupName] API response:', {
                success: result.success,
                message: result.message,
                data: result.data,
                fullResponse: result,
            });

            if (result.success) {
                // ✅ Reload group members to get updated name from backend
                await loadGroupMembers();
                setShowGroupNameModal(false);
                Alert.alert('成功', '群聊名称已更新');
            } else {
                console.error('❌ [UpdateGroupName] Failed:', result.message);
                Alert.alert('错误', result.message || '更新群聊名称失败');
            }
        } catch (error) {
            console.error('❌ [UpdateGroupName] Exception:', error);
            Alert.alert('错误', '更新群聊名称失败，请重试');
        } finally {
            setIsLoading(false);
        }
    }, [newGroupName, chatId, currentUserId, groupChat, loadGroupMembers]);

    // Update group avatar
    const handleUpdateGroupAvatar = useCallback(async () => {
        // ✅ Check if current user is owner
        const isOwner = groupChat?.ownerId === currentUserId;

        if (!isOwner) {
            Alert.alert('权限不足', '只有群主才能修改群头像');
            return;
        }

        Alert.alert(
            '修改群头像',
            '选择图片来源',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '从相册选择',
                    onPress: async () => {
                        try {
                            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

                            if (permissionResult.granted === false) {
                                Alert.alert('需要权限', '需要访问相册权限才能选择图片');
                                return;
                            }

                            const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.8,
                            });

                            if (!result.canceled && result.assets[0]) {
                                const asset = result.assets[0];
                                setIsLoading(true);


                                // ✅ Call new API that only sends chat_id, user_id, image (no action field)
                                const updateResult = await updateGroupImage(
                                    chatId,
                                    currentUserId,
                                    {
                                        uri: asset.uri,
                                        name: `group_avatar_${Date.now()}.jpg`,
                                        type: 'image/jpeg',
                                    }
                                );

                                console.log('✅ [UpdateGroupAvatar] API response:', updateResult);

                                if (updateResult.success) {
                                    // ✅ Reload group members to get updated image from backend
                                    await loadGroupMembers();
                                    Alert.alert('成功', '群头像已更新');
                                } else {
                                    console.error('❌ [UpdateGroupAvatar] Failed:', updateResult.message);
                                    Alert.alert('错误', updateResult.message || '更新群头像失败');
                                }

                                setIsLoading(false);
                            }
                        } catch (error) {
                            console.error('❌ [UpdateGroupAvatar] Exception:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '更新群头像失败，请重试');
                        }
                    },
                },
                {
                    text: '拍照',
                    onPress: async () => {
                        try {
                            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

                            if (permissionResult.granted === false) {
                                Alert.alert('需要权限', '需要访问相机权限才能拍照');
                                return;
                            }

                            const result = await ImagePicker.launchCameraAsync({
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.8,
                            });

                            if (!result.canceled && result.assets[0]) {
                                const asset = result.assets[0];
                                setIsLoading(true);

                                // ✅ Call new API that only sends chat_id, user_id, image (no action field)
                                const updateResult = await updateGroupImage(
                                    chatId,
                                    currentUserId,
                                    {
                                        uri: asset.uri,
                                        name: `group_avatar_${Date.now()}.jpg`,
                                        type: 'image/jpeg',
                                    }
                                );

                                console.log('✅ [UpdateGroupAvatar] API response:', updateResult);

                                if (updateResult.success) {
                                    // ✅ Reload group members to get updated image from backend
                                    await loadGroupMembers();
                                    Alert.alert('成功', '群头像已更新');
                                } else {
                                    console.error('❌ [UpdateGroupAvatar] Failed:', updateResult.message);
                                    Alert.alert('错误', updateResult.message || '更新群头像失败');
                                }

                                setIsLoading(false);
                            }
                        } catch (error) {
                            console.error('❌ [UpdateGroupAvatar] Exception:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '更新群头像失败，请重试');
                        }
                    },
                },
            ]
        );
    }, [chatId, currentUserId, groupChat, loadGroupMembers]);

    // Leave group
    const handleLeaveGroup = useCallback(() => {
        Alert.alert(
            '退出群聊',
            `确定要退出群聊 "${chatName}" 吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '退出',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // Call API to leave group
                            const result = await updateGroup({
                                chat_id: chatId,
                                user_id: currentUserId,
                                action: 'leave',
                                target_id: currentUserId,
                            });

                            console.log('✅ [LeaveGroup] API response:', result);

                            if (result.success) {
                                removeChat(chatId);
                                setIsLoading(false);

                                Alert.alert('成功', '已退出群聊', [
                                    {
                                        text: '确定',
                                        onPress: () => navigation.reset({
                                            index: 0,
                                            routes: [{ name: 'ChatList' }],
                                        }),
                                    },
                                ]);
                            } else {
                                setIsLoading(false);
                                console.error('❌ [LeaveGroup] Failed:', result.message);
                                Alert.alert('错误', result.message || '退出群聊失败');
                            }
                        } catch (error) {
                            console.error('❌ [LeaveGroup] Exception:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '退出群聊失败，请重试');
                        }
                    },
                },
            ]
        );
    }, [chatName, chatId, currentUserId, removeChat, navigation]);

    // Dismiss group
    const handleDismissGroup = useCallback(() => {
        if (groupChat?.ownerId !== currentUserId) {
            Alert.alert('权限不足', '只有群主才能解散群聊');
            return;
        }

        Alert.alert(
            '解散群聊',
            `确定要解散群聊 "${chatName}" 吗？此操作无法撤销。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '解散',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // ✅ Split members: others (remove) and self (leave)
                            const otherMembers = allMemberIds.filter(id => id !== currentUserId);

                            console.log('🔄 [DismissGroup] Dismissing group:', {
                                chat_id: chatId,
                                total_members: allMemberIds.length,
                                other_members: otherMembers.length,
                                self: currentUserId,
                            });

                            // Step 1: Remove all other members
                            const removeResults = await Promise.all(
                                otherMembers.map(async (memberId) => {
                                    const result = await updateGroup({
                                        chat_id: chatId,
                                        user_id: currentUserId,
                                        action: 'remove',
                                        target_id: memberId,
                                    });
                                    return { memberId, success: result.success, message: result.message };
                                })
                            );

                            console.log('✅ [DismissGroup] Remove others results:', removeResults);

                            // Check if all removals succeeded
                            const failedRemovals = removeResults.filter(r => !r.success);

                            if (failedRemovals.length > 0) {
                                setIsLoading(false);
                                console.error('❌ [DismissGroup] Some removals failed:', failedRemovals);
                                Alert.alert(
                                    '部分失败',
                                    `移除 ${failedRemovals.length} 位成员失败，无法完全解散群聊`
                                );
                                return;
                            }

                            // Step 2: Leave the group (self)
                            console.log('🔄 [DismissGroup] Owner leaving group...');
                            const leaveResult = await updateGroup({
                                chat_id: chatId,
                                user_id: currentUserId,
                                action: 'leave',
                                target_id: currentUserId,
                            });

                            console.log('✅ [DismissGroup] Leave result:', leaveResult);

                            if (leaveResult.success) {
                                removeChat(chatId);
                                setIsLoading(false);

                                Alert.alert('成功', '群聊已解散', [
                                    {
                                        text: '确定',
                                        onPress: () => navigation.reset({
                                            index: 0,
                                            routes: [{ name: 'ChatList' }],
                                        }),
                                    },
                                ]);
                            } else {
                                setIsLoading(false);
                                console.error('❌ [DismissGroup] Failed to leave:', leaveResult.message);
                                Alert.alert('错误', `无法退出群聊: ${leaveResult.message}`);
                            }
                        } catch (error) {
                            console.error('❌ [DismissGroup] Exception:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '解散群聊失败，请重试');
                        }
                    },
                },
            ]
        );
    }, [groupChat, currentUserId, chatName, chatId, allMemberIds, removeChat, navigation]);

    // Render member item
    const renderMemberItem = useCallback((member: Member, index: number) => {
        const isCurrentUser = member.id === currentUserId;
        const isKicking = kickingMemberId === member.id;
        const permission = checkKickPermission(member.id);
        const showKickBadge = permission.hasPermission && !isCurrentUser;

        // ✅ Correctly check if member is a friend
        const isFriend = friendsList.some(f => {
            // If I sent the request, friend is approve_id
            if (f.approve_id === member.id) return true;
            // If friend sent the request, friend is request_id
            if (f.request_id === member.id) return true;
            return false;
        });

        return (
            <View key={member.id} style={styles.memberItemWrapper}>
                <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => handleViewMemberProfile(member)}
                    disabled={isKicking}
                >
                    <View style={styles.memberAvatarContainer}>
                        {(() => {
                            const placeholderUrl = "https://balkingly-hemitropic-lelah.ngrok-free.dev";
                            const avatarUri = member.avatar;
                            const shouldShowPlaceholder = !avatarUri || avatarUri.trim() === '' || avatarUri.trim() === placeholderUrl;
                            return (
                                <Image
                                    source={shouldShowPlaceholder ? require('../../assets/images/personal.png') : { uri: avatarUri }}
                                    style={[styles.memberAvatar, isKicking && styles.memberAvatarKicking]}
                                />
                            );
                        })()}
                        {isFriend && !isCurrentUser && (
                            <View style={styles.friendBadge}>
                                <Ionicons name="heart" size={10} color="#FF3B30" />
                            </View>
                        )}
                        {isKicking && (
                            <View style={styles.kickingOverlay}>
                                <ActivityIndicator size="small" color="#FF3B30" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.memberName, isCurrentUser && styles.currentUserName]} numberOfLines={1}>
                        {isCurrentUser ? '我' : member.name}
                        {member.id === groupChat?.ownerId && <Text style={styles.ownerLabel}> (群主)</Text>}
                        {member.isAdmin && member.id !== groupChat?.ownerId && (
                            <Text style={styles.adminLabel}> (管理员)</Text>
                        )}
                    </Text>
                </TouchableOpacity>
                {/* ✅ Kick button outside avatar container */}
                {showKickBadge && (
                    <TouchableOpacity
                        style={styles.kickButton}
                        onPress={() => handleKickMember(member.id, member.name)}
                        disabled={isKicking}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={12} color="#999" />
                    </TouchableOpacity>
                )}
            </View>
        );
    }, [currentUserId, kickingMemberId, checkKickPermission, friendsList, groupChat, handleViewMemberProfile, handleKickMember]);

    // Render add member button
    const renderAddMemberButton = useCallback(() => (
        <View key="add-member-button" style={styles.memberItemWrapper}>
            <TouchableOpacity style={styles.memberItem} onPress={handleAddMembers}>
                <View style={styles.addMemberButton}>
                    <Ionicons name="person-add" size={24} color="#666" />
                </View>
                <Text style={styles.memberName}>添加</Text>
            </TouchableOpacity>
        </View>
    ), [handleAddMembers]);

    // Loading screen
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>群聊设置</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>处理中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>群聊设置</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#FFD700']}
                        tintColor="#FFD700"
                        title="下拉刷新"
                        titleColor="#666"
                    />
                }
            >
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={[styles.groupInfoContainer, { borderBottomWidth: 0 }]}>
                            <TouchableOpacity
                                style={styles.groupAvatarGridContainer}
                                onPress={handleUpdateGroupAvatar}
                            >
                                {(() => {
                                    const placeholderUrl = "https://balkingly-hemitropic-lelah.ngrok-free.dev";
                                    const shouldShowPlaceholder = !groupImage || groupImage.trim() === '' || groupImage.trim() === placeholderUrl;


                                    if (shouldShowPlaceholder) {
                                        // Show grid of member avatars as placeholder
                                        return allMembers.slice(0, 4).map((member) => {
                                            const memberPlaceholder = !member.avatar || member.avatar.trim() === '' || member.avatar.trim() === placeholderUrl;
                                            return (
                                                <Image
                                                    key={member.id}
                                                    source={memberPlaceholder ? require('../../assets/images/personal.png') : { uri: member.avatar }}
                                                    style={styles.groupAvatarImage}
                                                />
                                            );
                                        });
                                    } else {
                                        // Show actual group avatar (full size)
                                        return (
                                            <Image
                                                source={{ uri: groupImage }}
                                                style={styles.groupAvatarFull}
                                            />
                                        );
                                    }
                                })()}
                                {/* Camera icon overlay */}
                                <View style={styles.avatarEditOverlay}>
                                    <Ionicons name="camera" size={16} color="#FFF" />
                                </View>
                            </TouchableOpacity>
                            <View style={styles.groupInfo}>
                                <Text style={styles.groupName}>{chatName}</Text>
                                <Text style={styles.groupMemberCount}>
                                    {allMembers.length} 位成员
                                    {allMembers.filter(m => m.isAdmin).length > 0 && (
                                        <Text style={styles.adminInfo}>
                                            {' • '}{allMembers.filter(m => m.isAdmin).length} 位管理员
                                        </Text>
                                    )}
                                </Text>
                            </View>
                            {groupChat?.ownerId === currentUserId && (
                                <TouchableOpacity style={styles.editButton} onPress={() => setShowGroupNameModal(true)}>
                                    <Ionicons name="create-outline" size={20} color={colors.text.gray} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>群成员</Text>
                    <View style={styles.card}>
                        <View style={styles.gridContainer}>
                            {/* ✅ Show max 7 members (to make room for add button if owner) or 8 members - 2 rows only */}
                            {allMembers.slice(0, groupChat?.ownerId === currentUserId ? 7 : 8).map((member, index) =>
                                renderMemberItem(member, index)
                            )}
                            {groupChat?.ownerId === currentUserId && renderAddMemberButton()}
                        </View>
                        <TouchableOpacity
                            style={styles.viewMoreBtn}
                            onPress={() => navigation.navigate('GroupMemberList', { groupId: chatId })}
                        >
                            <Text style={styles.viewMoreText}>查看全部成员 ({allMembers.length})</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.text.grayLight} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    {/* <Text style={styles.sectionTitle}>通知设置</Text> */}
                    <View style={styles.card}>
                        {/* 消息免打扰 */}
                        {/* <View style={[styles.settingItem, styles.borderBottom]}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="notifications-off-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>消息免打扰</Text>
                            </View>
                            <Switch
                                value={muteNotifications}
                                onValueChange={handleToggleMuteNotifications}
                                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                                thumbColor={colors.background.white}
                            />
                        </View> */}

                        {/* 置顶聊天 */}
                        {/* <View style={[styles.settingItem, styles.borderBottom]}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="pin-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>置顶聊天</Text>
                            </View>
                            <Switch
                                value={pinToTop}
                                onValueChange={handleTogglePinToTop}
                                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                                thumbColor={colors.background.white}
                            />
                        </View> */}

                        {/* 显示群成员昵称 */}
                        {/* <View style={styles.settingItem}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="eye-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>显示群成员昵称</Text>
                            </View>
                            <Switch
                                value={showOnTop}
                                onValueChange={handleToggleShowNicknames}
                                trackColor={{ false: colors.border.gray, true: colors.functional.greenBright }}
                                thumbColor={colors.background.white}
                            />
                        </View> */}
                    </View>
                </View>

                {/* Chat History and Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>聊天管理</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={[styles.settingItem, styles.borderBottom]} onPress={handleSearchHistory}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="search-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>查找聊天记录</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
                        </TouchableOpacity>

                        {/* <TouchableOpacity style={styles.settingItem} onPress={handleClearHistory}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="trash-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>清空聊天记录</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
                        </TouchableOpacity> */}
                    </View>
                </View>

                {/* Other Settings */}
                {/* <View style={styles.section}>
                    <Text style={styles.sectionTitle}>其他</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={[styles.settingItem, styles.borderBottom]}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={colors.text.white} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>群聊权限</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
                        </TouchableOpacity>
                    </View>
                </View> */}

                {/* Danger Zone */}
                <View style={styles.dangersection}>
                    <View style={styles.dangercard}>
                        <TouchableOpacity style={[styles.dangerButton, styles.borderBottom]} onPress={handleLeaveGroup}>
                            <Ionicons name="exit-outline" size={20} color={colors.text.white} />
                            <Text style={styles.dangerButtonText}>退出群聊</Text>
                        </TouchableOpacity>

                        {groupChat?.ownerId === currentUserId && (
                            <TouchableOpacity
                                style={styles.dangerButton1}
                                onPress={handleDismissGroup}
                            >
                                {/* <Ionicons name="trash-outline" size={20} color={colors.text.grayLight} /> */}
                                <Text style={styles.dangerButtonText1}>解散群聊</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Group Name Modal */}
            <Modal
                visible={showGroupNameModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGroupNameModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackground}
                        activeOpacity={1}
                        onPress={() => setShowGroupNameModal(false)}
                    >
                        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>修改群聊名称</Text>
                                <TouchableOpacity onPress={() => setShowGroupNameModal(false)}>
                                    <Ionicons name="close" size={24} color={colors.text.gray} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <TextInput
                                    style={styles.groupNameInput}
                                    placeholder="请输入群聊名称"
                                    placeholderTextColor={colors.text.placeholder}
                                    value={newGroupName}
                                    onChangeText={setNewGroupName}
                                    autoFocus={true}
                                    maxLength={30}
                                />

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.cancelButton]}
                                        onPress={() => setShowGroupNameModal(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>取消</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.confirmButton]}
                                        onPress={handleUpdateGroupName}
                                    >
                                        <Text style={styles.confirmButtonText}>确定</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.chatBg,
    },
    scrollView: { flex: 1 },

    // --- Header ---
    header: {
        backgroundColor: colors.background.yellowLight,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.black,
    },

    // --- Loading ---
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: {
        marginTop: 12,
        fontSize: typography.fontSize14,
        color: colors.text.grayDark,
    },

    // --- Profile Card (群成员网格) ---
    profileCard: {
        backgroundColor: colors.background.white,
        // marginHorizontal: 10,
        marginTop: 16,
        borderRadius: borders.radius12,
        paddingTop: 15,
        paddingBottom: 0,
    },

    // --- 网格样式 ---
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 30,
        paddingVertical: 24,
    },
    gridItem: {
        width: (width - 48) / 4, // ✅ 4 items per row: (width - padding*2) / 4
        alignItems: "center",
        marginBottom: 20,
        justifyContent: 'center',
    },
    avatarContainer: {
        width: 56,
        height: 56,
        backgroundColor: colors.background.grayPale,
        borderRadius: borders.radius16,
        justifyContent: "center",
        alignItems: "center",
        margin: 8,
        overflow: "hidden",
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarImage: {
        width: 56,
        height: 56,
        margin: 10,
        borderRadius: borders.radius16,
    },
    memberName: {
        fontSize: typography.fontSize12,
        color: colors.text.dark,
        textAlign: "center",
        marginHorizontal: 10,
        fontWeight: typography.fontWeight500,
    },

    // Specific to GroupSettingScreen member display
    memberItemWrapper: {
        width: (width - 48) / 4, // ✅ Match gridContainer padding (24 * 2 = 48)
        marginBottom: 20,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberItem: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberAvatarContainer: {
        position: 'relative',
        marginBottom: 8,
        width: 56,
        height: 56,
        borderRadius: borders.radius16,
        overflow: 'hidden',
        backgroundColor: colors.background.grayPale,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    memberAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: borders.radius16,
    },
    memberAvatarKicking: { opacity: 0.5 },
    currentUserName: { fontWeight: typography.fontWeight600, color: colors.text.black },
    ownerLabel: { fontSize: typography.fontSize11, color: colors.functional.yellow },
    adminLabel: { fontSize: typography.fontSize11, color: colors.functional.green },

    addMemberButton: {
        width: 56,
        height: 56,
        borderRadius: borders.radius16,
        backgroundColor: colors.background.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: colors.functional.yellowBright,
        borderStyle: 'dashed',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    viewMoreBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 12,
        borderTopWidth: borders.width1,
        borderTopColor: colors.border.light,
    },
    viewMoreText: {
        color: colors.text.grayLight,
        fontSize: typography.fontSize14,
        marginRight: 4,
    },

    // --- BADGES ---
    friendBadge: {
        position: 'absolute',
        top: -4,
        left: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.background.white,
        borderWidth: borders.width1,
        borderColor: colors.functional.red,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1, // Ensure badge is on top
    },
    // ✅ Kick button style - same as GroupMemberList
    kickButton: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.background.white,
        borderWidth: 1.5,
        borderColor: colors.border.gray,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    kickingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background.transparentWhite50,
        borderRadius: borders.radius8,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2, // Ensure overlay is on top of badges
    },

    // --- Section ---
    section: {
        marginTop: 16,
        marginHorizontal: 16,
    },
    dangersection: {
        marginTop: 60,
        marginHorizontal: 16,
    },
    sectionTitle: {
        fontSize: typography.fontSize14,
        color: colors.text.gray,
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    // Styles from GroupSettingScreen that map to new structure
    sectionHeader: { // Used for "群成员" and "共 X 人"
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    sectionSubtitle: { // Used for "共 X 人"
        fontSize: typography.fontSize12,
        color: colors.text.gray,
    },

    // --- Card ---
    card: {
        backgroundColor: colors.background.white,
        borderRadius: borders.radius12,
        overflow: "hidden",
    },
    dangercard: {
        backgroundColor: colors.background.chatBg,
        borderRadius: borders.radius12,
        overflow: "hidden",
        gap: 5,
    },

    // --- Group Info Section (adapted from GroupSettingScreen) ---
    groupInfoContainer: { // This will now be inside a card
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop:8,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.border.light,
    },
    groupAvatarGridContainer: { // New container for the grid itself
        width: 60,
        height: 60,
        borderRadius: borders.radius8,
        overflow: 'hidden',
        marginRight: 20,
        backgroundColor: colors.background.grayLight, // Default background
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupAvatarImage: {
        width: '50%',
        height: '50%',
    },
    groupAvatarFull: {
        width: '100%',
        height: '100%',
    },
    avatarEditOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupInfo: { flex: 1 },
    groupName: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.black,
        marginBottom: 4,
    },
    groupMemberCount: {
        fontSize: typography.fontSize14,
        color: colors.text.gray,
    },
    ownerInfo: { fontSize: typography.fontSize12, color: colors.functional.yellow },
    adminInfo: { fontSize: typography.fontSize12, color: colors.functional.green },
    editButton: { padding: 8 },

    // --- Setting Item (used for general settings) ---
    settingItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
    },
    borderBottom: {
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.border.light,
    },
    iconContainer: {
        width: 40,
        height: 40,
        backgroundColor: colors.functional.yellow, // Default color for icons, consistent with GroupDetails.tsx
        borderRadius: borders.radius20,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    dangerIcon: {
        backgroundColor: colors.functional.redMedium,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight500,
        color: colors.text.dark,
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: typography.fontSize12,
        color: colors.text.grayLight,
    },
    settingLeft: { // Retained from original GroupSettingScreen for switch items
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingLabel: { // Retained from original GroupSettingScreen for switch items
        fontSize: typography.fontSize15,
        color: colors.text.dark,
        marginLeft: 12,
    },

    // --- Danger Buttons (adapted from GroupSettingScreen) ---
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginHorizontal: 0, // Removed horizontal margin, will be handled by section padding
        backgroundColor: colors.functional.redMedium, // Solid red background
        borderRadius: borders.radius12, // Match card radius
        borderWidth: 0, // No border
    },
    dismissButton: { marginTop: 12 },
    dangerButtonText: {
        fontSize: typography.fontSize16, // Slightly larger font
        fontWeight: typography.fontWeight600, // Bolder
        color: colors.text.white, // White text for contrast
        marginLeft: 8,
    },

    dangerButton1: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginHorizontal: 0,
        borderWidth: 0, // No border
    },
    dangerButtonText1: {
        fontSize: typography.fontSize16, // Slightly larger font
        fontWeight: typography.fontWeight600, // Bolder
        color: colors.text.grayLight, // White text for contrast
        marginLeft: 8,
    },

    // --- MODAL ---
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.transparentBlack50 }, // Added background
    modalBackground: { // Renamed from modalOverlay in GroupSettingScreen, adapted
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        backgroundColor: colors.background.white,
        borderRadius: borders.radius12, // Match GroupDetails card radius
        width: scaleWidth(320),
        maxWidth: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.border.light, // Consistent border color
    },
    modalTitle: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.dark, // Consistent text color
    },
    modalBody: { padding: 20 },
    groupNameInput: {
        backgroundColor: colors.background.grayPale, // Consistent with other backgrounds
        borderRadius: borders.radius8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: typography.fontSize15,
        color: colors.text.dark, // Consistent text color
        borderWidth: borders.width1,
        borderColor: colors.border.light, // Consistent border color
        marginBottom: 20,
    },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: borders.radius8,
        alignItems: 'center',
    },
    cancelButton: { backgroundColor: colors.background.grayLight },
    cancelButtonText: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight600,
        color: colors.text.grayDark,
    },
    confirmButton: { backgroundColor: colors.functional.blue }, // Changed to functional.blue
    confirmButtonText: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight600,
        color: colors.text.white, // Changed to white for contrast
    },
});