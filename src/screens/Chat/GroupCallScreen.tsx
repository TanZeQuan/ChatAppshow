import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';

import { readUsers } from '../../api/User';
import WebSocketManager from '../../services/WebSocketManager';
import { useUserStore } from '../../store/userStore'; // 假设你有这个 store
import { useContactStore } from '../../store/contactStore';
import { sendChatMessage } from '@/src/api/Chat';

const { width } = Dimensions.get('window');

interface CallParticipant {
    userId: string;
    userName: string;
    avatar: string;
    stream?: MediaStream | null;
}

export default function GroupCallScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { chatId, isHost } = route.params || {};

    // 获取当前用户信息
    const currentUser = useUserStore(state => state.user);
    const currentUserId = currentUser?.id || 'me';
    const getContactById = useContactStore(state => state.getContactById);

    const [participants, setParticipants] = useState<CallParticipant[]>([]);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // 1. 获取本地流 & 初始化自己
    const startLocalStream = useCallback(async () => {
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'user',
                    width: 640,
                    height: 480,
                    frameRate: 30,
                }
            });

            setLocalStream(stream);

            // 把自己加到列表第一个
            setParticipants([{
                userId: currentUserId,
                userName: currentUser?.name || '我',
                avatar: currentUser?.avatar || '',
                stream: stream
            }]);

            // 告诉大家“我来了”
            WebSocketManager.sendCallSignal({
                type: 'JOIN_CALL',
                chat_id: chatId,
                sender: currentUserId
            });

        } catch (err) {
            console.error('Failed to get local stream', err);
            Alert.alert('错误', '无法获取摄像头或麦克风权限');
        }
    }, [chatId, currentUserId, currentUser]);

    // 2. 添加/更新参与者逻辑
    const fetchAndAddParticipant = useCallback(async (userId: string, stream?: any) => {
        if (userId === currentUserId) return; // 忽略自己

        let name = userId;
        let avatar = '';

        const localContact = getContactById(userId);
        if (localContact) {
            name = localContact.name || userId;
            avatar = localContact.avatar || '';
        } else {
            try {
                const result = await readUsers(userId);
                if (result.success && result.data) {
                    const userData = result.data.response || result.data;
                    name = userData.name || userData.username || userId;
                    avatar = userData.image || userData.avatar || '';
                }
            } catch (e) {
                console.error('Fetch user error', e);
            }
        }

        setParticipants(prev => {
            const exists = prev.some(p => p.userId === userId);
            if (exists) {
                return prev.map(p => p.userId === userId ? { ...p, stream: stream || p.stream } : p);
            }
            return [...prev, { userId, userName: name, avatar, stream }];
        });
    }, [getContactById, currentUserId]);

    // 3. 页面加载：启动流 & 监听 WebSocket
    useEffect(() => {
        console.log('🚀 GroupCallScreen Mounted');
        startLocalStream();

        // 监听信令回调
        const handleCallSignal = (data: any) => {
            if (data.chat_id !== chatId || data.sender === currentUserId) return;

            console.log('📡 Signal received:', data.type, 'from', data.sender);

            switch (data.type) {
                case 'JOIN_CALL':
                    // 有人加入，先加个头像占位，后续 P2P 会给流
                    fetchAndAddParticipant(data.sender);
                    break;
                case 'LEAVE_CALL':
                    setParticipants(prev => prev.filter(p => p.userId !== data.sender));
                    break;
                // 其他 WebRTC 握手逻辑 (Offer/Answer) 在 WebSocketManager 内部处理流的绑定
                // 如果你的 Manager 处理完流会 emit 事件，这里监听该事件：
            }
        };

        // 假设你修改了 WebSocketManager 增加了 addCallCallback
        WebSocketManager.addCallCallback(handleCallSignal);

        // 还要监听流连接成功的事件 (如果你用 Emitter 传递流)
        /* const onParticipantJoined = ({ userId, stream }) => {
           fetchAndAddParticipant(userId, stream);
        };
        Emitter.on('participantJoined', onParticipantJoined); 
        */

        return () => {
            console.log('🛑 GroupCallScreen Unmounting');
            WebSocketManager.removeCallCallback(handleCallSignal);
            // Emitter.off(...)

            // 离开时清理
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            WebSocketManager.sendCallSignal({
                type: 'LEAVE_CALL',
                chat_id: chatId,
                sender: currentUserId
            });
        };
    }, []); // 只执行一次

    const hangup = async () => {
        // 1. 如果你是发起人 (Host)，你需要告诉聊天室：通话结束了
        if (isHost) {
            const endCallData = JSON.stringify({
                type: 'GROUP_VIDEO_CALL',
                roomId: chatId,
                hostName: currentUser?.name,
                status: 'ended', // 🔑 关键字段
                duration: '12:30', // 这里可以计算实际时长
                startTime: new Date().toISOString() // 保持时间戳以便排序
            });

            // 🔴 方案 A: 如果后端支持编辑消息 (Update Message)
            // await updateChatMessage(originalMessageId, endCallData);

            // 🟢 方案 B: (推荐) 发送一条新的消息，显示为“通话已结束”
            // 注意：这会在聊天记录里加一条新的。要做到像微信那样原地变化，必须后端支持 Update。
            await sendChatMessage({
                sender: currentUserId,
                isreceive: [], // 群发
                chat_id: chatId,
                message: endCallData,
                type: 4 // 保持类型为 4
            });
        }

        // 2. 发送 WebSocket 信令断开 P2P
        WebSocketManager.sendCallSignal({
            type: 'LEAVE_CALL',
            chat_id: chatId,
            sender: currentUserId
        });

        // 3. 退出页面
        navigation.goBack();
    };

    const renderParticipant = ({ item }: { item: CallParticipant }) => (
        <View style={styles.gridItem}>
            {item.stream ? (
                <RTCView
                    streamURL={item.stream.toURL()}
                    style={styles.videoView}
                    objectFit="cover"
                    zOrder={item.userId === currentUserId ? 1 : 0} // 自己稍微浮起一点或者不需要
                    mirror={item.userId === currentUserId}
                />
            ) : (
                <View style={styles.avatarContainer}>
                    {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.avatarText}>{item.userName?.charAt(0).toUpperCase()}</Text>
                    )}
                </View>
            )}
            <View style={styles.nameTag}>
                <Text style={styles.nameText}>
                    {item.userId === currentUserId ? '我' : item.userName}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>群聊通话 ({participants.length}人)</Text>
            </View>

            <FlatList
                data={participants}
                renderItem={renderParticipant}
                keyExtractor={item => item.userId}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.hangupButton} onPress={hangup}>
                    <Text style={styles.buttonIcon}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.footerText}>挂断</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2C2C2C' // 深色背景，确保不白屏
    },
    header: {
        padding: 20,
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    gridContainer: {
        padding: 10,
    },
    gridItem: {
        flex: 1,
        margin: 5,
        height: 200,
        backgroundColor: '#333',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    videoView: {
        width: '100%',
        height: '100%',
    },
    avatarContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#444',
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    avatarText: {
        color: '#fff',
        fontSize: 30,
    },
    nameTag: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    nameText: {
        color: 'white',
        fontSize: 12,
    },
    footer: {
        padding: 30,
        alignItems: 'center',
    },
    hangupButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    buttonIcon: {
        color: 'white',
        fontSize: 28,
    },
    footerText: {
        color: 'white',
        fontSize: 14,
    },
});