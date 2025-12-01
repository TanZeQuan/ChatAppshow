import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";

import ChatStack from "./stacks/ChatStack";
import ContactsStack from "./stacks/ContactStack";
import ProfileStack from "./stacks/ProfileStack";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="ChatStack" component={ChatStack} options={{ title: "Chats" }} />
      <Tab.Screen name="ContactsStack" component={ContactsStack} options={{ title: "Contacts" }} />
      <Tab.Screen name="ProfileStack" component={ProfileStack} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
