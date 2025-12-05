import React, { useState } from 'react';
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
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';

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
}

export default function GroupSettingScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const params = route.params as RouteParams;
    const { chatId } = params;

    const { removeChat, getChatById, addChat, clearChat } = useChatStore();
    const currentUserId = useUserStore((state) => state.user?.id) || 'me';
    const currentUser = useUserStore((state) => state.user);

    // Get real-time data from store instead of route params
    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '';
    
    // 确保当前用户总是在成员列表中
    const allMembers: Member[] = React.useMemo(() => {
        const storeMembers = groupChat?.members || [];
        const storeMemberIds = groupChat?.memberIds || [];
        
        // 如果当前用户不在成员列表中，则添加
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

    const allMemberIds = React.useMemo(() => {
        return allMembers.map(member => member.id);
    }, [allMembers]);

    const [muteNotifications, setMuteNotifications] = useState(
        groupChat?.rawData?.push_notification || false
    );
    const [pinToTop, setPinToTop] = useState(
        groupChat?.rawData?.top_notification || false
    );
    const [showOnTop, setShowOnTop] = useState(
        groupChat?.rawData?.show_nicknames || false
    );
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState(chatName);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);

    // Update newGroupName when chatName changes
    React.useEffect(() => {
        setNewGroupName(chatName);
    }, [chatName]);

    // Sync state with store
    React.useEffect(() => {
        if (groupChat) {
            setMuteNotifications(groupChat.rawData?.push_notification || false);
            setPinToTop(groupChat.rawData?.top_notification || false);
            setShowOnTop(groupChat.rawData?.show_nicknames || false);
        }
    }, [groupChat]);

    const handleRefresh = async () => {
        setRefreshing(true);

        // Refresh by getting latest data from store
        const latestChat = getChatById(chatId);
        if (latestChat) {
            // Data is already updated from store, just need to re-render
        }

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        setRefreshing(false);
    };

    const handleToggleMuteNotifications = (value: boolean) => {
        setMuteNotifications(value);

        // Update local store
        if (groupChat) {
            const updatedChat = {
                ...groupChat,
                rawData: {
                    ...groupChat.rawData,
                    push_notification: value,
                }
            };
            addChat(updatedChat);
        }
    };

    const handleTogglePinToTop = (value: boolean) => {
        setPinToTop(value);

        // Update local store
        if (groupChat) {
            const updatedChat = {
                ...groupChat,
                rawData: {
                    ...groupChat.rawData,
                    top_notification: value,
                }
            };
            addChat(updatedChat);
        }
    };

    const handleToggleShowNicknames = (value: boolean) => {
        setShowOnTop(value);

        // Update local store
        if (groupChat) {
            const updatedChat = {
                ...groupChat,
                rawData: {
                    ...groupChat.rawData,
                    show_nicknames: value,
                }
            };
            addChat(updatedChat);
        }
    };

    const handleSearchHistory = () => {
        navigation.navigate('SearchMessages', {
            chatId,
            chatName,
        });
    };

    const handleClearHistory = () => {
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
    };

    // 检查是否有权限踢人（群主或管理员）
    const checkKickPermission = (targetMemberId: string) => {
        const isOwner = groupChat?.ownerId === currentUserId;
        const isAdmin = groupChat?.admins?.includes(currentUserId);
        const isTargetOwner = groupChat?.ownerId === targetMemberId;
        const isTargetAdmin = groupChat?.admins?.includes(targetMemberId);
        
        // 群主可以踢所有人，但不能踢自己
        if (isOwner) {
            if (targetMemberId === currentUserId) {
                return { hasPermission: false, message: '群主不能踢出自己' };
            }
            return { hasPermission: true, message: '' };
        }
        
        // 管理员可以踢普通成员，但不能踢群主和其他管理员
        if (isAdmin) {
            if (isTargetOwner || isTargetAdmin) {
                return { hasPermission: false, message: '管理员不能踢出群主或其他管理员' };
            }
            if (targetMemberId === currentUserId) {
                return { hasPermission: false, message: '不能踢出自己' };
            }
            return { hasPermission: true, message: '' };
        }
        
        // 普通成员没有踢人权限
        return { hasPermission: false, message: '只有群主或管理员可以踢人' };
    };

    const handleKickMember = async (memberId: string, memberName: string) => {
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
                            // TODO: 调用后端 API 踢人
                            // await kickGroupMember({ 
                            //     group_id: chatId, 
                            //     user_id: memberId,
                            //     kicked_by: currentUserId 
                            // });

                            // 更新本地 store
                            if (groupChat) {
                                const updatedMembers = allMembers.filter(m => m.id !== memberId);
                                const updatedMemberIds = allMemberIds.filter(id => id !== memberId);
                                const updatedChat = {
                                    ...groupChat,
                                    members: updatedMembers,
                                    memberIds: updatedMemberIds,
                                };
                                addChat(updatedChat);
                            }

                            Alert.alert('成功', `已成功将 ${memberName} 踢出群聊`);
                            setKickingMemberId(null);
                        } catch (error) {
                            console.error('Kick member error:', error);
                            Alert.alert('错误', '踢出成员失败，请重试');
                            setKickingMemberId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleViewMemberProfile = (member: Member) => {
        if (member.id === currentUserId) {
            // 点击自己，不显示操作菜单
            return;
        }

        const permission = checkKickPermission(member.id);
        const canKick = permission.hasPermission;

        const options: any[] = [
            { text: '取消', style: 'cancel' },
            {
                text: '查看资料',
                onPress: () => {
                    navigation.navigate('UserProfile', {
                        userId: member.id,
                        userName: member.name,
                    });
                },
            },
            {
                text: '发送消息',
                onPress: () => {
                    navigation.navigate('ChatRoom', {
                        chatId: member.id,
                        chatName: member.name,
                        avatar: member.avatar,
                    });
                },
            },
        ];

        if (canKick) {
            options.push({
                text: '踢出群聊',
                style: 'destructive',
                onPress: () => handleKickMember(member.id, member.name),
            });
        }

        Alert.alert(member.name, '选择操作', options);
    };

    const handleAddMembers = () => {
        navigation.navigate('AddGroupMembers', {
            chatId,
            chatName,
            currentMembers: allMemberIds,
        });
    };

    const handleUpdateGroupName = () => {
        if (!newGroupName.trim()) {
            Alert.alert('错误', '群聊名称不能为空');
            return;
        }

        // TODO: Call API to update group name
        // await updateGroupName({ group_id: chatId, name: newGroupName.trim() });

        // Update group chat name in local store
        if (groupChat) {
            const updatedChat = {
                ...groupChat,
                name: newGroupName.trim(),
            };
            addChat(updatedChat);
        }

        setShowGroupNameModal(false);
        Alert.alert('成功', '群聊名称已更新');
    };

    const handleLeaveGroup = () => {
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
                            // await leaveGroup({ group_id: chatId, user_id: currentUserId });

                            removeChat(chatId);

                            setIsLoading(false);

                            Alert.alert('成功', '已退出群聊', [
                                {
                                    text: '确定',
                                    onPress: () => {
                                        navigation.reset({
                                            index: 0,
                                            routes: [{ name: 'ChatList' }],
                                        });
                                    },
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
    };

    const handleDismissGroup = () => {
        // 只有群主才能解散群聊
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
                            // await dismissGroup({ group_id: chatId, user_id: currentUserId });

                            removeChat(chatId);

                            setIsLoading(false);

                            Alert.alert('成功', '群聊已解散', [
                                {
                                    text: '确定',
                                    onPress: () => {
                                        navigation.reset({
                                            index: 0,
                                            routes: [{ name: 'ChatList' }],
                                        });
                                    },
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
    };

    const renderMemberItem = (member: Member, index: number) => {
        const isCurrentUser = member.id === currentUserId;
        const isKicking = kickingMemberId === member.id;
        const permission = checkKickPermission(member.id);
        const showKickBadge = permission.hasPermission && !isCurrentUser;

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
                    {member.id === groupChat?.ownerId && (
                        <Text style={styles.ownerLabel}> (群主)</Text>
                    )}
                    {groupChat?.admins?.includes(member.id) && member.id !== groupChat?.ownerId && (
                        <Text style={styles.adminLabel}> (管理员)</Text>
                    )}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderAddMemberButton = () => (
        <TouchableOpacity
            style={styles.memberItem}
            onPress={handleAddMembers}
        >
            <View style={styles.addMemberButton}>
                <Ionicons name="person-add" size={24} color="#666" />
            </View>
            <Text style={styles.memberName}>添加</Text>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
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
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
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
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => setShowGroupNameModal(true)}
                        >
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
                            {groupChat?.ownerId === currentUserId && ' • 您有踢人权限'}
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

                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={handleSearchHistory}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="search-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>查找聊天记录</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={handleClearHistory}
                    >
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
                    <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={handleLeaveGroup}
                    >
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
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>修改群聊名称</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowGroupNameModal(false)}
                                    >
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
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scaleWidth(16),
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        backgroundColor: '#FFFFFF',
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
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#999',
    },
    groupInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scaleWidth(16),
    },
    groupAvatarContainer: {
        width: scaleWidth(60),
        height: scaleWidth(60),
        marginRight: 12,
    },
    groupAvatarGrid: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: 8,
        overflow: 'hidden',
    },
    groupAvatarImage: {
        width: '50%',
        height: '50%',
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    groupMemberCount: {
        fontSize: 14,
        color: '#666',
    },
    ownerInfo: {
        fontSize: 12,
        color: '#999',
    },
    editButton: {
        padding: 8,
    },
    membersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: scaleWidth(8),
    },
    memberItem: {
        width: scaleWidth(70),
        alignItems: 'center',
        marginHorizontal: scaleWidth(8),
        marginBottom: 16,
    },
    memberAvatarContainer: {
        position: 'relative',
        marginBottom: 6,
    },
    memberAvatar: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: 8,
        backgroundColor: '#E0E0E0',
    },
    memberAvatarKicking: {
        opacity: 0.5,
    },
    memberName: {
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
    },
    currentUserName: {
        fontWeight: '600',
        color: '#0c0c0cff',
    },
    ownerLabel: {
        fontSize: 10,
        color: '#FF9500',
    },
    adminLabel: {
        fontSize: 10,
        color: '#34C759',
    },
    addMemberButton: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    kickBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    kickingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scaleWidth(16),
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        color: '#333',
        marginLeft: 12,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginHorizontal: scaleWidth(16),
        backgroundColor: '#FFF5F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFE0E0',
    },
    dismissButton: {
        marginTop: 12,
    },
    dangerButtonText: {
        fontSize: 15,
        color: '#FF3B30',
        fontWeight: '500',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
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
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    modalBody: {
        padding: 20,
    },
    groupNameInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F5F5F5',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    confirmButton: {
        backgroundColor: '#FFD700',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
});