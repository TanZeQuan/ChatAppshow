import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FriendRequest = {
  id: string;        // This will be the user_id of the person involved in the request (e.g., the sender's user_id for a received request)
  list_id: string;   // This is the unique identifier for the request itself, used for updateFriendStatus
  name: string;
  avatar?: string;
  status: number;    // 1: Pending, 2: Accepted, 3: Rejected
  message?: string;
};

type FriendRequestStore = {
  requests: FriendRequest[];

  addRequest: (request: FriendRequest) => void;
  removeRequest: (listId: string) => void; // Changed parameter to listId
  setRequests: (requests: FriendRequest[]) => void; // Added setRequests action
};

export const useFriendRequestStore = create<FriendRequestStore>()(
  persist(
    (set, get) => ({
      requests: [],

      addRequest: (request) => {
        // 避免重复请求 (基于 list_id)
        const exists = get().requests.find(r => r.list_id === request.list_id);
        if (!exists) {
          set({ requests: [...get().requests, request] });
        }
      },

      removeRequest: (listId) => { // Changed parameter to listId
        set({ requests: get().requests.filter(r => r.list_id !== listId) });
      },

      setRequests: (requests) => set({ requests }), // Implementation for setRequests
    }),
    {
      name: 'friend-request-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

