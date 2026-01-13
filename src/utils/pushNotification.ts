import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  let token: string | null = null;

  if (Device.isDevice) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      // This should not happen if the permission is requested before calling this function
      // but as a fallback, we can alert the user.
      alert('You need to enable push notifications to receive updates.');
      return null;
    }

    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'd6a9e508-d2dd-4b92-a6eb-28c653e9100f',
      });
      token = expoPushToken.data;
      console.log('Expo Push Token:', token);
    } catch (e: any) {
      console.error('Error getting Expo Push Token:', e);
      const errorMessage = e.message || 'An unknown error occurred.';
      alert(`Error getting Expo Push Token: ${errorMessage}`);
      return null;
    }
  } else {
    alert('Must use physical device for Push Notifications');
    console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

// Optional: Handler for receiving notifications while the app is in the foreground
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: false,
//     shouldSetBadge: false,
//   }),
// });
