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
import { readChatMessages, updateGroup, changeGroupMemberPermission } from '../../api/Chat';
import { readFriends, createFriendRequest } from '../../api/Friend';
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
}

export default function GroupMemberList() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { groupId } = route.params;

    const { getChatById, addChat } = useChatStore();
    const currentUserId = useUserStore((state) => state.user?.id);
    const { onlineUsers } = useUserStore();

    const [groupChat, setGroupChat] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
    
    // ✅ 新增：好友列表和添加好友状态
    const [friendIds, setFriendIds] = useState<string[]>([]);
    const [friendsLoaded, setFriendsLoaded] = useState(false);  // 追踪好友列表是否加载完成
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

    useEffect(() => {
        const chat = getChatById(groupId);
        if (chat) {
            setGroupChat(chat);
        }
        setIsLoading(false);
    }, [groupId, getChatById]);

    // ✅ 新增：加载好友列表
    const loadFriendList = useCallback(async () => {
        try {
            const result = await readFriends(2); // isstatus = 2 表示已接受的好友
            if (result.success && result.data) {
                const allFriends = [
                    ...(result.data.request || []),
                    ...(result.data.approve || [])
                ];
                const ids = allFriends.map((f: any) => f.user_id);
                setFriendIds(ids);
                console.log('📋 [GroupMemberList] 好友列表:', ids);
            }
        } catch (error) {
            console.error('❌ [GroupMemberList] 加载好友列表失败:', error);
        } finally {
            setFriendsLoaded(true);  // 无论成功失败都标记为已加载
        }
    }, []);

    // ✅ 新增：添加好友的处理函数
    const handleAddFriend = useCallback(async (memberId: string, memberName: string) => {
        if (memberId === currentUserId) {
            Alert.alert('提示', '不能添加自己为好友');
            return;
        }

        setAddingFriendId(memberId);

        try {
            console.log('📤 [GroupMemberList] 发送好友请求给:', memberId);
            
            const result = await createFriendRequest(memberId, `来自群聊"${groupChat?.name || '未知群聊'}"的好友请求`);

            if (result.success) {
                Alert.alert('成功', `已向 ${memberName} 发送好友请求`);
            } else {
                const errorMessage = result.message || '';
                if (errorMessage.includes('已发送') || errorMessage.includes('already') || errorMessage.includes('pending')) {
                    Alert.alert('提示', '好友请求已发送，请等待对方确认');
                } else if (errorMessage.includes('已是好友') || errorMessage.includes('already friends')) {
                    // 刷新好友列表
                    await loadFriendList();
                    Alert.alert('提示', '你们已经是好友了');
                } else {
                    Alert.alert('发送失败', result.message || '请稍后重试');
                }
            }
        } catch (error: any) {
            console.error('❌ [GroupMemberList] 发送好友请求失败:', error);
            Alert.alert('发送失败', '网络错误，请稍后重试');
        } finally {
            setAddingFriendId(null);
        }
    }, [currentUserId, groupChat?.name, loadFriendList]);

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
                    const memberAvatar = member.image || '';
                    const fullAvatarUrl = ensureFullImageUrl(memberAvatar);

                    return {
                        id: member.user_id,
                        name: member.name || '未知',
                        avatar: fullAvatarUrl,
                    };
                });

                // Extract admin IDs (isadmin === 2 means admin in backend)
                // 支持字符串或数字类型的 isadmin
                const adminMembers = groupMembers.filter((m: any) => m.isadmin === 2 || m.isadmin === '2');
                const adminIds = adminMembers.map((m: any) => m.user_id);

                // Get group info
                const groupInfo = result.data.info || {};
                const groupName = groupInfo.name || groupChat?.name || '未知群聊';
                const groupImageUrl = groupInfo.image || '';
                const fullGroupImageUrl = ensureFullImageUrl(groupImageUrl);

                console.log('✅ [GroupMemberList] Processed member info:', {
                    total: membersInfo.length,
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
                        adminIds: adminIds,  // 支持多管理员
                    };
                    addChat(updatedChat);
                    setGroupChat(updatedChat);
                    console.log('✅ [GroupMemberList] Updated chat store with adminIds:', adminIds);
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
            loadFriendList(); // ✅ 同时加载好友列表
        }, [loadGroupMembers, loadFriendList])
    );

    // Memoized members list with sorting: 我 > 管理员 > ABC排序的普通成员
    const allMembers: Member[] = useMemo(() => {
        if (!groupChat) return [];
        
        let members = [...(groupChat?.members || [])];
        const storeMemberIds = groupChat?.memberIds || [];
        const adminIds = groupChat?.adminIds || [];
        
        // Include current user if they are part of the chat but not explicitly in members list
        if (currentUserId && !storeMemberIds.includes(currentUserId)) {
            const currentUser = useUserStore.getState().user;
            if (currentUser) {
                members.push({
                    id: currentUserId,
                    name: currentUser.name || '我',
                    avatar: currentUser.avatar || '',
                });
            }
        }
        
        // Sort members: 我 > 管理员 > ABC排序的普通成员
        members.sort((a, b) => {
            const aIsCurrentUser = a.id === currentUserId;
            const bIsCurrentUser = b.id === currentUserId;
            const aIsAdmin = adminIds.includes(a.id);
            const bIsAdmin = adminIds.includes(b.id);
            
            // 1. 当前用户（我）排在最前面
            if (aIsCurrentUser && !bIsCurrentUser) return -1;
            if (!aIsCurrentUser && bIsCurrentUser) return 1;
            
            // 2. 管理员排在普通成员前面
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            
            // 3. 同级别按名字 ABC 排序（不区分大小写）
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'zh-CN');
        });
        
        return members;
    }, [groupChat, currentUserId]);

    const allMemberIds = useMemo(() => allMembers.map(member => member.id), [allMembers]);

    // Permission check - 只有管理员可以踢人
    const checkKickPermission = useCallback((targetMemberId: string) => {
        const adminIds = groupChat?.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);
        
        if (isAdmin) {
            if (targetMemberId === currentUserId) {
                return { hasPermission: false, message: '管理员不能踢出自己' };
            }
            // 管理员不能踢其他管理员
            if (adminIds.includes(targetMemberId)) {
                return { hasPermission: false, message: '不能踢出其他管理员' };
            }
            return { hasPermission: true, message: '' };
        }
        
        return { hasPermission: false, message: '只有管理员可以踢人' };
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
                        try {
                            if (!currentUserId) {
                                Alert.alert('错误', '用户ID未获取，请重新登录');
                                return;
                            }

                            console.log('🔄 [GroupMemberList KickMember] Calling updateGroup API with:', {
                                chat_id: groupId,
                                user_id: currentUserId,
                                action: 'remove',
                                target_id: memberId,
                                memberId_type: typeof memberId,
                                memberId_length: memberId?.length,
                            });

                            // ✅ Validate memberId before calling API
                            if (!memberId || memberId.trim() === '') {
                                console.error('❌ [GroupMemberList KickMember] memberId is empty!');
                                Alert.alert('错误', '无法获取成员ID，请重试');
                                return;
                            }

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

    // ✅ 设为管理员的处理函数
    const handleSetAdmin = useCallback(async (memberId: string, memberName: string) => {
        // 只有管理员可以设置其他管理员
        const adminIds = groupChat?.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);
        if (!isAdmin) {
            Alert.alert('权限不足', '只有管理员才能设置其他管理员');
            return;
        }

        // 不能设置自己
        if (memberId === currentUserId) {
            Alert.alert('提示', '你已经是管理员了');
            return;
        }

        // 检查目标是否已经是管理员
        if (adminIds.includes(memberId)) {
            Alert.alert('提示', `${memberName} 已经是管理员了`);
            return;
        }

        Alert.alert(
            '设为管理员',
            `确定要将 ${memberName} 设为管理员吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确定',
                    onPress: async () => {
                        try {
                            console.log('🔄 [GroupMemberList] 设为管理员:', {
                                chat_id: groupId,
                                admin_id: currentUserId,
                                target_id: memberId,
                            });

                            // 调用 API 将目标成员设为管理员 (permission: 2)
                            const result = await changeGroupMemberPermission(
                                groupId,
                                currentUserId!,
                                memberId,
                                2  // 2 = 管理员
                            );

                            if (result.success) {
                                // 重新加载群成员列表
                                await loadGroupMembers();
                                Alert.alert('成功', `已将 ${memberName} 设为管理员`);
                            } else {
                                console.error('❌ [GroupMemberList] 设为管理员失败:', result.message);
                                Alert.alert('错误', result.message || '设为管理员失败，请重试');
                            }
                        } catch (error: any) {
                            console.error('❌ [GroupMemberList] 设为管理员异常:', error);
                            Alert.alert('错误', '设为管理员失败，请重试');
                        }
                    }
                }
            ]
        );
    }, [groupChat, currentUserId, groupId, loadGroupMembers]);

    // ✅ 取消管理员的处理函数
    const handleRemoveAdmin = useCallback(async (memberId: string, memberName: string) => {
        // 只有管理员可以取消其他管理员
        const adminIds = groupChat?.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);
        if (!isAdmin) {
            Alert.alert('权限不足', '只有管理员才能取消其他管理员');
            return;
        }

        // 不能取消自己的管理员身份
        if (memberId === currentUserId) {
            Alert.alert('提示', '不能取消自己的管理员身份');
            return;
        }

        // 检查目标是否是管理员
        if (!adminIds.includes(memberId)) {
            Alert.alert('提示', `${memberName} 不是管理员`);
            return;
        }

        Alert.alert(
            '取消管理员',
            `确定要取消 ${memberName} 的管理员身份吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确定',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            console.log('🔄 [GroupMemberList] 取消管理员:', {
                                chat_id: groupId,
                                admin_id: currentUserId,
                                target_id: memberId,
                            });

                            // 调用 API 将目标成员设为普通成员 (permission: 1)
                            const result = await changeGroupMemberPermission(
                                groupId,
                                currentUserId!,
                                memberId,
                                1  // 1 = 普通成员
                            );

                            if (result.success) {
                                // 重新加载群成员列表
                                await loadGroupMembers();
                                Alert.alert('成功', `已取消 ${memberName} 的管理员身份`);
                            } else {
                                console.error('❌ [GroupMemberList] 取消管理员失败:', result.message);
                                Alert.alert('错误', result.message || '取消管理员失败，请重试');
                            }
                        } catch (error: any) {
                            console.error('❌ [GroupMemberList] 取消管理员异常:', error);
                            Alert.alert('错误', '取消管理员失败，请重试');
                        }
                    }
                }
            ]
        );
    }, [groupChat, currentUserId, groupId, loadGroupMembers]);

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
        const isOnline = onlineUsers.includes(member.id);
        
        // ✅ 新增：判断是否是好友
        const isFriend = friendIds.includes(member.id);
        const isAddingThisFriend = addingFriendId === member.id;
        // 只有好友列表加载完成后才显示添加按钮，避免闪现
        const showAddFriendButton = friendsLoaded && !isCurrentUser && !isFriend;
        
        // ✅ 判断管理员身份
        const adminIds = groupChat?.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);  // 当前用户是否是管理员
        const isTargetAdmin = adminIds.includes(member.id);  // 目标成员是否是管理员

        return (
            <View style={styles.memberItemWrapper}>
                <TouchableOpacity
                    style={[styles.memberItem, index === allMembers.length -1 && styles.noBorderBottom]}
                    onPress={() => {
                        // 构建 Alert 选项
                        const options: any[] = [{ text: '取消', style: 'cancel' }];
                        
                        // 只有管理员可以管理权限，且不能管理自己
                        if (isAdmin && !isCurrentUser) {
                            if (isTargetAdmin) {
                                // 目标是管理员，显示"取消管理员"选项
                                options.push({
                                    text: '取消管理员',
                                    style: 'destructive',
                                    onPress: () => handleRemoveAdmin(member.id, member.name),
                                });
                            } else {
                                // 目标是普通成员，显示"设为管理员"选项
                                options.push({
                                    text: '设为管理员',
                                    onPress: () => handleSetAdmin(member.id, member.name),
                                });
                            }
                        }
                        
                        // 构建副标题
                        let subtitle = `ID: ${member.id}`;
                        if (isCurrentUser) {
                            subtitle += '\n（你）';
                        }
                        if (isTargetAdmin) {
                            subtitle += '\n管理员';
                        }
                        
                        Alert.alert(member.name, subtitle, options);
                    }}
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
                        {isOnline && !isCurrentUser && <View style={styles.onlineIndicator} />}
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
                    
                    {/* 标签容器 - 垂直排列：管理员在上，好友在下 */}
                    <View style={styles.labelsContainer}>
                        {/* 管理员标签 */}
                        {isTargetAdmin && <Text style={styles.adminLabel}>管理员</Text>}
                        
                        {/* 好友相关的标签/按钮 - 所有成员都显示 */}
                        {!isCurrentUser && (
                            <>
                                {/* 加载中显示 Loading */}
                                {!friendsLoaded && (
                                    <ActivityIndicator size="small" color="#FFD860" />
                                )}
                                
                                {/* 加载完成后显示好友状态 */}
                                {friendsLoaded && (
                                    <>
                                        {/* 已是好友标签 */}
                                        {isFriend && (
                                            <View style={styles.friendLabel}>
                                                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                                <Text style={styles.friendLabelText}>好友</Text>
                                            </View>
                                        )}
                                        
                                        {/* 添加好友按钮 - 非好友才显示 */}
                                        {!isFriend && (
                                            <TouchableOpacity
                                                style={styles.addFriendButton}
                                                onPress={() => handleAddFriend(member.id, member.name)}
                                                disabled={isAddingThisFriend}
                                                activeOpacity={0.7}
                                            >
                                                {isAddingThisFriend ? (
                                                    <ActivityIndicator size="small" color="#FFD860" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="person-add-outline" size={14} color="#FFD860" />
                                                        <Text style={styles.addFriendText}>添加</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </View>
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
                extraData={onlineUsers}
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
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.functional.green,
        borderWidth: 2,
        borderColor: colors.background.white,
        zIndex: 2,
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
    labelsContainer: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginLeft: 'auto',
        marginRight: 8,
        gap: 4,
    },
    adminLabel: {
        fontSize: typography.fontSize11,
        color: colors.functional.yellow,
        backgroundColor: colors.background.yellowPale,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borders.radius4,
    },
    // ✅ 添加好友按钮样式 - 与其他标签统一大小
    addFriendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 216, 96, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borders.radius4,
        borderWidth: 1,
        borderColor: '#FFD860',
    },
    addFriendText: {
        fontSize: typography.fontSize11,
        color: '#E5A800',
        fontWeight: '500' as const,
        marginLeft: 3,
    },
    // ✅ 好友标签样式 - 与其他标签统一大小
    friendLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borders.radius4,
    },
    friendLabelText: {
        fontSize: typography.fontSize11,
        color: '#4CAF50',
        fontWeight: '500' as const,
        marginLeft: 3,
    },
});