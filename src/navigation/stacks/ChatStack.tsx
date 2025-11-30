import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../../screens/Chat/ChatListScreen';
import ChatRoomScreen from '../../screens/Chat/ChatRoomScreen';
import ChatSettingsScreen from '../../screens/Chat/ChatSettingScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
    </Stack.Navigator>
  );
}
