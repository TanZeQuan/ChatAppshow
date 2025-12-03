import api from './service';
import type { CreateUserData } from "../api/types";

// ✅ Create user (register)
export const createUser = async (data: CreateUserData) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        phone: data.phone,
        passcode: data.passcode,
        email: data.email,
        username: data.username,
        roles: data.roles || "user",
        status: data.status ?? 1,
      })
    );

    const response = await api.post("/users/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Get user profile by userId
export const getUserProfile = async (userId: string) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({ user_id: userId })
    );

    const response = await api.post("/users/info", formData);
    // response.data should contain: username, phone, email, etc.
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Get user profile error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Read user list (default to a single userId)
export const readUsers = async (userId: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ user_id: userId }));

    const response = await api.post("/users/read", formData);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Search users
export const searchUsers = async (query: string, userId?: string) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        search: query,
        user_id: userId || "",
      })
    );

    const response = await api.post("/users/search", formData);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Update user info
export const updateUserInfo = async (
  userId: string,
  updateData: { name?: string; about?: string; image?: { uri: string; type?: string; name?: string } }
) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({ user_id: userId, name: updateData.name, about: updateData.about })
    );

    if (updateData.image) {
      const { uri, type = "image/jpeg", name = "avatar.jpg" } = updateData.image;
      formData.append("image", { uri, type, name } as any);
    }

    const response = await api.post("/users/info/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Change user email
export const changeUserEmail = async (userId: string, newEmail: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ user_id: userId, email: newEmail }));

    const response = await api.post("/users/email/change", formData);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Sync user settings
export const syncUserSettings = async (userId: string, settingsData: any) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ user_id: userId, settings: settingsData }));

    const response = await api.post("/users/settings/sync", formData);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};
