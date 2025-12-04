import api from './service';

// ✅ Create user (register)
export const createUser = async (data: {
  phone: string;
  passcode: string;
  email?: string;
  name?: string;
  roles?: string;
  status?: number;
}) => {
  try {
    const formData = new FormData();
    formData.append(
      'data',
      JSON.stringify({
        phone: data.phone,
        passcode: data.passcode,
        email: data.email,
        name: data.name,
        roles: data.roles,
        status: data.status,
      })
    );

    const response = await api.post('/users/new', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

// ✅ Read user list (default to a single userId)
export const readUsers = async (userId: string) => {
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ user_id: userId }));

    const response = await api.post("/users/read", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    // 返回完整用户资料
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.res?.message || error.message,
    };
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
  updateData: { 
    name?: string; 
    about?: string; 
    image?: { uri: string; type?: string; name?: string } | null 
  }
) => {
  try {
    const formData = new FormData();
    
    // Always append the data field with user info
    const dataPayload: any = { 
      user_id: userId 
    };
    
    // Only include fields that are provided
    if (updateData.name !== undefined) {
      dataPayload.name = updateData.name;
    }
    
    if (updateData.about !== undefined) {
      dataPayload.about = updateData.about;
    }
    
    formData.append("data", JSON.stringify(dataPayload));

    // Only append image if it exists and has a valid URI
    if (updateData.image && updateData.image.uri) {
      const { uri, type = "image/jpeg", name = "avatar.jpg" } = updateData.image;
      
      // For React Native, the image object structure for FormData
      formData.append("image", {
        uri,
        type,
        name,
      } as any);
    }

    console.log('updateUserInfo payload:', {
      userId,
      hasImage: !!updateData.image,
      dataPayload
    });

    const response = await api.post("/users/info/update", formData, {
      headers: { 
        "Content-Type": "multipart/form-data" 
      },
    });

    console.log('updateUserInfo response:', response.data);

    // Check if response indicates an error
    if (response.data?.error === true) {
      return { 
        success: false, 
        message: response.data.message || "Update failed" 
      };
    }

    return { 
      success: true, 
      data: response.data 
    };
  } catch (error: any) {
    console.error('updateUserInfo error:', error.response?.data || error.message);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message 
    };
  }
};

// ✅ Change user email
export const changeUserEmail = async (userId: string, newEmail: string) => {
  try {
    console.log('API Request - user_id:', userId, 'email:', newEmail);

    // Backend expects FormData with parameters wrapped in "data" field
    const formData = new FormData();
    formData.append("data", JSON.stringify({
      user_id: userId,
      email: newEmail,
    }));

    const response = await api.post("/users/email/change", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('API Response:', response.data);

    // Check if the response indicates an error
    if (response.data?.error === true) {
      return {
        success: false,
        message: response.data.message || "Email update failed"
      };
    }

    return {
      success: true,
      data: response.data,
      message: response.data?.message
    };
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Network error"
    };
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
