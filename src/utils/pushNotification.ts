import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

export async function registerForPushNotificationsAsync(id: string): Promise<string | null> {
  if (!Device.isDevice) {
    Alert.alert('Push Notifications', 'Must use a physical device for push notifications.');
    return null;
  }

  // ✅ Android 必须先建 channel（建议放最前）
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
  }

  // ✅ 权限：如果没 granted，就请求一次（更稳）
  const perm = await Notifications.getPermissionsAsync();
  let finalStatus = perm.status;

  if (finalStatus !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
  }

  if (finalStatus !== 'granted') {
    // 不要在这里疯狂 alert，返回 null 让上层处理也行
    Alert.alert('Push Notifications', 'Permission not granted.');
    return null;
  }

  // ✅ projectId：从 app.json 读取，不要写死
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  if (!projectId) {
    Alert.alert(
      'Push Notifications',
      'Missing EAS projectId. Check app.json -> extra.eas.projectId.'
    );
    return null;
  }

  try {
    const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = expoPushToken.data;
    console.log('Expo Push Token:', token);
    return token;
  } catch (e: any) {
    console.error('Error getting Expo Push Token:', e);
    Alert.alert('Push Notifications', `Error getting token: ${e?.message ?? 'Unknown error'}`);
    return null;
  }
}
