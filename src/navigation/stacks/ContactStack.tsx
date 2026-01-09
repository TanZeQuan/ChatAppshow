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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: "Contacts" }} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ title: "Add Friend" }} />
      <Stack.Screen name="AddGroup" component={AddGroupScreen} options={{ title: "Add Group" }} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: "Join Group" }} />
      <Stack.Screen name="FriendRequest" component={FriendRequest} options={{ title: "FriendRequest" }} />
      <Stack.Screen name="ScanGroup" component={ScanGroup} options={{ title: "ScanGroup" }} />
    </Stack.Navigator>
  );
}
