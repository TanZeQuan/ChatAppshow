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

export default function GroupSettingScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const params = route.params as RouteParams;
    const { chatId } = params;

    const { removeChat, getChatById, addChat } = useChatStore();
    const currentUserId = useUserStore((state) => state.user?.id) || 'me';
    
    // Get real-time data from store instead of route params
    const groupChat = getChatById(chatId);
    const chatName = groupChat?.name || params.chatName || '';
    const members = groupChat?.members || [];
    const memberIds = groupChat?.memberIds || [];

    const [muteNotifications, setMuteNotifications] = useState(false);
    const [pinToTop, setPinToTop] = useState(false);
    const [showOnTop, setShowOnTop] = useState(false);
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState(chatName);
    const [refreshing, setRefreshing] = useState(false);
    
    // Update newGroupName when chatName changes
    React.useEffect(() => {
        setNewGroupName(chatName);
    }, [chatName]);

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

    const handleLeaveGroup = () => {
        Alert.alert(
            '退出群聊',
            `确定要退出群聊 "${chatName}" 吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '退出',
                    style: 'destructive',
                    onPress: () => {
                        removeChat(chatId);
                        Alert.alert('成功', '已退出群聊', [
                            {
                                text: '确定',
                                onPress: () => {
                                    // Navigate back to ChatList in the ChatStack
                                    navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'ChatList' }],
                                    });
                                },
                            },
                        ]);
                    },
                },
            ]
        );
    };

    const handleDismissGroup = () => {
        Alert.alert(
            '解散群聊',
            `确定要解散群聊 "${chatName}" 吗？此操作无法撤销。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '解散',
                    style: 'destructive',
                    onPress: () => {
                        removeChat(chatId);
                        Alert.alert('成功', '群聊已解散', [
                            {
                                text: '确定',
                                onPress: () => {
                                    // Navigate back to ChatList in the ChatStack
                                    navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'ChatList' }],
                                    });
                                },
                            },
                        ]);
                    },
                },
            ]
        );
    };

    const handleUpdateGroupName = () => {
        if (!newGroupName.trim()) {
            Alert.alert('错误', '群聊名称不能为空');
            return;
        }

        // Update group chat name
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

    const handleAddMembers = () => {
        Alert.alert('添加成员', '此功能即将推出');
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        Alert.alert(
            '移除成员',
            `确定要将 ${memberName} 移出群聊吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '移除',
                    style: 'destructive',
                    onPress: () => {
                        // Update group chat members
                        if (groupChat) {
                            const updatedMembers = members.filter(m => m.id !== memberId);
                            const updatedMemberIds = memberIds.filter(id => id !== memberId);

                            const updatedChat = {
                                ...groupChat,
                                members: updatedMembers,
                                memberIds: updatedMemberIds,
                            };
                            addChat(updatedChat);
                        }
                        Alert.alert('成功', '已移除成员');
                    },
                },
            ]
        );
    };

    const renderMemberItem = (member: any, index: number) => (
        <TouchableOpacity
            key={member.id}
            style={styles.memberItem}
            onPress={() => {
                if (member.id !== currentUserId) {
                    Alert.alert(
                        member.name,
                        '选择操作',
                        [
                            { text: '取消', style: 'cancel' },
                            {
                                text: '移除成员',
                                style: 'destructive',
                                onPress: () => handleRemoveMember(member.id, member.name),
                            },
                        ]
                    );
                }
            }}
        >
            <Image
                source={{ uri: member.avatar || `https://i.pravatar.cc/150?img=${index}` }}
                style={styles.memberAvatar}
            />
            <Text style={styles.memberName} numberOfLines={1}>
                {member.name}
                {member.id === currentUserId && ' (我)'}
            </Text>
        </TouchableOpacity>
    );

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
                                {members.slice(0, 4).map((member, index) => (
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
                            <Text style={styles.groupMemberCount}>{members.length} 位成员</Text>
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
                    <Text style={styles.sectionTitle}>群成员</Text>
                    <View style={styles.membersGrid}>
                        {members.map((member, index) => renderMemberItem(member, index))}
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
                            onValueChange={setMuteNotifications}
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
                            onValueChange={setPinToTop}
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
                            onValueChange={setShowOnTop}
                            trackColor={{ false: '#E0E0E0', true: '#FFD700' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="search-outline" size={22} color="#333" />
                            <Text style={styles.settingLabel}>查找聊天记录</Text>
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

                    <TouchableOpacity
                        style={[styles.dangerButton, styles.dismissButton]}
                        onPress={handleDismissGroup}
                    >
                        <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                        <Text style={styles.dangerButtonText}>解散群聊</Text>
                    </TouchableOpacity>
                </View>
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
    scrollView: {
        flex: 1,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginTop: 12,
        paddingVertical: 16,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        paddingHorizontal: scaleWidth(16),
        marginBottom: 12,
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
    memberAvatar: {
        width: scaleWidth(50),
        height: scaleWidth(50),
        borderRadius: 8,
        backgroundColor: '#E0E0E0',
        marginBottom: 6,
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
    memberName: {
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
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