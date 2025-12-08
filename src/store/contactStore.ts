// contactStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Contact = {
  listId: any;
  isFriend: boolean;
  id: string;
  name: string;
  avatar?: string;
  online?: boolean;
  rawData?: any; // Store additional API data if needed
};

export type FriendRequest = {
  id: string;       // 请求ID，可以用好友ID或生成唯一ID
  from: Contact;    // 谁发来的请求
  status: 'pending' | 'accepted' | 'rejected';
  message?: string; // Optional message with the request
  listId?: string;  // API list_id for updating status
};

type ContactStore = {
  contacts: Contact[];
  friendRequests: FriendRequest[];

  // Contacts
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (contactId: string, newData: Partial<Contact>) => void;
  removeContact: (contactId: string) => void;
  getContactById: (contactId: string) => Contact | undefined;
  getOnlineContacts: () => Contact[];
<<<<<<< HEAD
  setContacts: (contacts: Contact[]) => void; // Added setContacts action
=======
  clearContacts: () => void;
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c

  // Friend Requests
  setFriendRequests: (requests: FriendRequest[]) => void;
  addFriendRequest: (request: FriendRequest) => void;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  getPendingRequests: () => FriendRequest[];
  clearFriendRequests: () => void;
};

export const useContactStore = create<ContactStore>()(
  persist(
    (set, get) => ({
      contacts: [],
      friendRequests: [],

      // Contacts
      setContacts: (contacts) =>
        set({ contacts }),

      addContact: (contact) => {
        // Prevent duplicates
        const exists = get().contacts.find(c => c.id === contact.id);
        if (!exists) {
          set({ contacts: [...get().contacts, contact] });
        }
      },

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

<<<<<<< HEAD
      setContacts: (contacts) => set({ contacts }), // Implementation for setContacts
=======
      clearContacts: () =>
        set({ contacts: [] }),
>>>>>>> 90aaf57c5e02850cf7bb2802c0b304936322c93c

      // Friend Requests
      setFriendRequests: (requests) =>
        set({ friendRequests: requests }),

      addFriendRequest: (request) => {
        // Prevent duplicates
        const exists = get().friendRequests.find(r => r.id === request.id);
        if (!exists) {
          set({ friendRequests: [...get().friendRequests, request] });
        }
      },

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

      clearFriendRequests: () =>
        set({ friendRequests: [] }),
    }),
    {
      name: "contact-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);