import api from './service';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Send OTP for password reset */
export const sendOtpForPasswordReset = async (email: string): Promise<ApiResponse> => {
  try {
    const formData = new FormData();
    formData.append('data', JSON.stringify({ email }));

    const response = await api.post('/forget/otp/send', formData);

    return {
      success: true,
      data: response.data,
      message: response.data.message || 'OTP 已发送',
    };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

/** Verify OTP code */
export const verifyOtpCode = async (email: string, otp: string): Promise<ApiResponse<{ user_id: string }>> => {
  try {
    const formData = new FormData();
    formData.append('data', JSON.stringify({ email, otp }));

    const response = await api.post('/forget/otp/verify', formData);

    return {
      success: true,
      data: response.data,
      message: response.data.message || 'OTP 验证成功',
    };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};

/** Reset password using user_id returned from OTP verification */
export const resetPassword = async (userId: string, newPassword: string): Promise<ApiResponse> => {
  try {
    const formData = new FormData();
    formData.append('data', JSON.stringify({ user_id: userId, passcode: newPassword }));

    const response = await api.post('/forget/password/reset', formData);

    return {
      success: true,
      data: response.data,
      message: response.data.message || '密码重置成功',
    };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
};
