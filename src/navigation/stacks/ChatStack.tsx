import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ChatStackParamList } from "../types";

import AddGroupMembers from "../../screens/Chat/AddGroupMembers";
import ChatHistory from "../../screens/Chat/ChatHistory";
import ChatListScreen from "../../screens/Chat/ChatListScreen";
import ChatRoomScreen from "../../screens/Chat/ChatRoomScreen";
import ChatSettingScreen from "../../screens/Chat/ChatSettingScreen";
import GroupCallScreen from "../../screens/Chat/GroupCallScreen";
import GroupMemberList from "../../screens/Chat/GroupMemberList";
import GroupRoomScreen from "../../screens/Chat/GroupRoomScreen";
import GroupSettingScreen from "../../screens/Chat/GroupSettingScreen";
import SelectContactForCard from "../../screens/Chat/SelectContactForCard";
import SingleCallScreen from "../../screens/Chat/CallScreen";

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "Chats" }}
      />

      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ title: "Chat Room" }}
      />

      <Stack.Screen
        name="ChatSettingScreen"
        component={ChatSettingScreen}
        options={{ title: "Chat Setting" }}
      />

      <Stack.Screen
        name="GroupRoom"
        component={GroupRoomScreen}
        options={{ title: "Group Room" }}
      />

      <Stack.Screen
        name="GroupSettingScreen"
        component={GroupSettingScreen}
        options={{ title: "Group Setting" }}
      />

      <Stack.Screen
        name="GroupMemberList"
        component={GroupMemberList}
        options={{ title: "Group Members" }}
      />

      <Stack.Screen
        name="AddGroupMembers"
        component={AddGroupMembers}
        options={{ title: "Add Group Members" }}
      />

      <Stack.Screen
        name="ChatHistory"
        component={ChatHistory}
        options={{ title: "Chat History" }}
      />
      <Stack.Screen
        name="SelectContactForCard"
        component={SelectContactForCard}
        options={{ title: "Select Contact" }}
      />
      <Stack.Screen
        name="SingleCallScreen"
        component={SingleCallScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal', // 这样弹出时更有打电话的感觉
          gestureEnabled: false // 禁止手势划走
        }}
      />
      <Stack.Screen
        name="GroupCallScreen"
        component={GroupCallScreen}
        options={{ title: "Group Call" }}
      />
    </Stack.Navigator>
  );
}