import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Dimensions, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get("window");
const scaleWidth = (size: number) => (width / 375) * size;

interface ToolbarButtonProps {
  icon: string;
  label: string;
  onPress?: () => void;
}

interface ChatInputBarProps {
  // Input state
  inputText: string;
  setInputText: (text: string) => void;

  // Voice recording state
  isRecording: boolean;
  isUploading: boolean;
  startRecording: () => void;
  stopRecording: () => void;

  // Emoji picker state
  isEmojiPickerOpen: boolean;
  toggleEmojiPicker: () => void;

  // Toolbar state
  showToolbar: boolean;
  toggleToolbar: () => void;

  // Handlers
  handleSend: () => void;

  // Toolbar buttons configuration
  toolbarButtons: {
    row1: ToolbarButtonProps[];
    row2: ToolbarButtonProps[];
  };

  // Styles
  roomStyles: any;
}

const ToolbarButton: React.FC<ToolbarButtonProps & { roomStyles: any }> = ({
  icon,
  label,
  onPress,
  roomStyles
}) => (
  <TouchableOpacity style={roomStyles.toolbarButton} onPress={onPress}>
    <View style={roomStyles.toolbarIconContainer}>
      <Ionicons name={icon as any} size={scaleWidth(24)} color="#333" />
    </View>
    <Text style={roomStyles.toolbarLabel}>{label}</Text>
  </TouchableOpacity>
);

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputText,
  setInputText,
  isRecording,
  isUploading,
  startRecording,
  stopRecording,
  isEmojiPickerOpen,
  toggleEmojiPicker,
  showToolbar,
  toggleToolbar,
  handleSend,
  toolbarButtons,
  roomStyles,
}) => {
  return (
    <View style={roomStyles.inputSection}>
      <View style={roomStyles.inputContainer}>
        <TouchableOpacity
          style={roomStyles.iconButton}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#333" size={scaleWidth(20)} />
          ) : (
            <Ionicons name="mic" size={scaleWidth(22)} color={isRecording ? 'red' : '#333'} />
          )}
        </TouchableOpacity>

        <TextInput
          style={roomStyles.input}
          placeholder="输入消息..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity style={roomStyles.iconButton} onPress={toggleEmojiPicker}>
          <Ionicons
            name={isEmojiPickerOpen ? "close-circle" : "happy-outline"}
            size={scaleWidth(22)}
            color="#333"
          />
        </TouchableOpacity>

        {inputText.trim() ? (
          <TouchableOpacity style={roomStyles.iconButton} onPress={handleSend}>
            <Ionicons name="send" size={scaleWidth(22)} color="#333" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={roomStyles.iconButton} onPress={toggleToolbar}>
            <Ionicons
              name={showToolbar ? 'close-circle-outline' : 'add-circle-outline'}
              size={scaleWidth(22)}
              color="#333"
            />
          </TouchableOpacity>
        )}
      </View>

      {showToolbar && (
        <View style={roomStyles.toolbar}>
          <View style={roomStyles.toolbarRow}>
            {toolbarButtons.row1.map((button, index) => (
              <ToolbarButton
                key={index}
                {...button}
                roomStyles={roomStyles}
              />
            ))}
          </View>
          <View style={roomStyles.toolbarRow}>
            {toolbarButtons.row2.map((button, index) => (
              <ToolbarButton
                key={index}
                {...button}
                roomStyles={roomStyles}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
