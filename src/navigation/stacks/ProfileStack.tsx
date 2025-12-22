import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ProfileStackParamList } from "../types";

import CreateMeeting from "../../screens/Profile/Meeting/CreateMeeting";
import JoinMeeting from "../../screens/Profile/Meeting/JoinMeeting";
import MeetingScreen from "../../screens/Profile/Meeting/MeetingScreen";
import ProfileScreen from "../../screens/Profile/ProfileScreen";
import QRcodeScreen from "../../screens/Profile/QRcodeScreen";
import EditEmail from "../../screens/Profile/Setting/EditEmail";
import ResetProfileScreen from "../../screens/Profile/Setting/EditName";
import ForgetPassword from "../../screens/Profile/Setting/EditPasswordScreen";
import EditProfileScreen from "../../screens/Profile/Setting/EditProfileScreen";
import Notification from "../../screens/Profile/Setting/Notification";
import SettingScreen from "../../screens/Profile/Setting/SettingScreen";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "My Profile" }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
      <Stack.Screen name="ChangePassword" component={ForgetPassword} options={{ title: "Change Password" }} />
      <Stack.Screen name="SettingScreen" component={SettingScreen} options={{ title: "Setting" }} />
      <Stack.Screen name="EditName" component={ResetProfileScreen} options={{ title: "Reset Profile" }} />
      <Stack.Screen name="MeetingScreen" component={MeetingScreen} options={{ title: "Meeting" }} />
      <Stack.Screen name="JoinMeeting" component={JoinMeeting} options={{ title: "Join Meeting" }} />
      <Stack.Screen name="CreateMeeting" component={CreateMeeting} options={{ title: "Create Meeting" }} />
      <Stack.Screen name="QRcode" component={QRcodeScreen} options={{ title: "QRcode" }} />
      <Stack.Screen name="EditEmail" component={EditEmail} options={{ title: "Edit Email" }} />
      <Stack.Screen name="Notification" component={Notification} options={{ title: "Notification" }} />

    </Stack.Navigator>
  );
}
