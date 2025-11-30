import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatStack from './stacks/ChatStack';
import ContactsStack from './stacks/ContactStack';
import ProfileStack from './stacks/ProfileStack';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Chat" component={ChatStack} />
      <Tab.Screen name="Contacts" component={ContactsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
