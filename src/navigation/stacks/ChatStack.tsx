import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChatStackParamList } from "../types";

import ChatListScreen from "../../screens/Chat/ChatListScreen";
import ChatRoomScreen from "../../screens/Chat/ChatRoomScreen";
import ChatSettingScreen from "../../screens/Chat/ChatSettingScreen";

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: "Chats" }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: "Chat Room"}} />
      <Stack.Screen name="ChatSettingScreen" component={ChatSettingScreen} options={{ title: "Chat Setting" }} />
    </Stack.Navigator>
  );
}
