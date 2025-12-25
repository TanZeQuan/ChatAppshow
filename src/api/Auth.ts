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
