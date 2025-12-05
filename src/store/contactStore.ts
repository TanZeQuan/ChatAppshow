// contactStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Contact = {
  id: string;
  name: string;
  avatar?: string;
  online?: boolean;
};

export type FriendRequest = {
  id: string;       // 请求ID，可以用好友ID或生成唯一ID
  from: Contact;    // 谁发来的请求
  status: 'pending' | 'accepted' | 'rejected';
};

type ContactStore = {
  contacts: Contact[];
  friendRequests: FriendRequest[];

  // Contacts
  addContact: (contact: Contact) => void;
  updateContact: (contactId: string, newData: Partial<Contact>) => void;
  removeContact: (contactId: string) => void;
  getContactById: (contactId: string) => Contact | undefined;
  getOnlineContacts: () => Contact[];
  setContacts: (contacts: Contact[]) => void; // Added setContacts action

  // Friend Requests
  addFriendRequest: (request: FriendRequest) => void;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  getPendingRequests: () => FriendRequest[];
};

export const useContactStore = create<ContactStore>()(
  persist(
    (set, get) => ({
      contacts: [],
      friendRequests: [],

      // Contacts
      addContact: (contact) =>
        set({ contacts: [...get().contacts, contact] }),

      updateContact: (contactId, newData) =>
        set({
          contacts: get().contacts.map((c) =>
            c.id === contactId ? { ...c, ...newData } : c
          )
        }),

      removeContact: (contactId) =>
        set({
          contacts: get().contacts.filter((c) => c.id !== contactId)
        }),

      getContactById: (contactId) =>
        get().contacts.find((c) => c.id === contactId),

      getOnlineContacts: () =>
        get().contacts.filter((c) => c.online === true),

      setContacts: (contacts) => set({ contacts }), // Implementation for setContacts

      // Friend Requests
      addFriendRequest: (request) =>
        set({ friendRequests: [...get().friendRequests, request] }),

      acceptFriendRequest: (requestId) => {
        const req = get().friendRequests.find(r => r.id === requestId);
        if (!req) return;
        // 加入联系人
        get().addContact(req.from);
        // 更新请求状态
        set({
          friendRequests: get().friendRequests.map(r =>
            r.id === requestId ? { ...r, status: 'accepted' } : r
          )
        });
      },

      rejectFriendRequest: (requestId) =>
        set({
          friendRequests: get().friendRequests.map(r =>
            r.id === requestId ? { ...r, status: 'rejected' } : r
          )
        }),

      getPendingRequests: () =>
        get().friendRequests.filter(r => r.status === 'pending'),
    }),
    {
      name: "contact-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
