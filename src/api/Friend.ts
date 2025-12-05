import api from './service';

// Add this search user function
export const searchUser = async (userId: string, token?: string) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            user_id: userId,
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("searchUser payload:", dataPayload);

        const response = await api.post("/chats/users/search", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                ...(token && { "Authorization": `Bearer ${token}` }),
            },
        });

        console.log("searchUser response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Search failed",
                user: null,
            };
        }

        return {
            success: true,
            user: response.data.response || response.data.user || null,
        };
    } catch (error: any) {
        console.error(
            "searchUser error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
            user: null,
        };
    }
};

export const createFriendRequest = async (
    requestId: string,
    approveId: string,
    message?: string
) => {
    try {
        const formData = new FormData();

        const dataPayload: any = {
            request_id: requestId,
            approve_id: approveId,
        };

        if (message !== undefined) {
            dataPayload.message = message;
        }

        formData.append("data", JSON.stringify(dataPayload));

        console.log("createFriendRequest payload:", dataPayload);

        const response = await api.post("/chats/friends/new", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        console.log("createFriendRequest response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Request failed",
            };
        }

        return {
            success: true,
            data: response.data,
        };
    } catch (error: any) {
        console.error(
            "createFriendRequest error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};

export const readFriends = async ({
    user_id,
    request_id,
    approve_id,
    isstatus = 1,
}: {
    user_id: string;
    request_id: string;
    approve_id: string;
    isstatus?: number;
}) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            user_id,
            request_id,
            approve_id,
            isstatus,
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("readFriends payload:", dataPayload);

        const response = await api.post("/chats/friends/read", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        console.log("readFriends response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Read failed",
            };
        }

        return {
            success: true,
            data: {
                approve: response.data.response?.approve || [],
                request: response.data.response?.request || [],
            },
        };
    } catch (error: any) {
        console.error(
            "readFriends error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};

export const updateFriendStatus = async (
    listId: string,
    isstatus: number
) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            list_id: listId,
            isstatus,
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("updateFriendStatus payload:", dataPayload);

        const response = await api.post("/chats/friends/update", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        console.log("updateFriendStatus response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Update failed",
            };
        }

        return {
            success: true,
            data: response.data,
        };
    } catch (error: any) {
        console.error(
            "updateFriendStatus error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};

// Add getFriendRequests if you don't have it
export const getFriendRequests = async (token: string, isstatus: number, p0: string) => {
    try {
        const formData = new FormData();

        const dataPayload = {
            isstatus,
        };

        formData.append("data", JSON.stringify(dataPayload));

        console.log("getFriendRequests payload:", dataPayload);

        const response = await api.post("/chats/friends/requests", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                "Authorization": `Bearer ${token}`,
            },
        });

        console.log("getFriendRequests response:", response.data);

        if (response.data?.error === true) {
            return {
                success: false,
                message: response.data.message || "Request failed",
            };
        }

        return {
            success: true,
            response: response.data.response,
        };
    } catch (error: any) {
        console.error(
            "getFriendRequests error:",
            error.response?.data || error.message
        );
        return {
            success: false,
            message: error.response?.data?.message || error.message,
        };
    }
};