import api from './service';

// ------------------ Payload 类型 ------------------
export interface RegisterPayload {
    name: string;
    phone: string;
    email: string;
    password: string;
}

export interface LoginPayload {
    phone: string;
    password: string;
}

export interface SendOTPPayload {
    email: string;
}

export interface VerifyOTPPayload {
    email: string;
    otp: string;
}

export interface ResetPasswordPayload {
    password: string;
}

export interface ChangeEmailPayload {
    user_id: string;
    email: string;
}

export interface UpdateProfilePayload {
    user_id: string;
    name?: string;
    about?: string;
    image?: {
        uri: string;
        name?: string;
        type?: string;
    };
}

// ------------------ API 方法 ------------------

// 注册
export const register = async (payload: RegisterPayload) => {
    const formData = new FormData();
    formData.append(
        'data',
        JSON.stringify({
            phone: payload.phone,
            passcode: payload.password,
            email: payload.email,
            roles: 'user',
            status: 1,
            name: payload.name,
        })
    );

    const res = await api.post('/users/new', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// 登录
export const login = async (payload: LoginPayload) => {
    const formData = new FormData();
    formData.append(
        'data',
        JSON.stringify({
            phone: payload.phone,
            passcode: payload.password,
        })
    );

    const res = await api.post('/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// 发送 OTP
export const sendOTP = async (payload: SendOTPPayload) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify({ email: payload.email }));

    const res = await api.post('/forget/otp/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// 验证 OTP
export const verifyOTP = async (payload: VerifyOTPPayload) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify({ email: payload.email, otp: payload.otp }));

    const res = await api.post('/forget/otp/verify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// 重置密码
export const resetPassword = async (payload: ResetPasswordPayload) => {
    const res = await api.post('/forget/password/reset', payload);
    return res.data;
};

// 修改邮箱
export const changeEmail = async (payload: ChangeEmailPayload) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(payload));

    const res = await api.post('/users/email/change', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// 更新用户信息
export const updateProfile = async (payload: UpdateProfilePayload) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify({
        user_id: payload.user_id,
        name: payload.name || '',
        about: payload.about || '',
    }));

    if (payload.image) {
        formData.append('image', {
            uri: payload.image.uri,
            name: payload.image.name || 'avatar.jpg',
            type: payload.image.type || 'image/jpeg',
        } as any);
    }

    const res = await fetch(`${api.defaults.baseURL}/users/info/update`, {
        method: 'POST',
        body: formData,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.message || '更新失败');
    return json;
};
