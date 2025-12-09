import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    ScrollView,
    Switch,
    Alert,
    Dimensions,
    TextInput,
    Modal,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, borders, typography } from "../../styles";
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { blockUser, deleteFriend, readFriends } from '../../api/Friend';

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
                    avatar: currentUser.avatar || `https://i.pravatar.cc/150?u=${currentUserId}`,
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
    const [friendsList, setFriendsList] = useState<string[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load friends list
    const loadFriendsList = useCallback(async () => {
        if (!currentUserId) return;
        setLoadingFriends(true);
        try {
            // Pass user_id directly, not as an object
            const result = await readFriends(parseInt(currentUserId, 10));
            if (result.success && result.data) {
                const allFriends = [
                    ...(result.data.request || []),
                    ...(result.data.approve || [])
                ];
                const friendIds = allFriends.map((friend: any) => friend.user_id || friend.id);
                setFriendsList(friendIds);
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            setLoadingFriends(false);
        }
    }, [currentUserId]);

    // Refresh handler
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadFriendsList();
        setRefreshing(false);
    }, [loadFriendsList]);

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
        navigation.navigate('SearchMessages', { chatId, chatName });
    }, [navigation, chatId, chatName]);

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
                            // TODO: Call backend API
                            const updatedMembers = allMembers.filter(m => m.id !== memberId);
                            const updatedMemberIds = allMemberIds.filter(id => id !== memberId);
                            updateChatData({
                                members: updatedMembers,
                                memberIds: updatedMemberIds,
                            });

                            Alert.alert('成功', `已成功将 ${memberName} 踢出群聊`);
                        } catch (error) {
                            console.error('Kick member error:', error);
                            Alert.alert('错误', '踢出成员失败，请重试');
                        } finally {
                            setKickingMemberId(null);
                        }
                    }
                }
            ]
        );
    }, [checkKickPermission, allMembers, allMemberIds, updateChatData]);

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
                            const result = await deleteFriend({
                                user_id: currentUserId,
                                friend_id: memberId,
                            } as any);

                            if (result.success) {
                                setFriendsList(prev => prev.filter(id => id !== memberId));
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
    }, [currentUserId]);

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
                            const result = await blockUser({
                                user_id: currentUserId,
                                blocked_user_id: memberId,
                            } as any);

                            if (result.success) {
                                Alert.alert('成功', '已拉黑该用户');
                                setFriendsList(prev => prev.filter(id => id !== memberId));
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
    }, [currentUserId]);

    // View member profile
    const handleViewMemberProfile = useCallback((member: Member) => {
        if (member.id === currentUserId) return;

        const permission = checkKickPermission(member.id);
        const canKick = permission.hasPermission;
        const isFriend = friendsList.includes(member.id);

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
        navigation.navigate('AddGroupMembers', {
            chatId,
            chatName,
            currentMembers: allMemberIds,
        });
    }, [navigation, chatId, chatName, allMemberIds]);

    // Update group name
    const handleUpdateGroupName = useCallback(() => {
        if (!newGroupName.trim()) {
            Alert.alert('错误', '群聊名称不能为空');
            return;
        }

        // TODO: Call API to update group name
        updateChatData({ name: newGroupName.trim() });
        setShowGroupNameModal(false);
        Alert.alert('成功', '群聊名称已更新');
    }, [newGroupName, updateChatData]);

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
                            // TODO: Call API to leave group
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
                        } catch (error) {
                            console.error('Leave group error:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '退出群聊失败，请重试');
                        }
                    },
                },
            ]
        );
    }, [chatName, chatId, removeChat, navigation]);

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
                            // TODO: Call API to dismiss group
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
                        } catch (error) {
                            console.error('Dismiss group error:', error);
                            setIsLoading(false);
                            Alert.alert('错误', '解散群聊失败，请重试');
                        }
                    },
                },
            ]
        );
    }, [groupChat, currentUserId, chatName, chatId, removeChat, navigation]);

    // Render member item
    const renderMemberItem = useCallback((member: Member, index: number) => {
        const isCurrentUser = member.id === currentUserId;
        const isKicking = kickingMemberId === member.id;
        const permission = checkKickPermission(member.id);
        const showKickBadge = permission.hasPermission && !isCurrentUser;
        const isFriend = friendsList.includes(member.id);

        return (
            <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => handleViewMemberProfile(member)}
                disabled={isKicking}
            >
                <View style={styles.memberAvatarContainer}>
                    <Image
                        source={{ uri: member.avatar || `https://i.pravatar.cc/150?img=${index}` }}
                        style={[styles.memberAvatar, isKicking && styles.memberAvatarKicking]}
                    />
                    {isFriend && !isCurrentUser && (
                        <View style={styles.friendBadge}>
                            <Ionicons name="heart" size={10} color="#FF3B30" />
                        </View>
                    )}
                    {showKickBadge && (
                        <View style={styles.kickBadge}>
                            <Ionicons name="close" size={12} color="#FF3B30" />
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
                    {groupChat?.admins?.includes(member.id) && member.id !== groupChat?.ownerId && (
                        <Text style={styles.adminLabel}> (管理员)</Text>
                    )}
                </Text>
            </TouchableOpacity>
        );
    }, [currentUserId, kickingMemberId, checkKickPermission, friendsList, groupChat, handleViewMemberProfile]);

    // Render add member button
    const renderAddMemberButton = useCallback(() => (
        <TouchableOpacity style={styles.memberItem} onPress={handleAddMembers}>
            <View style={styles.addMemberButton}>
                <Ionicons name="person-add" size={24} color="#666" />
            </View>
            <Text style={styles.memberName}>添加</Text>
        </TouchableOpacity>
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
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>群聊设置</Text>
                <View style={{ width: 40 }} />
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
                {/* Group Info Section */}
                <View style={styles.section}>
                    <View style={styles.groupInfoContainer}>
                        <View style={styles.groupAvatarContainer}>
                            <View style={styles.groupAvatarGrid}>
                                {allMembers.slice(0, 4).map((member, index) => (
                                    <Image
                                        key={index}
                                        source={{ uri: member.avatar || `https://i.pravatar.cc/150?img=${index}` }}
                                        style={styles.groupAvatarImage}
                                    />
                                ))}
                            </View>
                        </View>
                        <View style={styles.groupInfo}>
                            <Text style={styles.groupName}>{chatName}</Text>
                            <Text style={styles.groupMemberCount}>
                                {allMembers.length} 位成员
                                {groupChat?.ownerId && (
                                    <Text style={styles.ownerInfo}>
                                        • 群主: {allMembers.find(m => m.id === groupChat.ownerId)?.name || '未知'}
                                    </Text>
                                )}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.editButton} onPress={() => setShowGroupNameModal(true)}>
                            <Ionicons name="create-outline" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Members Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>群成员</Text>
                        <Text style={styles.sectionSubtitle}>
                            共 {allMembers.length} 人
                            {loadingFriends && ' • 加载中...'}
                            {!loadingFriends && friendsList.length > 0 && ` • ${friendsList.length} 位好友`}
                        </Text>
                    </View>
                    <View style={styles.membersGrid}>
                        {allMembers.map((member, index) => renderMemberItem(member, index))}
                        {renderAddMemberButton()}
                    </View>
                </View>

                {/* Settings Section */}
                <View style={styles.section}>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>消息免打扰</Text>
                        </View>
                        <Switch
                            value={muteNotifications}
                            onValueChange={handleToggleMuteNotifications}
                            trackColor={{ false: '#E0E0E0', true: '#FFD700' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="pin-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>置顶聊天</Text>
                        </View>
                        <Switch
                            value={pinToTop}
                            onValueChange={handleTogglePinToTop}
                            trackColor={{ false: '#E0E0E0', true: '#FFD700' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="eye-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>显示群成员昵称</Text>
                        </View>
                        <Switch
                            value={showOnTop}
                            onValueChange={handleToggleShowNicknames}
                            trackColor={{ false: '#E0E0E0', true: '#FFD700' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <TouchableOpacity style={styles.settingItem} onPress={handleSearchHistory}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="search-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>查找聊天记录</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={handleClearHistory}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="trash-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>清空聊天记录</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="shield-checkmark-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>群聊权限</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveGroup}>
                        <Ionicons name="exit-outline" size={22} color="#FF3B30" />
                        <Text style={styles.dangerButtonText}>退出群聊</Text>
                    </TouchableOpacity>

                    {groupChat?.ownerId === currentUserId && (
                        <TouchableOpacity
                            style={[styles.dangerButton, styles.dismissButton]}
                            onPress={handleDismissGroup}
                        >
                            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                            <Text style={styles.dangerButtonText}>解散群聊</Text>
                        </TouchableOpacity>
                    )}
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
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <TextInput
                                    style={styles.groupNameInput}
                                    placeholder="请输入群聊名称"
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
        backgroundColor: "#FFEFB0",
    },

    /** HEADER */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scaleWidth(16),
        paddingVertical: 12,
        backgroundColor: colors.background.yellowBright,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.background.grayLight,
    },
    backButton: { padding: 8 },
    headerTitle: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.blackMedium,
    },

    /** LOADING */
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: {
        marginTop: 12,
        fontSize: typography.fontSize14,
        color: colors.text.grayDark,
    },

    scrollView: { flex: 1 },

    /** SECTION */
    section: {
        backgroundColor: colors.background.white,
        marginTop: 12,
        paddingVertical: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scaleWidth(16),
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: typography.fontSize14,
        color: colors.text.grayDark,
        fontWeight: typography.fontWeight500,
    },
    sectionSubtitle: {
        fontSize: typography.fontSize12,
        color: colors.text.gray,
    },

    /** GROUP INFO */
    groupInfoContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scaleWidth(16) },
    groupAvatarContainer: { width: scaleWidth(60), height: scaleWidth(60), marginRight: 12 },
    groupAvatarGrid: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: borders.radius8,
        overflow: 'hidden',
    },
    groupAvatarImage: { width: '50%', height: '50%' },
    groupInfo: { flex: 1 },
    groupName: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.blackMedium,
        marginBottom: 4,
    },
    groupMemberCount: {
        fontSize: typography.fontSize14,
        color: colors.text.grayDark,
    },
    ownerInfo: { fontSize: typography.fontSize12, color: colors.functional.yellow },

    editButton: { padding: 8 },

    /** MEMBERS GRID */
    membersGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: scaleWidth(8) },
    memberItem: { width: scaleWidth(70), alignItems: 'center', marginHorizontal: scaleWidth(8), marginBottom: 16 },
    memberAvatarContainer: { position: 'relative', marginBottom: 6 },
    memberAvatar: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: borders.radius8,
        backgroundColor: colors.background.grayLight,
    },
    memberAvatarKicking: { opacity: 0.5 },
    memberName: { fontSize: typography.fontSize12, color: colors.text.blackMedium, textAlign: 'center' },
    currentUserName: { fontWeight: typography.fontWeight600, color: colors.text.black },
    ownerLabel: { fontSize: typography.fontSize11, color: colors.functional.yellow },
    adminLabel: { fontSize: typography.fontSize11, color: colors.functional.green },

    addMemberButton: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: borders.radius8,
        backgroundColor: colors.background.grayLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        borderWidth: borders.width1,
        borderColor: colors.background.gray,
        borderStyle: 'dashed',
    },

    /** BADGES */
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
    },
    kickBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.background.white,
        borderWidth: borders.width1,
        borderColor: colors.functional.red,
        justifyContent: 'center',
        alignItems: 'center',
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
    },

    /** SETTINGS */
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scaleWidth(16),
        paddingVertical: 12,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.background.grayLight,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    settingLabel: { fontSize: typography.fontSize15, color: colors.text.blackMedium, marginLeft: 12 },

    /** DANGER BUTTON */
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginHorizontal: scaleWidth(16),
        backgroundColor: colors.background.redLight,
        borderRadius: borders.radius8,
        borderWidth: borders.width1,
        borderColor: colors.functional.red,
    },
    dismissButton: { marginTop: 12 },
    dangerButtonText: {
        fontSize: typography.fontSize15,
        fontWeight: typography.fontWeight500,
        color: colors.functional.red,
        marginLeft: 8,
    },

    /** MODAL */
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalBackground: {
        flex: 1,
        backgroundColor: colors.background.transparentBlack50,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        backgroundColor: colors.background.white,
        borderRadius: borders.radius16,
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
        borderBottomColor: colors.background.grayLight,
    },
    modalTitle: {
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        color: colors.text.blackMedium,
    },
    modalBody: { padding: 20 },
    groupNameInput: {
        backgroundColor: colors.background.grayLight,
        borderRadius: borders.radius8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: typography.fontSize15,
        color: colors.text.blackMedium,
        borderWidth: borders.width1,
        borderColor: colors.background.gray,
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
    confirmButton: { backgroundColor: colors.functional.yellowBright },
    confirmButtonText: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight600,
        color: colors.text.blackMedium,
    },
});