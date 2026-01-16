import api from './service';

export const createPrivateChat = async ({
    name,
    user_id,
    chat_with,
    image = "",
}: {
    name: string;
    user_id: string;
    chat_with: string;
    image?: string;
}) => {
    try {
        // 🔍 Diagnostic: Log what we're sending to backend
        console.log('🌐 [API/createPrivateChat] Sending to backend:');
        console.log('  - user_id:', user_id);
        console.log('  - chat_with:', chat_with);
        console.log('  - name:', name);

        const formData = new FormData();

        const dataPayload = {
            name,
            user_id,
            chat_with,
            image,
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("createPrivateChat payload:", dataPayload);

        const response = await api.post("/chats/private/new", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        console.log("createPrivateChat response:", response.data);

        let responseData = response.data;

        // WORKAROUND for backend sending HTML warnings before JSON
        if (typeof responseData === 'string') {
            try {
                // Find the first '{' which marks the beginning of the JSON
                const jsonStartIndex = responseData.indexOf('{');
                if (jsonStartIndex !== -1) {
                    const jsonString = responseData.substring(jsonStartIndex);
                    responseData = JSON.parse(jsonString);
                } else {
                    // If no JSON is found, treat it as an error
                    throw new Error("Invalid response format: No JSON object found in response string.");
                }
            } catch (e) {
                console.error("Failed to parse response data string:", e);
                return {
                    success: false,
                    message: "Failed to parse server response.",
                };
            }
        }

        if (responseData?.error === true) {
            return {
                success: false,
                message: responseData.message || "Chat creation failed",
            };
        }

        return {
            success: true,
            data: responseData,
            message: responseData.message,
        };
    } catch (error: any) {
        console.error(
            "createPrivateChat error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};


export const createGroupChat = async ({
    name,
    user_id,
    image = "",
    group
}: {
    name: string;
    user_id: string;
    image?: string;
    group: { user_id: string; isadmin: number }[];
}) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            name,
            user_id,
            image,
            group
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("createGroupChat payload:", dataPayload);

        const response = await api.post("/chats/group/new", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        console.log("createGroupChat response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Group creation failed",
            };
        }

        return {
            success: true,
            data: response.data,
            message: response.data.message,
        };
    } catch (error: any) {
        console.error(
            "createGroupChat error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};

// chatList
export const readUserChats = async (user_id: string) => {
    try {
        // 🔍 Diagnostic: Log what we're sending to backend
        console.log('🌐 [API/readUserChats] Sending to backend:');
        console.log('  - user_id:', user_id);

        const formData = new FormData();

        const dataPayload = { user_id };

        formData.append("data", JSON.stringify(dataPayload));

        // console.log("readUserChats payload:", dataPayload);

        const response = await api.post("/chats/read", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        // console.log("readUserChats response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Read chats failed",
            };
        }

        return {
            success: true,
            data: response.data.response,
            message: response.data.message,
        };
    } catch (error: any) {
        console.error(
            "readUserChats error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};


// chatMsg
export const readChatMessages = async ({
    chat_id,
    user_id,
    offset = 0
}: {
    chat_id: string;
    user_id: string;
    offset?: number;
}) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            chat_id,
            user_id,
            offset
        };

        formData.append("data", JSON.stringify(dataPayload));

        // console.log("📤 [readChatMessages] Request:", dataPayload);

        const response = await api.post("/chats/message/read", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        // console.log("📥 [readChatMessages] Response:", {
        //     error: response.data?.error,
        //     hasResponse: !!response.data?.response,
        //     hasChatArray: !!response.data?.response?.chat,
        //     hasGroupArray: !!response.data?.response?.group,
        //     chatLength: response.data?.response?.chat?.length || 0,
        //     groupLength: response.data?.response?.group?.length || 0,
        // });

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Read messages failed",
            };
        }

        return {
            success: true,
            data: response.data.response,
            message: response.data.message,
        };
    } catch (error: any) {
        console.error(
            "readChatMessages error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};

// Send new message
export interface MessagePayload {
  sender: string;
  isreceive: string[];
  chat_id: string;
  type?: number; // 1=text, 2=voice, 3=images, 4=contact card
  message?: string; // for text
  voice?: { uri: string; name: string; type: string }; // for voice
  files?: { uri: string; name: string; type: string }[]; // for files
}

export const sendChatMessage = async (payload: MessagePayload) => {
  try {
    const formData = new FormData();

    // 1. Append the main data payload (excluding files)
    const dataPayload: any = {
      sender: payload.sender,
      isreceive: payload.isreceive,
      chat_id: payload.chat_id,
    };

    if (payload.type) {
      dataPayload.type = payload.type;
    }

    if (payload.message) {
      dataPayload.message = payload.message;
    }

    // ✅ Add file count to data payload if files exist (required by backend)
    if (payload.files && payload.files.length > 0) {
      dataPayload.files = payload.files.length;
    }

    formData.append("data", JSON.stringify(dataPayload));

    // 2. Append voice file if it exists
    if (payload.voice) {
      console.log('🎤 [Send Voice] Attaching voice file:', {
        uri: payload.voice.uri,
        name: payload.voice.name,
        type: payload.voice.type,
      });

      // ✅ Validate voice file object
      if (!payload.voice.uri || !payload.voice.name || !payload.voice.type) {
        console.error('❌ [Send Voice] Invalid voice object:', payload.voice);
        throw new Error('Invalid voice file object');
      }

      formData.append("voice", {
        uri: payload.voice.uri,
        name: payload.voice.name,
        type: payload.voice.type,
      } as any);
    }

    // 3. Append other files if they exist
    // ✅ Backend expects: files_0, files_1, files_2, ... (not files[])
    if (payload.files) {
      console.log('📤 [Send Files] Attaching files:', payload.files.length);
      payload.files.forEach((file, index) => {
        console.log(`📤 [Send Files] files_${index}:`, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        });

        // ✅ Validate file object before appending
        if (!file.uri || !file.name || !file.type) {
          console.error(`❌ [Send Files] Invalid file object at index ${index}:`, file);
          throw new Error(`Invalid file object at index ${index}`);
        }

        formData.append(`files_${index}`, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });
    }

    console.log("📤 [sendChatMessage] dataPayload:", JSON.stringify(dataPayload, null, 2));
    console.log("📤 [sendChatMessage] Sending to:", "/chats/message/new");
    console.log("📤 [sendChatMessage] Full URL:", api.defaults.baseURL + "/chats/message/new");

    // Add request interceptor logging for this specific request
    console.log("📤 [sendChatMessage] Request config:", {
      baseURL: api.defaults.baseURL,
      timeout: 60000,
      headers: { "Content-Type": "multipart/form-data" }
    });

    const response = await api.post("/chats/message/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // 60 seconds for file uploads
    });

    // sendChatMessage success

    if (response.data?.error === true) {
      return {
        success: false,
        message: response.data.message || "Send message failed",
      };
    }

    return {
      success: true,
      data: response.data.response,
      message: response.data.message,
    };
  } catch (error: any) {
    console.error(
      "❌ [sendChatMessage] Error:",
      error.response?.data || error.message
    );
    console.error("❌ [sendChatMessage] Full error:", error);
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};

export interface GroupMember {
  user_id: string;
  isadmin: number; // 1 normal, 2 admin
}

export interface AddGroupParams {
  name: string;
  user_id: string;
  image?: string;
  group: GroupMember[];
}

export const addGroup = async (params: AddGroupParams) => {
  console.log("📞 addGroup called:", params);

  try {
    const formData = new FormData();

    const dataPayload = {
      name: params.name,
      user_id: params.user_id,
      image: params.image ?? "",
      group: params.group
    };

    formData.append("data", JSON.stringify(dataPayload));

    console.log("➡ Sending to backend (FormData JSON):", {
      name: params.name,
      user_id: params.user_id,
      image: params.image,
      groupCount: params.group.length,
      group: params.group
    });

    // ✅ Use same headers as successful Chat API
    const response = await api.post("/chats/group/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000, // 30 seconds
    });

    console.log("📩 Backend response:", response.data);

    // Handle response (check for error field)
    if (response.data?.error === true) {
      console.error("❌ Backend returned error:", response.data.message);
      return {
        error: true,
        message: response.data.message || "Group creation failed"
      };
    }

    return response.data;

  } catch (error: any) {
    console.error("❌ addGroup error:", error?.message);
    console.error("❌ Full error:", error);
    throw error;
  }
};

// Update group (add/remove members, leave)
// ==================== Group Member Management ====================
// Endpoint: /chats/group/member
// Actions: add, remove, permission, leave

export interface GroupMemberParams {
  chat_id: string;
  user_id: string;  // Admin's ID (or user's own ID for 'leave')
  action: "add" | "remove" | "permission" | "leave";
  target_id?: string | string[];  // Required for add/remove/permission - MUST be an ARRAY!
  permission?: 1 | 2;  // Required for 'permission' action: 1 = Member, 2 = Admin
}

/**
 * Manage group members: add, remove, change permissions, or leave the group.
 * 
 * @param params.action - "add" | "remove" | "permission" | "leave"
 * @param params.chat_id - Group chat ID
 * @param params.user_id - Admin's ID (or user's own ID for 'leave')
 * @param params.target_id - Target user ID (required for add/remove/permission)
 * @param params.permission - 1 = Member, 2 = Admin (required for 'permission' action)
 */
export const manageGroupMember = async (params: GroupMemberParams) => {
  console.log("📞 manageGroupMember called:", params);

  try {
    const formData = new FormData();

    const dataPayload: any = {
      action: params.action,
      chat_id: params.chat_id,
      user_id: params.user_id,
    };

    // Add target_id for add/remove/permission actions (REQUIRED for these actions)
    // ⚠️ IMPORTANT: target_id MUST be an ARRAY, even for single user operations!
    if (params.action === 'add' || params.action === 'remove' || params.action === 'permission') {
      if (!params.target_id) {
        console.error("❌ manageGroupMember: target_id is REQUIRED for action:", params.action);
        return {
          success: false,
          message: `target_id is required for ${params.action} action`,
        };
      }
      // ✅ Convert to array if it's a single string
      const targetIdArray = Array.isArray(params.target_id) ? params.target_id : [params.target_id];
      dataPayload.target_id = targetIdArray;
      console.log("✅ target_id converted to array:", targetIdArray);
    }

    // Add permission for 'permission' action
    if (params.action === 'permission' && params.permission !== undefined) {
      dataPayload.permission = params.permission;
    }

    console.log("➡ Sending to backend (manageGroupMember):", {
      endpoint: "/chats/group/member",
      payload: dataPayload,
      action: params.action,
      target_id: dataPayload.target_id,  // ✅ Explicitly log target_id
    });

    formData.append("data", JSON.stringify(dataPayload));

    const response = await api.post("/chats/group/member", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    console.log("📩 manageGroupMember full response:", {
      status: response.status,
      data: response.data,
      error: response.data?.error,
      message: response.data?.message,
      responseData: response.data?.response,
    });

    if (response.data?.error === true) {
      console.error("❌ manageGroupMember backend error:", response.data.message);
      return {
        success: false,
        message: response.data.message || "Group member operation failed",
      };
    }

    console.log("✅ manageGroupMember success");
    return {
      success: true,
      data: response.data.response,
      message: response.data.message,
    };
  } catch (error: any) {
    console.error("❌ manageGroupMember exception:", error);
    console.error("❌ manageGroupMember error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};

// ✅ Legacy compatibility wrapper - redirects to new endpoint
export interface UpdateGroupParams {
  chat_id: string;
  user_id: string;
  action: "add" | "remove" | "leave";
  target_id?: string | string[];  // ✅ Can be string or array - will be converted to array
}

/**
 * @deprecated Use manageGroupMember() instead. This function is kept for backward compatibility.
 */
export const updateGroup = async (params: UpdateGroupParams) => {
  console.log("📞 updateGroup called (legacy wrapper):", params);
  return manageGroupMember(params);
};

// ==================== Convenience Functions ====================

/**
 * Add a member to the group (Admin only)
 */
export const addGroupMember = async (chatId: string, adminId: string, targetUserId: string) => {
  console.log("📞 addGroupMember called:", { chatId, adminId, targetUserId });
  return manageGroupMember({
    action: 'add',
    chat_id: chatId,
    user_id: adminId,
    target_id: targetUserId,
  });
};

/**
 * Remove a member from the group (Admin only)
 */
export const removeGroupMember = async (chatId: string, adminId: string, targetUserId: string) => {
  console.log("📞 removeGroupMember called:", { chatId, adminId, targetUserId });
  return manageGroupMember({
    action: 'remove',
    chat_id: chatId,
    user_id: adminId,
    target_id: targetUserId,
  });
};

/**
 * Change member permission/role (Admin only)
 * @param permission - 1 = Member, 2 = Admin
 */
export const changeGroupMemberPermission = async (
  chatId: string,
  adminId: string,
  targetUserId: string,
  permission: 1 | 2
) => {
  console.log("📞 changeGroupMemberPermission called:", { chatId, adminId, targetUserId, permission });
  return manageGroupMember({
    action: 'permission',
    chat_id: chatId,
    user_id: adminId,
    target_id: targetUserId,
    permission: permission,
  });
};

/**
 * Leave a group (Any member)
 */
export const leaveGroup = async (chatId: string, userId: string) => {
  console.log("📞 leaveGroup called:", { chatId, userId });
  return manageGroupMember({
    action: 'leave',
    chat_id: chatId,
    user_id: userId,
  });
};

// ✅ Update group basic information (name and/or image)
// Only group admins can perform this action
export interface UpdateGroupInfoParams {
  chat_id: string;
  user_id: string;  // Admin's ID
  name?: string;    // Optional: new group name
  image?: {         // Optional: new group avatar file
    uri: string;
    name: string;
    type: string;
  };
}

export const updateGroupInfo = async (params: UpdateGroupInfoParams) => {
  console.log("📞 updateGroupInfo called:", params);

  try {
    const formData = new FormData();

    // Build data payload (only include fields that are provided)
    const dataPayload: { chat_id: string; user_id: string; name?: string } = {
      chat_id: params.chat_id,
      user_id: params.user_id,
    };

    if (params.name) {
      dataPayload.name = params.name;
    }

    formData.append("data", JSON.stringify(dataPayload));

    console.log("➡ Sending to backend (updateGroupInfo):", {
      endpoint: "/chats/group/update",
      dataPayload,
      hasImage: !!params.image,
    });

    // Append image file if provided
    if (params.image) {
      console.log('🖼️ [updateGroupInfo] Attaching image file:', params.image);
      formData.append("image", {
        uri: params.image.uri,
        name: params.image.name,
        type: params.image.type,
      } as any);
    }

    const response = await api.post("/chats/group/update", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    console.log("📩 updateGroupInfo response:", response.data);

    if (response.data?.error === true) {
      return {
        success: false,
        message: response.data.message || "Update group info failed",
      };
    }

    return {
      success: true,
      data: response.data.response,
      message: response.data.message,
    };
  } catch (error: any) {
    console.error("❌ updateGroupInfo error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};

// ✅ Update group name only (convenience wrapper)
export const updateGroupName = async (chatId: string, userId: string, newName: string) => {
  console.log("📞 updateGroupName called:", { chatId, userId, newName });
  return updateGroupInfo({
    chat_id: chatId,
    user_id: userId,
    name: newName,
  });
};

// ✅ Start Call API - 发起通话，获取 call_id
export interface StartCallParams {
  user_id: string;       // 发起人 ID
  callees: string[];     // 被呼叫者 ID 数组
  istype: number;        // 通话类型: 0=语音, 1=视频
}

export interface StartCallResponse {
  success: boolean;
  data?: {
    call_id: string;     // 通话房间 ID，如 "IM_CALL_123"
    [key: string]: any;
  };
  message?: string;
}

export const startCall = async (params: StartCallParams): Promise<StartCallResponse> => {
  console.log("[startCall] user:", params.user_id, "callees:", params.callees.length);

  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({
      user_id: params.user_id,
      callees: params.callees,
      istype: params.istype,
    }));

    const response = await api.post("/chats/call/start", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    let responseData = response.data;
    if (typeof responseData === 'string') {
      try {
        const jsonStartIndex = responseData.indexOf('{');
        if (jsonStartIndex !== -1) {
          responseData = JSON.parse(responseData.substring(jsonStartIndex));
        } else {
          throw new Error("Invalid response format");
        }
      } catch (e) {
        return { success: false, message: "Failed to parse response" };
      }
    }

    if (responseData?.error === true) {
      return { success: false, message: responseData.message || "Start call failed" };
    }

    // 提取 call_id
    let callId: string | undefined;
    if (typeof responseData?.response === 'string' && responseData.response.length > 0) {
      callId = responseData.response;
    } else if (responseData?.response?.call_id) {
      callId = responseData.response.call_id;
    } else if (responseData?.call_id) {
      callId = responseData.call_id;
    }

    console.log("[startCall] call_id:", callId || "无");
    
    if (!callId) {
      return { success: false, message: "No call_id returned from server" };
    }
    
    return { success: true, data: { call_id: callId }, message: responseData.message };
  } catch (error: any) {
    console.error("[startCall] 失败:", error.message);
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Call Room API - 管理通话房间 (join, leave, end, add)
export interface CallRoomParams {
  call_id: string;        // 通话房间 ID
  callees?: string[];     // 被呼叫者 ID 数组 (用于 add)
  action: 'join' | 'leave' | 'end' | 'add';  // 操作类型
  user_id?: string;       // 用户 ID (可选)
}

export interface CallRoomResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export const callRoom = async (params: CallRoomParams): Promise<CallRoomResponse> => {

  try {
    const formData = new FormData();

    // 只发送 call_id 和 action（最简化版本）
    // 如果后端还是报错，需要确认后端期望的确切格式
    const dataPayload: any = {
      call_id: params.call_id,
      action: params.action,
    };

    formData.append("data", JSON.stringify(dataPayload));

    // callRoom request

    const response = await api.post("/chats/call/room", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    // callRoom response received

    // 处理后端返回 HTML 警告的情况
    let responseData = response.data;
    if (typeof responseData === 'string') {
      try {
        const jsonStartIndex = responseData.indexOf('{');
        if (jsonStartIndex !== -1) {
          const jsonString = responseData.substring(jsonStartIndex);
          responseData = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (e) {
        console.error("❌ [callRoom] Parse response failed");
        return { success: false, message: "Failed to parse response" };
      }
    }

    if (responseData?.error === true) {
      // 静默处理错误，不影响通话功能（TCP Socket 是主要通道）
      // callRoom backend error (ignored)
      return { success: false, message: responseData.message };
    }

    // callRoom success
    return {
      success: true,
      data: responseData?.response || responseData,
      message: responseData.message,
    };
  } catch (error: any) {
    // 静默处理异常，不影响通话功能
    // callRoom API error (ignored)
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};

// ✅ Call Fail API - 报告通话失败
export interface CallFailParams {
  call_id: string;  // 通话房间 ID
}

export interface CallFailResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export const callFail = async (params: CallFailParams): Promise<CallFailResponse> => {
  console.log("🔴 [callFail] ====================================");
  console.log("🔴 [callFail] 报告通话失败");
  console.log("🔴 [callFail] call_id:", params.call_id);
  console.log("🔴 [callFail] ====================================");

  try {
    const formData = new FormData();

    const dataPayload = {
      call_id: params.call_id,
    };

    formData.append("data", JSON.stringify(dataPayload));

    console.log("🔴 [callFail] 发送请求到: /chats/call/fail");

    const response = await api.post("/chats/call/fail", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    console.log("🔴 [callFail] ====================================");
    console.log("🔴 [callFail] 收到后端响应");
    console.log("🔴 [callFail] 原始响应:", JSON.stringify(response.data, null, 2));
    console.log("🔴 [callFail] ====================================");

    // 处理后端返回 HTML 警告的情况
    let responseData = response.data;
    if (typeof responseData === 'string') {
      try {
        const jsonStartIndex = responseData.indexOf('{');
        if (jsonStartIndex !== -1) {
          const jsonString = responseData.substring(jsonStartIndex);
          responseData = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (e) {
        console.error("🔴 [callFail] ❌ 解析响应失败:", e);
        return { success: false, message: "Failed to parse response" };
      }
    }

    if (responseData?.error === true) {
      console.error("🔴 [callFail] ❌ 后端返回错误:", responseData.message);
      return { success: false, message: responseData.message };
    }

    console.log("🔴 [callFail] ✅ 报告成功!");
    return {
      success: true,
      data: responseData?.response || responseData,
      message: responseData.message,
    };
  } catch (error: any) {
    console.error("🔴 [callFail] ❌ API 异常:", error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};

// ✅ Update group image only (convenience wrapper)
export const updateGroupImage = async (
  chatId: string,
  userId: string,
  imageFile: { uri: string; name: string; type: string }
) => {
  console.log("📞 updateGroupImage called:", { chatId, userId, imageFile });
  return updateGroupInfo({
    chat_id: chatId,
    user_id: userId,
    image: imageFile,
  });
};
