import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigation';
import { useEffect } from 'react';
import { useUserStore } from './src/store/userStore';
import WebSocketManager from './src/services/WebSocketManager';
import { View, LogBox } from 'react-native';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  const { user, token, isLoggedIn } = useUserStore();

  useEffect(() => {
    LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);
  }, []);

  useEffect(() => {
    if (isLoggedIn && user && token) {
      console.log('App.tsx: User is logged in, connecting WebSocket');
      WebSocketManager.connect(user.id);
    } else {
      console.log('App.tsx: User is not logged in, disconnecting WebSocket');
      WebSocketManager.disconnect();
    }
  }, [isLoggedIn, user, token]);

  // ✅ 全局信令监听
  useEffect(() => {
    const handleIncomingCallSignal = (data: any) => {
      if (!user || data.sender === user.id) return;
      if (!navigationRef.isReady()) return;

      const signalPayload = data.payload || {};
      const callMode = signalPayload.call_mode || 'single';
      if (callMode === 'group') return;

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