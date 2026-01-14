import api from './service';

export const login = async ({ phone, passcode }: { phone: string; passcode: string}) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({ phone, passcode })
    );

    const response = await api.post('/login', formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data; // { error, message, response }
  } catch (error: any) {
    console.log("登录失败返回:", error.response?.data || error.message);
    return {
      error: true,
      message: error.response?.data?.message || "登录失败",
    };
  }
};

export const updatePushToken = async (userId: string, pushToken: string) => {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({ user_id: userId, push_token: pushToken })
    );

    const response = await api.post('/push/token/update', formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
  } catch (error: any) {
    console.error('[updatePushToken] Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    return {
      error: true,
      message: error.response?.data?.message || error.message,
    };
  }
};
