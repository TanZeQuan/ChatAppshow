import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigation'; 
import { useEffect } from 'react';
import { useUserStore } from './src/store/userStore';
import WebSocketManager from './src/services/WebSocketManager';
import { View } from 'react-native';
import CallScreen from './src/screens/Chat/CallScreen';

export default function App() {
  const { user, token, isLoggedIn } = useUserStore();

  useEffect(() => {
    if (isLoggedIn && user && token) {
      console.log('App.tsx: User is logged in, connecting WebSocket');
      WebSocketManager.connect(user.id);
    } else {
      console.log('App.tsx: User is not logged in, disconnecting WebSocket');
      WebSocketManager.disconnect();
    }
  }, [isLoggedIn, user, token]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <CallScreen />
    </View>
  );
}
