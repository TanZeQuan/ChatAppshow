import { NavigatorScreenParams } from "@react-navigation/native";

/**
 * ROOT STACK
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};

/**
 * AUTH STACK
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgetPassword: undefined;
};

/**
 * BOTTOM TAB
 */
export type MainTabParamList = {
  ChatStack: NavigatorScreenParams<ChatStackParamList>;
  ContactsStack: NavigatorScreenParams<ContactsStackParamList>;
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};

/**
 * CHAT STACK
 */
export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { chatId: string; name: string };
  ChatSettingScreen: { chatId: string};
};

/**
 * CONTACTS STACK
 */
export type ContactsStackParamList = {
  Contacts: undefined;
  AddFriend: undefined;
  UserProfile: { userId: string };
  AddGroup: undefined;
  JoinGroup: undefined;
  FriendRequest: undefined;
};

/**
 * PROFILE STACK
 */
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  SettingScreen: undefined;
  EditName: undefined;
  MeetingScreen: undefined;
  QRcode: undefined;
  JoinMeeting: undefined;
  CreateMeeting: undefined;
  EditEmail: undefined;
  Notification: undefined;
};
