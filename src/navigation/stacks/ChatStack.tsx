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
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        // ✅ 全局平滑转场动画配置
        animation: 'slide_from_right', // iOS 风格的滑动动画
        animationDuration: 250, // 动画时长
        gestureEnabled: true, // 允许手势返回
        gestureDirection: 'horizontal', // 水平手势
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ 
          title: "Chats",
          // 聊天列表不需要进入动画（它是首页）
          animation: 'fade',
        }}
      />

      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ 
          title: "Chat Room",
          animation: 'slide_from_right',
        }}
      />

      <Stack.Screen
        name="ChatSettingScreen"
        component={ChatSettingScreen}
        options={{ 
          title: "Chat Setting",
          animation: 'slide_from_right',
        }}
      />

      <Stack.Screen
        name="GroupRoom"
        component={GroupRoomScreen}
        options={{ 
          title: "Group Room",
          animation: 'slide_from_right',
        }}
      />

      <Stack.Screen
        name="GroupSettingScreen"
        component={GroupSettingScreen}
        options={{ 
          title: "Group Setting",
          animation: 'slide_from_right',
        }}
      />

      <Stack.Screen
        name="GroupMemberList"
        component={GroupMemberList}
        options={{ 
          title: "Group Members",
          animation: 'slide_from_bottom',
        }}
      />

      <Stack.Screen
        name="AddGroupMembers"
        component={AddGroupMembers}
        options={{ 
          title: "Add Group Members",
          animation: 'slide_from_bottom',
        }}
      />

      <Stack.Screen
        name="ChatHistory"
        component={ChatHistory}
        options={{ 
          title: "Chat History",
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="SelectContactForCard"
        component={SelectContactForCard}
        options={{ 
          title: "Select Contact",
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="SingleCallScreen"
        component={SingleCallScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false
        }}
      />
      <Stack.Screen
        name="GroupCallScreen"
        component={GroupCallScreen}
        options={{ 
          title: "Group Call",
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false
        }}
      />
    </Stack.Navigator>
  );
}