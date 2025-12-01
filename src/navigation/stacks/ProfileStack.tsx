import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileStackParamList } from "../types";

import ProfileScreen from "../../screens/Profile/ProfileScreen";
import EditProfileScreen from "../../screens/Profile/EditProfileScreen";
import ForgetPassword from "../../screens/Profile/ForgetPassword";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "My Profile" }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
      <Stack.Screen name="ChangePassword" component={ForgetPassword} options={{ title: "Change Password" }} />
    </Stack.Navigator>
  );
}
