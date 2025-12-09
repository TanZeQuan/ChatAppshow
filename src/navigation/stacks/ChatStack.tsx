import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChatStackParamList } from "../types";

import ChatListScreen from "../../screens/Chat/ChatListScreen";
import ChatRoomScreen from "../../screens/Chat/ChatRoomScreen";
import ChatSettingScreen from "../../screens/Chat/ChatSettingScreen";
import GroupRoomScreen from "../../screens/Chat/GroupRoomScreen";
import GroupSettingScreen from "../../screens/Chat/GroupSettingScreen";
import GroupMemberList from "../../screens/Chat/GroupMemberList";
import AddGroupMembers from "../../screens/Chat/AddGroupMembers";

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
    </Stack.Navigator>
  );
}