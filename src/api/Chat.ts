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

        // console.log("readChatMessages payload:", dataPayload);

        const response = await api.post("/chats/message/read", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        // console.log("readChatMessages response:", response.data);

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

    if (payload.message) {
      dataPayload.message = payload.message;
    }

    if (payload.files) {
        dataPayload.files = payload.files.length;
    }

    formData.append("data", JSON.stringify(dataPayload));

    // 2. Append voice file if it exists
    if (payload.voice) {
      formData.append("voice", {
        uri: payload.voice.uri,
        name: payload.voice.name,
        type: payload.voice.type,
      } as any);
    }

    // 3. Append other files if they exist
    if (payload.files) {
      payload.files.forEach((file, index) => {
        formData.append(`files_${index}`, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });
    }

    console.log("sendChatMessage payload:", JSON.stringify(dataPayload, null, 2));

    const response = await api.post("/chats/message/new", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    console.log("sendChatMessage response:", response.data);

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
      "sendChatMessage error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
};