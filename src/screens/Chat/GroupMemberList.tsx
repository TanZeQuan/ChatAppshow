import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readChatMessages, updateGroup } from '../../api/Chat';
import { ensureFullImageUrl } from '../../api/service';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from '../../styles';

const { width } = Dimensions.get('window');
const scaleWidth = (size: number) => (width / 375) * size;

interface Member {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
    isAdmin?: boolean; // true if isadmin === 2
}

export default function GroupMemberList() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { groupId } = route.params;

    const { getChatById, addChat } = useChatStore();
    const currentUserId = useUserStore((state) => state.user?.id);

    const [groupChat, setGroupChat] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);

    useEffect(() => {
        const chat = getChatById(groupId);
        if (chat) {
            setGroupChat(chat);
        }
        setIsLoading(false);
    }, [groupId, getChatById]);

    // Load group members from API
    const loadGroupMembers = useCallback(async () => {
        if (!currentUserId || !groupId) return;

        try {
            console.log('📥 [GroupMemberList] Loading group members...');

            const result = await readChatMessages({
                chat_id: groupId,
                user_id: currentUserId,
                offset: 0,
            });

            if (result.success && result.data?.group && Array.isArray(result.data.group)) {
                const groupMembers = result.data.group;
                console.log('📥 [GroupMemberList] Got group members:', groupMembers);

                // Build members array from API response
                const membersInfo: Member[] = groupMembers.map((member: any) => {
                    const isAdmin = member.isadmin === 2;
                    const memberAvatar = member.image || '';
                    const fullAvatarUrl = ensureFullImageUrl(memberAvatar);

                    return {
                        id: member.user_id,
                        name: member.name || '未知',
                        avatar: fullAvatarUrl,
                        isAdmin: isAdmin,
                    };
                });

                // Extract owner ID and admin IDs
                const ownerMember = groupMembers.find((m: any) => m.isadmin === 2);
                const ownerId = ownerMember?.user_id || '';
                const adminIds = groupMembers
                    .filter((m: any) => m.isadmin === 2)
                    .map((m: any) => m.user_id);

                // Get group info
                const groupInfo = result.data.info || {};
                const groupName = groupInfo.name || groupChat?.name || '未知群聊';
                const groupImageUrl = groupInfo.image || '';
                const fullGroupImageUrl = ensureFullImageUrl(groupImageUrl);

                console.log('✅ [GroupMemberList] Processed member info:', {
                    total: membersInfo.length,
                    ownerId: ownerId,
                    adminIds: adminIds,
                });

                // Update chatStore
                const currentChat = getChatById(groupId);
                if (currentChat) {
                    const updatedChat = {
                        ...currentChat,
                        name: groupName,
                        avatar: fullGroupImageUrl,
                        members: membersInfo,
                        memberIds: groupMembers.map((m: any) => m.user_id),
                        ownerId: ownerId,
                        admins: adminIds,
                    };
                    addChat(updatedChat);
                    setGroupChat(updatedChat);
                    console.log('✅ [GroupMemberList] Updated chat store');
                }
            } else {
                console.warn('⚠️ [GroupMemberList] No group members in API response');
            }
        } catch (error) {
            console.error('❌ [GroupMemberList] Failed to load group members:', error);
        }
    }, [currentUserId, groupId, groupChat?.name, getChatById, addChat]);

    // ✅ Reload data when screen gains focus
    useFocusEffect(
        useCallback(() => {
            console.log('🔄 [GroupMemberList] Screen focused, reloading members...');
            loadGroupMembers();
        }, [loadGroupMembers])
    );

    // Memoized members list
    const allMembers: Member[] = useMemo(() => {
        if (!groupChat) return [];
        
        const storeMembers = groupChat?.members || [];
        const storeMemberIds = groupChat?.memberIds || [];
        
        // Include current user if they are part of the chat but not explicitly in members list
        // This logic is copied from GroupSettingScreen for consistency
        if (currentUserId && !storeMemberIds.includes(currentUserId)) {
            const currentUser = useUserStore.getState().user; // Get current user from store
            if (currentUser) {
                return [
                    ...storeMembers,
                    {
                        id: currentUserId,
                        name: currentUser.name || '我',
                        avatar: currentUser.avatar || '',
                    }
                ];
            }
        }
        return storeMembers;
    }, [groupChat, currentUserId]);

    const allMemberIds = useMemo(() => allMembers.map(member => member.id), [allMembers]);

    // Permission check (copied from GroupSettingScreen for consistency)
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


    // Kick member with API call
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
                        if (!currentUserId) {
                            Alert.alert('错误', '用户未登录');
                            setKickingMemberId(null);
                            return;
                        }

                        try {
                            console.log('🔄 [GroupMemberList KickMember] Calling updateGroup API with:', {
                                chat_id: groupId,
                                user_id: currentUserId,
                                action: 'remove',
                                target_id: memberId,
                            });

                            // Call backend API
                            const result = await updateGroup({
                                chat_id: groupId,
                                user_id: currentUserId,
                                action: 'remove',
                                target_id: memberId,
                            });

                            console.log('✅ [GroupMemberList KickMember] API response:', result);

                            if (result.success) {
                                // Reload group members from API to get updated list
                                await loadGroupMembers();
                                Alert.alert('成功', `已成功将 ${memberName} 踢出群聊`);
                            } else {
                                console.error('❌ [GroupMemberList KickMember] Failed:', result.message);
                                Alert.alert('错误', result.message || '踢出成员失败，请重试');
                            }
                        } catch (error) {
                            console.error('❌ [GroupMemberList KickMember] Exception:', error);
                            Alert.alert('错误', '踢出成员失败，请重试');
                        } finally {
                            setKickingMemberId(null);
                        }
                    }
                }
            ]
        );
    }, [checkKickPermission, groupId, currentUserId, loadGroupMembers]);

    // Placeholder for add member functionality (will be fully implemented in Part 2)
    const handleAddMembers = useCallback(() => {
        navigation.navigate('AddGroupMembers', {
            chatId: groupId,
            chatName: groupChat?.name || '未知群聊', // Provide a fallback chatName
            currentMembers: allMembers,
        });
    }, [navigation, groupId, groupChat, allMembers]);

    // Render individual member item
    const renderMemberItem = ({ item: member, index }: { item: Member; index: number }) => {
        const isCurrentUser = member.id === currentUserId;
        const isKicking = kickingMemberId === member.id;
        const permission = checkKickPermission(member.id);
        const showKickBadge = permission.hasPermission && !isCurrentUser;

        return (
            <View style={styles.memberItemWrapper}>
                <TouchableOpacity
                    style={[styles.memberItem, index === allMembers.length -1 && styles.noBorderBottom]}
                    onPress={() => Alert.alert(member.name, `ID: ${member.id}\n${isCurrentUser ? '你' : ''}`)}
                    disabled={isKicking}
                >
                    <View style={styles.memberAvatarContainer}>
                        <Image
                            source={
                                !member.avatar || member.avatar.trim() === '' || member.avatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
                                    ? require('../../assets/images/personal.png')
                                    : { uri: member.avatar }
                            }
                            style={[styles.memberAvatar, isKicking && styles.memberAvatarKicking]}
                        />
                        {isKicking && (
                            <View style={styles.kickingOverlay}>
                                <ActivityIndicator size="small" color="#FF3B30" />
                            </View>
                        )}
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberId}>ID: {member.id}</Text>
                    </View>
                    {groupChat?.ownerId === member.id && <Text style={styles.ownerLabel}>群主</Text>}
                    {groupChat?.admins?.includes(member.id) && member.id !== groupChat?.ownerId && (
                        <Text style={styles.adminLabel}>管理员</Text>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={colors.text.grayLight} />
                </TouchableOpacity>
                {/* Kick button outside avatar - top left corner */}
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
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={colors.text.black} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>群成员列表</Text>
                    <View style={styles.headerRightPlaceholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.functional.yellow} />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>群成员列表</Text>
                <TouchableOpacity style={styles.headerRightButton} onPress={handleAddMembers}>
                    <Ionicons name="person-add-outline" size={24} color={colors.text.black} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={allMembers}
                renderItem={renderMemberItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListHeaderComponent={() => (
                    <View style={styles.sectionTitleContainer}>
                        <Text style={styles.sectionTitle}>全部成员 ({allMembers.length}人)</Text>
                    </View>
                )}
                ListFooterComponent={() => <View style={{ height: 20 }} />}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.chatBg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: colors.background.yellowLight,
    },
    backButton: {
        paddingRight: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
        textAlign: 'center',
        color: colors.text.black,
    },
    headerRightPlaceholder: {
        width: 24 + 10, // Icon size + padding
    },
    headerRightButton: {
        paddingLeft: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: typography.fontSize14,
        color: colors.text.grayDark,
    },
    listContentContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    sectionTitleContainer: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: typography.fontSize14,
        color: colors.text.gray,
        fontWeight: typography.fontWeight500,
    },
    memberItemWrapper: {
        position: 'relative',
        marginBottom: 8,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: colors.background.white,
        borderRadius: borders.radius12,
        paddingHorizontal: 15,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.border.light,
    },
    noBorderBottom: {
        borderBottomWidth: 0,
    },
    memberAvatarContainer: {
        position: 'relative',
        marginRight: 12,
        width: 48,
        height: 48,
        borderRadius: borders.radius8,
        overflow: 'hidden',
        backgroundColor: colors.background.grayLight,
    },
    memberAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: borders.radius8,
    },
    memberAvatarKicking: {
        opacity: 0.5
    },
    kickingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: borders.radius8,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    kickButton: {
        position: 'absolute',
        top: 6,
        left: 6,
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
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: typography.fontSize16,
        fontWeight: typography.fontWeight500,
        color: colors.text.dark,
    },
    memberId: {
        fontSize: typography.fontSize12,
        color: colors.text.gray,
    },
    ownerLabel: {
        fontSize: typography.fontSize11,
        color: colors.functional.yellow,
        backgroundColor: colors.background.yellowPale,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borders.radius4,
        marginLeft: 8,
    },
    adminLabel: {
        fontSize: typography.fontSize11,
        color: colors.functional.green,
        backgroundColor: colors.functional.greenLight, // Corrected from background.greenLight
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borders.radius4,
        marginLeft: 8,
    },
});
