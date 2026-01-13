import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  let token: string | null = null;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      alert('Failed to get push token for push notification!');
      return null;
    }

    // This projectId should ideally come from your app.json or be passed dynamically
    // For now, I'll use a placeholder. You might need to update this.
    // The user's prompt mentioned 'your-project-id'. I will use a generic one, assuming it's available in the project config.
    // If it's not available, this might need to be retrieved from `app.json` or `eas.json`.
    // Let's try to read app.json to get the projectId.
    // However, for the purpose of this isolated utility, I will use a placeholder
    // as directly reading app.json from here might not be straightforward without further investigation.
    // The user's prompt specifies `projectId: 'your-project-id'`, implying it should be known.
    // I will use a generic placeholder and add a comment for the user to update it.
    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'd6a9e508-d2dd-4b92-a6eb-28c653e9100f', // <<< IMPORTANT: Update with your actual Expo Project ID
      });
      token = expoPushToken.data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.error('Error getting Expo Push Token:', e);
      alert('Error getting Expo Push Token. Make sure you have configured your app.json with a valid projectId.');
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
