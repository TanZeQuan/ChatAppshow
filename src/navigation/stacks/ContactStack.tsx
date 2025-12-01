import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ContactsStackParamList } from "../types";

import ContactsScreen from "../../screens/Contacts/ContactsScreen";
import AddFriendScreen from "../../screens/Contacts/AddFriendScreen";
import UserProfileScreen from "../../screens/Contacts/UserProfileScreen";

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export default function ContactsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: "Contacts" }} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ title: "Add Friend" }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
