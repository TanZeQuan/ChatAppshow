import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useUserStore } from '../store/userStore';

type IncomingMessage = {
  chatId: string;
  text: string;
  senderId: string;
  name?: string;
  avatar?: string;
  createdAt?: string;
};

const WS_URL = 'https://ws.ngrok-free.dev/websocket';

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const user = useUserStore.getState().user;

  const addMessage = useChatStore((state) => state.addMessage);
  const incrementUnread = useChatStore((state) => state.incrementUnread);

  useEffect(() => {
    if (!user) return;

    wsRef.current = new WebSocket(`${WS_URL}?userId=${user.id}`);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data: IncomingMessage = JSON.parse(event.data);

        // 如果消息不是自己发的，增加未读
        const isSelf = data.senderId === user.id;

        // 保存消息到 store - 使用 refactored addMessage
        addMessage({
          chatId: data.chatId,
          text: data.text,
          senderId: data.senderId,
          name: data.name,
          avatar: data.avatar,
          createdAt: data.createdAt,
        });

        if (!isSelf) {
          incrementUnread(data.chatId);
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      // 可以考虑重连逻辑
    };

    wsRef.current.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      wsRef.current?.close();
    };
  }, [addMessage, incrementUnread, user]);

  // 发送消息函数
  const sendMessage = (chatId: string, text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return;
    }

    const msg = {
      chatId,
      text,
      senderId: user?.id,
      name: user?.name,
      avatar: user?.avatar,
      createdAt: new Date().toISOString(),
    };

    wsRef.current.send(JSON.stringify(msg));

    // 本地立即添加消息 - 使用 refactored addMessage
    addMessage(msg);
  };

  return { sendMessage };
};
