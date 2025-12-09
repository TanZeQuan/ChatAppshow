import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borders, typography } from '../../styles';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';

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

    const [groupChat, setGroupChat] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const chat = getChatById(groupId);
        if (chat) {
            setGroupChat(chat);
        }
        setIsLoading(false);
    }, [groupId, getChatById]);

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
                        avatar: currentUser.avatar || `https://i.pravatar.cc/150?u=${currentUserId}`,
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


    // Placeholder for kick member functionality (will be fully implemented in Part 2)
    const handleKickMember = useCallback(async (memberId: string, memberName: string) => {
        const permission = checkKickPermission(memberId);
        if (!permission.hasPermission) {
            Alert.alert('权限不足', permission.message);
            return;
        }

        Alert.alert(
            '踢出成员',
            `确定要将 ${memberName} 踢出群聊吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '踢出',
                    style: 'destructive',
                    onPress: () => {
                        if (groupChat) {
                            const updatedMembers = groupChat.members.filter((m: Member) => m.id !== memberId);
                            const updatedMemberIds = groupChat.memberIds.filter((id: string) => id !== memberId);
                            const updatedChat = {
                                ...groupChat,
                                members: updatedMembers,
                                memberIds: updatedMemberIds,
                            };
                            addChat(updatedChat); // Update store
                            setGroupChat(updatedChat); // Update local state
                            Alert.alert('成功', `已成功将 ${memberName} 踢出群聊`);
                        }
                    }
                }
            ]
        );
    }, [groupChat, addChat, checkKickPermission]);

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
        const permission = checkKickPermission(member.id);
        const showKickOption = permission.hasPermission && !isCurrentUser;

        return (
            <TouchableOpacity
                style={[styles.memberItem, index === allMembers.length -1 && !showKickOption && styles.noBorderBottom]} // Add noBorderBottom for last item unless it's the kick option
                onPress={() => Alert.alert(member.name, `ID: ${member.id}\n${isCurrentUser ? '你' : ''}`)}
                onLongPress={() => {
                    if (showKickOption) {
                        Alert.alert(
                            '成员操作',
                            `对 ${member.name} 进行操作`,
                            [
                                { text: '取消', style: 'cancel' },
                                {
                                    text: '踢出群聊',
                                    style: 'destructive',
                                    onPress: () => handleKickMember(member.id, member.name),
                                },
                            ]
                        );
                    } else {
                        Alert.alert(member.name, `ID: ${member.id}\n${isCurrentUser ? '你' : ''}`);
                    }
                }}
            >
                <Image
                    source={{ uri: member.avatar || `https://i.pravatar.cc/150?u=${member.id}` }}
                    style={styles.memberAvatar}
                />
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
        fontSize: typography.fontSize18,
        fontWeight: typography.fontWeight600,
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
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: colors.background.white,
        borderRadius: borders.radius12,
        marginBottom: 8,
        paddingHorizontal: 15,
        borderBottomWidth: borders.width1,
        borderBottomColor: colors.border.light,
    },
    noBorderBottom: {
        borderBottomWidth: 0,
    },
    memberAvatar: {
        width: 48,
        height: 48,
        borderRadius: borders.radius8,
        marginRight: 12,
        backgroundColor: colors.functional.avatarBg,
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
