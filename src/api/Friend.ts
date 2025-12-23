import { useUserStore } from '../store/userStore';
import api from './service';

// 获取当前 userId
const getCurrentUserId = () => useUserStore.getState().user?.id || "";

// 搜索用户
export const searchUser = async (targetUserId: string) => {
  const userId = getCurrentUserId();
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({
      user_id: userId,
      search: targetUserId
    }));

    // console.log("searchUser payload:", { user_id: userId, search: targetUserId });

    const response = await api.post("/users/search", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("searchUser response:", response.data);

    if (response.data?.error) {
      return { success: false, message: response.data.message || "Search failed", user: null };
    }

    const userData = response.data.response;
    
    if (!userData || (Array.isArray(userData) && userData.length === 0)) {
      return { 
        success: false, 
        message: "未找到该用户",
        user: null 
      };
    }
    
    return { 
      success: true, 
      user: userData,
      message: response.data.message || "Completed"
    };
  } catch (error: any) {
    console.error("searchUser full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "Search failed", 
      user: null 
    };
  }
};

// 创建好友请求
export const createFriendRequest = async (approveId: string, message?: string) => {
  const requestId = getCurrentUserId();

  try {
    const formData = new FormData();
    const payload: any = { request_id: requestId, approve_id: approveId };
    if (message) payload.message = message;

    formData.append("data", JSON.stringify(payload));

    // console.log("createFriendRequest payload:", payload);

    const response = await api.post("/chats/friends/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("createFriendRequest response:", response.data);

    if (response.data?.error) {
      return { success: false, message: response.data.message || "Request failed" };
    }

    return { success: true, data: response.data, message: response.data.message || "Success" };
  } catch (error: any) {
    console.error("createFriendRequest full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "Request failed" 
    };
  }
};

// 读取好友列表
export const readFriends = async (isstatus = 1) => {
  const userId = getCurrentUserId();

  try {
    const formData = new FormData();
    const payload = { user_id: userId, request_id: userId, approve_id: userId, isstatus };
    formData.append("data", JSON.stringify(payload));

    // console.log("readFriends payload:", payload);

    const response = await api.post("/chats/friends/read", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("readFriends response:", response.data);

    if (response.data?.error) {
      return { success: false, message: response.data.message || "Read failed" };
    }

    return {
      success: true,
      data: {
        request: response.data.response?.request || [],
        approve: response.data.response?.approve || [],
      },
    };
  } catch (error: any) {
    console.error("readFriends full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "Read failed" 
    };
  }
};

// 更新好友状态
export const updateFriendStatus = async (listId: string, isstatus: number) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ list_id: listId, isstatus }));

    // console.log("updateFriendStatus payload:", { list_id: listId, isstatus });

    const response = await api.post("/chats/friends/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("updateFriendStatus response:", response.data);

    if (response.data?.error) {
      return { success: false, message: response.data.message || "Update failed" };
    }

    return { success: true, data: response.data, message: response.data.message || "Success" };
  } catch (error: any) {
    console.error("updateFriendStatus full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "Update failed" 
    };
  }
};

// 接受好友请求 (isstatus = 2)
export const acceptFriendRequest = async (listId: string) => {
  return await updateFriendStatus(listId, 2);
};

// 拒绝好友请求 (isstatus = 3)
export const rejectFriendRequest = async (listId: string) => {
  return await updateFriendStatus(listId, 3);
};

// ==================== 新增：ChatSettings 需要的函数 ====================

/**
 * 删除好友/联系人
 * 使用 isstatus = 3 (Declined/Removed)
 * @param listId - 好友关系ID (从 readFriends 获取)
 */
export const deleteFriend = async (listId: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ 
      list_id: listId, 
      isstatus: 3  // 3 = Removed
    }));

    // console.log("deleteFriend payload:", { list_id: listId, isstatus: 3 });

    const response = await api.post("/chats/friends/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("deleteFriend response:", response.data);

    if (response.data?.error) {
      return { 
        success: false, 
        message: response.data.message || "删除好友失败" 
      };
    }

    return { 
      success: true, 
      data: response.data, 
      message: response.data.message || "删除好友成功" 
    };
  } catch (error: any) {
    console.error("deleteFriend full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "删除好友失败" 
    };
  }
};

/**
 * 拉黑用户
 * 使用 isstatus = 4 (Blocked)
 * @param listId - 好友关系ID (从 readFriends 获取)
 */
export const blockUser = async (listId: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ 
      list_id: listId, 
      isstatus: 4  // 4 = Blocked
    }));

    // console.log("blockUser payload:", { list_id: listId, isstatus: 4 });

    const response = await api.post("/chats/friends/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("blockUser response:", response.data);

    if (response.data?.error) {
      return { 
        success: false, 
        message: response.data.message || "拉黑用户失败" 
      };
    }

    return { 
      success: true, 
      data: response.data, 
      message: response.data.message || "拉黑用户成功" 
    };
  } catch (error: any) {
    console.error("blockUser full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "拉黑用户失败" 
    };
  }
};

/**
 * 取消拉黑用户
 * 使用 isstatus = 2 (恢复为好友)
 * @param listId - 好友关系ID
 */
export const unblockUser = async (listId: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ 
      list_id: listId, 
      isstatus: 2  // 2 = Accepted (恢复好友关系)
    }));

    // console.log("unblockUser payload:", { list_id: listId, isstatus: 2 });

    const response = await api.post("/chats/friends/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // console.log("unblockUser response:", response.data);

    if (response.data?.error) {
      return { 
        success: false, 
        message: response.data.message || "取消拉黑失败" 
      };
    }

    return { 
      success: true, 
      data: response.data, 
      message: response.data.message || "取消拉黑成功" 
    };
  } catch (error: any) {
    console.error("unblockUser full error:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || "取消拉黑失败" 
    };
  }
};