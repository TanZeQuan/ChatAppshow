interface Member {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
}

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
  ChatRoom: {
    chatId: string;
    chatName: string;
    isGroup?: boolean;
  };
  ChatSettingScreen: {
    chatId: string;
    chatName: string;
    avatar?: string;
  };
  GroupRoom: {
    chatId: string;
    chatName: string;
    isGroup: boolean;
    members?: any[];
    memberIds?: string[];
  };
  GroupSettingScreen: {
    chatId: string;
    chatName: string;
    members?: any[];
    memberIds?: string[];
  };
  GroupMemberList: {
    groupId: string;
  };
  AddGroupMembers: {
    chatId: string;
    chatName: string;
    currentMembers: Member[]; // Assuming Member type is available globally or imported
  };
};

/**
 * CONTACTS STACK
 */
export type ContactsStackParamList = {
  Contacts: undefined;
  AddFriend: undefined;
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
