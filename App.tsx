import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigation';
import React, { useEffect } from 'react'; // Import React for useEffect
import { useUserStore } from './src/store/userStore';
import WebSocketManager from './src/services/WebSocketManager';
import { View, LogBox, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from './src/utils/pushNotification'; // Import the new utility
import { updatePushToken } from './src/api/Auth'; // Import the API call

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  const { user, token, isLoggedIn } = useUserStore();

  useEffect(() => {
    LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);
  }, []);

  useEffect(() => {
    if (isLoggedIn && user && user.id && token) { // Ensure user and user.id exist
      console.log('App.tsx: User is logged in, connecting WebSocket');
      WebSocketManager.connect(user.id);

      const registerAndUploadToken = () => {
        registerForPushNotificationsAsync(user.id).then(expoPushToken => {
          if (expoPushToken) {
            console.log('App.tsx: Expo Push Token obtained:', expoPushToken);
            updatePushToken(user.id, expoPushToken)
              .then(res => {
                if (res.error) {
                  console.error('App.tsx: Failed to update push token on backend:', res.message);
                } else {
                  console.log('App.tsx: Push token updated on backend successfully.');
                }
              })
              .catch(err => {
                console.error('App.tsx: Error sending push token to backend:', err);
              });
          } else {
            console.log('App.tsx: Could not obtain Expo Push Token.');
          }
        }).catch(err => {
          console.error('App.tsx: Error during push notification registration:', err);
        });
      };

      const handlePushNotifications = async () => {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          Alert.alert(
            'Enable Push Notifications',
            'Would you like to receive notifications for new messages and calls?',
            [
              {
                text: 'Ask Me Later',
                onPress: () => console.log('User deferred push notification permission.'),
                style: 'cancel',
              },
              {
                text: 'Enable',
                onPress: async () => {
                  const { status } = await Notifications.requestPermissionsAsync();
                  if (status === 'granted') {
                    registerAndUploadToken();
                  }
                },
              },
            ],
            { cancelable: false }
          );
        } else {
          registerAndUploadToken();
        }
      };

      handlePushNotifications();

    } else {
      console.log('App.tsx: User is not logged in or user ID/token missing, disconnecting WebSocket');
      WebSocketManager.disconnect();
    }
  }, [isLoggedIn, user?.id,, token]);


  // ✅ 全局信令监听
  useEffect(() => {
    const handleIncomingCallSignal = (data: any) => {
      if (!user || data.sender === user.id) return;
      if (!navigationRef.isReady()) return;

      const signalPayload = data.payload || {};
      const callMode = signalPayload.call_mode || data.call_mode;

      // =====================================================
      // 群聊通话：处理 JOIN_CALL 信令 - 弹窗提示，不自动跳转
      // =====================================================
      if (callMode === 'group' || data.type === 'JOIN_CALL') {
        if (data.type === 'JOIN_CALL') {
          const callerName = signalPayload.userName || '未知用户';
          const chatId = data.chat_id;
          const callId = signalPayload.call_id || data.call_id;

          console.log(`📞 App: 收到群聊通话邀请 from ${callerName}, chatId: ${chatId}, callId: ${callId}`);

          // ✅ 检查当前是否已在 GroupCallScreen 中
          // 如果已经在通话界面，不弹窗（让 GroupCallScreen 内部处理）
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute?.name === 'GroupCallScreen') {
            console.log('[App] 已在 GroupCallScreen 中，跳过弹窗');
            return;
          }

          // ✅ 检查 chatId 是否有效
          if (!chatId) {
            console.log('[App] chatId 无效，跳过弹窗');
            return;
          }

          // 弹窗提示用户是否加入通话
          Alert.alert(
            '群聊语音通话',
            `${callerName} 发起了群聊语音通话，是否加入？`,
            [
              {
                text: '忽略',
                style: 'cancel',
                onPress: () => console.log('[App] 用户忽略群聊通话邀请'),
              },
              {
                text: '加入',
                onPress: () => {
                  console.log('[App] 用户选择加入群聊通话');
                  navigationRef.navigate('GroupCallScreen', {
                    chatId: chatId,
                    isHost: false,  // 被叫方不是主持人
                    callId: callId,
                  });
                },
              },
            ],
            { cancelable: true }
          );
        }
        return;
      }

      // =====================================================
      // 单聊通话：处理 offer 信令
      // =====================================================
      if (data.type === 'offer') {
        const callerName = signalPayload.userName || '未知用户';
        const callerAvatar = signalPayload.avatar || '';
        const callerId = data.sender || data.user_id;

        console.log(`📞 App: 收到单聊呼叫: ${callerName}`);

        navigationRef.navigate('SingleCallScreen', {
          callerId,
          chatId: data.chat_id,
          isIncoming: true,
          callerName,
          callerAvatar,
        });
      }
    };

    WebSocketManager.addCallCallback(handleIncomingCallSignal);
    return () => {
      WebSocketManager.removeCallCallback(handleIncomingCallSignal);
    };
  }, [user, isLoggedIn]);

  // Global presence subscriber
  useEffect(() => {
    if (!isLoggedIn) return;

    const { updateUserOnlineStatus } = useUserStore.getState();

    const handlePresenceChange = (data: { userId: string; isOnline: boolean }) => {
      console.log(`[App.tsx] Presence Change: ${data.userId} is ${data.isOnline ? 'Online' : 'Offline'}`);
      updateUserOnlineStatus(data.userId, data.isOnline);
    };

    WebSocketManager.addPresenceCallback(handlePresenceChange);

    return () => {
      WebSocketManager.removePresenceCallback(handlePresenceChange);
    };
  }, [isLoggedIn]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}