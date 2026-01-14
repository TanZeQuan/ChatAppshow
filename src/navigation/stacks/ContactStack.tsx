import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ContactsStackParamList } from "../types";

import ContactsScreen from "../../screens/Contacts/ContactsScreen";
import AddFriendScreen from "../../screens/Contacts/AddFriendScreen";
import AddGroupScreen from "../../screens/Contacts/AddGroupScreen";
import JoinGroupScreen from "../../screens/Contacts/JoinGroupScreen";
import FriendRequest from "../../screens/Contacts/FriendRequest";
import ScanGroup from "../../screens/Contacts/ScanGroup";

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export default function ContactsStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        // ✅ 全局平滑转场动画配置
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="Contacts" 
        component={ContactsScreen} 
        options={{ title: "Contacts", animation: 'fade' }} 
      />
      <Stack.Screen 
        name="AddFriend" 
        component={AddFriendScreen} 
        options={{ title: "Add Friend", animation: 'slide_from_bottom' }} 
      />
      <Stack.Screen 
        name="AddGroup" 
        component={AddGroupScreen} 
        options={{ title: "Add Group", animation: 'slide_from_bottom' }} 
      />
      <Stack.Screen 
        name="JoinGroup" 
        component={JoinGroupScreen} 
        options={{ title: "Join Group", animation: 'slide_from_bottom' }} 
      />
      <Stack.Screen 
        name="FriendRequest" 
        component={FriendRequest} 
        options={{ title: "FriendRequest", animation: 'slide_from_right' }} 
      />
      <Stack.Screen 
        name="ScanGroup" 
        component={ScanGroup} 
        options={{ title: "ScanGroup", animation: 'slide_from_bottom' }} 
      />
    </Stack.Navigator>
  );
}
