import React from 'react';
import { useRoute } from '@react-navigation/native';
import ChatRoomScreen from './ChatRoomScreen';
import GroupRoomScreen from './GroupRoomScreen';
import { useChatStore } from '../../store/chatStore';

export default function ChatRoomRouter() {
  const route = useRoute<any>();
  const { chatId, isGroup } = route.params;
  const { getChatById } = useChatStore();

  const chat = getChatById(chatId);
  const isGroupChat = isGroup || chat?.isGroup || false;

  return isGroupChat ? <GroupRoomScreen /> : <ChatRoomScreen />;
}