// App.tsx
import React, { useEffect, useCallback } from 'react';
import { View, LogBox, Alert, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import RootNavigator from './src/navigation/RootNavigation';
import { useUserStore } from './src/store/userStore';
import WebSocketManager from './src/services/WebSocketManager';
import { registerForPushNotificationsAsync } from './src/utils/pushNotification';
import { updatePushToken } from './src/api/Auth';

export const navigationRef = createNavigationContainerRef<any>();

/**
 * ✅ MUST: Global notification handler
 * Without this, notifications may NOT show while app is in foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const { user, token, isLoggedIn } = useUserStore();

  // Ignore known warnings
  useEffect(() => {
    LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);
  }, []);

  useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener((notification) => {
      console.log('✅ [Foreground] Notification received:', JSON.stringify(notification, null, 2));
      // 你也可以临时用 Alert 强制显示，证明“确实收到了”
      // Alert.alert(notification.request.content.title ?? 'No title', notification.request.content.body ?? 'No body');
    });

    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('✅ [Tap] Notification response:', JSON.stringify(response, null, 2));
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);


  /**
   * ✅ MUST: Android notification channel
   * Without a channel (or with low importance), Android may deliver silently or not show heads-up.
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }).catch(err => console.error('[Notifications] setNotificationChannelAsync error:', err));
    }
  }, []);

  /**
   * Register push permission + token, then upload to backend.
   * Keep it simple + reliable.
   */
  const registerAndUploadToken = useCallback(async () => {
    try {
      // 1) Permissions
      const perm = await Notifications.getPermissionsAsync();
      let finalStatus = perm.status;

      if (finalStatus !== 'granted') {
        // Optional: you can remove the Alert if you want fully silent flow
        const wantEnable = await new Promise<boolean>(resolve => {
          Alert.alert(
            'Enable Push Notifications',
            'Would you like to receive notifications for new messages and calls?',
            [
              { text: 'Ask Me Later', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Enable', onPress: () => resolve(true) },
            ],
            { cancelable: false }
          );
        });

        if (!wantEnable) return;

        const req = await Notifications.requestPermissionsAsync();
        finalStatus = req.status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted');
        return;
      }

      // Check user ID exists before proceeding
      if (!user?.id) {
        console.log('[Push] User ID is missing');
        return;
      }

      // 2) Get expo push token (your util should call Notifications.getExpoPushTokenAsync)
      const expoPushToken = await registerForPushNotificationsAsync(user.id);
      if (!expoPushToken) {
        console.log('[Push] Could not obtain Expo Push Token');
        return;
      }

      console.log('Expo Push Token:', expoPushToken);

      // 3) Upload token to backend
      if (!user?.id) {
        console.log('[Push] User ID is missing');
        return;
      }

      const res = await updatePushToken(user.id, expoPushToken);
      if (res?.error) {
        console.error('[Push] Failed to update push token on backend:', res?.message);
      } else {
        console.log('[Push] Push token updated on backend successfully.');
      }

      // ✅ Quick local notification test (optional)
      // await Notifications.scheduleNotificationAsync({
      //   content: { title: 'Local test', body: 'Notifications OK ✅' },
      //   trigger: null,
      // });
    } catch (err) {
      console.error('[Push] registerAndUploadToken error:', err);
    }
  }, [user?.id]);

  /**
   * Connect / disconnect websocket and register push once user is logged in.
   */
  useEffect(() => {
    if (isLoggedIn && user?.id && token) {
      console.log('App.tsx: User is logged in, connecting WebSocket');
      WebSocketManager.connect(user.id);

      // Register push after login
      registerAndUploadToken();
    } else {
      console.log('App.tsx: User is not logged in or user ID/token missing, disconnecting WebSocket');
      WebSocketManager.disconnect();
    }
  }, [isLoggedIn, user?.id, token, registerAndUploadToken]);

  /**
   * ✅ Global call signaling listener
   */
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
    return () => WebSocketManager.removeCallCallback(handleIncomingCallSignal);
  }, [user]);

  /**
   * ✅ Global presence subscriber
   */
  useEffect(() => {
    if (!isLoggedIn) return;

    const { updateUserOnlineStatus } = useUserStore.getState();

    const handlePresenceChange = (data: { userId: string; isOnline: boolean }) => {
      console.log(`[App.tsx] Presence Change: ${data.userId} is ${data.isOnline ? 'Online' : 'Offline'}`);
      updateUserOnlineStatus(data.userId, data.isOnline);
    };

    WebSocketManager.addPresenceCallback(handlePresenceChange);
    return () => WebSocketManager.removePresenceCallback(handlePresenceChange);
  }, [isLoggedIn]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}
