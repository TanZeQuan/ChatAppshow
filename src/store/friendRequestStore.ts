import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FriendRequest = {
  id: string;
  name: string;
  avatar?: string;
  // ✅ 新增 type 字段，用于区分是 "我发出的(sent)" 还是 "别人发给我的(received)"
  type?: 'sent' | 'received'; 
};

type FriendRequestStore = {
  requests: FriendRequest[];

  addRequest: (request: FriendRequest) => void;
  removeRequest: (id: string) => void;
  // ✅ 新增 setRequests 方法，用于 API 数据全量同步
  setRequests: (requests: FriendRequest[]) => void;
};

export const useFriendRequestStore = create<FriendRequestStore>()(
  persist(
    (set, get) => ({
      requests: [],

      addRequest: (request) => {
        const currentRequests = get().requests;
        const existingIndex = currentRequests.findIndex(r => r.id === request.id);

        if (existingIndex !== -1) {
          // ✅ 如果已存在，进行更新（例如更新头像、名称或类型）
          const updatedRequests = [...currentRequests];
          updatedRequests[existingIndex] = { ...updatedRequests[existingIndex], ...request };
          set({ requests: updatedRequests });
        } else {
          // ✅ 不存在，直接添加
          set({ requests: [...currentRequests, request] });
        }
      },

      removeRequest: (id) => {
        set({ requests: get().requests.filter(r => r.id !== id) });
      },

      // ✅ 实现全量覆盖（用于 FriendRequestScreen 拉取最新列表时）
      setRequests: (requests) => {
        set({ requests });
      },
    }),
    {
      name: 'friend-request-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);