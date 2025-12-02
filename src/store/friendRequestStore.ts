import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FriendRequest = {
  id: string;
  name: string;
  avatar?: string;
};

type FriendRequestStore = {
  requests: FriendRequest[];

  addRequest: (request: FriendRequest) => void;
  removeRequest: (id: string) => void;
};

export const useFriendRequestStore = create<FriendRequestStore>()(
  persist(
    (set, get) => ({
      requests: [],

      addRequest: (request) => {
        // 避免重复请求
        const exists = get().requests.find(r => r.id === request.id);
        if (!exists) {
          set({ requests: [...get().requests, request] });
        }
      },

      removeRequest: (id) => {
        set({ requests: get().requests.filter(r => r.id !== id) });
      },
    }),
    {
      name: 'friend-request-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
