import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useChatStore } from '../store/chatStore';

/**
 * Custom Hook: Clear chat history (local store only)
 *
 * @param chatId - The chat ID to clear
 * @param chatName - The chat name for confirmation dialog
 * @returns Object with handleClearHistory function and isClearing state
 *
 * @example
 * const { handleClearHistory, isClearing } = useClearChatHistory(chatId, chatName);
 * <TouchableOpacity onPress={handleClearHistory} disabled={isClearing}>
 */
export function useClearChatHistory(chatId: string, chatName: string) {
  const [isClearing, setIsClearing] = useState(false);
  const { clearChat } = useChatStore();

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      '清空聊天记录',
      `确定要清空 "${chatName}" 的所有聊天记录吗？此操作不可恢复。`,
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);

              // Clear local store
              clearChat(chatId);

              // Success feedback
              Alert.alert('成功', '聊天记录已清空');
            } catch (error) {
              console.error('Clear chat history error:', error);
              Alert.alert('错误', '清空聊天记录失败，请重试');
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  }, [chatId, chatName, clearChat]);

  return { handleClearHistory, isClearing };
}

/**
 * Custom Hook: Search chat history (local messages)
 *
 * Provides search functionality for filtering messages by text content
 * with navigation between matched messages
 *
 * @returns Object with search state and handlers
 *
 * @example
 * const {
 *   searchMode,
 *   searchQuery,
 *   enableSearch,
 *   disableSearch,
 *   setSearchQuery,
 *   filterMessages,
 *   matchedIndices,
 *   currentMatchIndex,
 *   totalMatches,
 *   goToNextMatch,
 *   goToPrevMatch
 * } = useSearchChatHistory();
 *
 * const filteredMessages = filterMessages(messages);
 */
export function useSearchChatHistory() {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedIndices, setMatchedIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const enableSearch = useCallback(() => {
    setSearchMode(true);
  }, []);

  const disableSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery('');
    setMatchedIndices([]);
    setCurrentMatchIndex(0);
  }, []);

  /**
   * Filter messages based on search query
   * ✅ Returns ALL messages (no filtering), but calculates matched indices
   * @param messages - Array of messages to search
   * @returns All messages (no filtering applied)
   */
  const filterMessages = useCallback((messages: any[]) => {
    // Reset matches when query is empty
    if (!searchQuery.trim()) {
      setMatchedIndices([]);
      setCurrentMatchIndex(0);
      return messages;
    }

    // Find all matched message indices
    const matches: number[] = [];
    const query = searchQuery.toLowerCase();

    messages.forEach((msg, index) => {
      const messageText = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
      if (messageText.toLowerCase().includes(query)) {
        matches.push(index);
      }
    });

    setMatchedIndices(matches);

    // Reset to first match when matches change
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
    } else {
      setCurrentMatchIndex(0);
    }

    // ✅ Always return all messages, highlighting is handled by UI
    return messages;
  }, [searchQuery]);

  /**
   * Navigate to next matched message
   */
  const goToNextMatch = useCallback(() => {
    if (matchedIndices.length === 0) return -1;

    const nextIndex = (currentMatchIndex + 1) % matchedIndices.length;
    setCurrentMatchIndex(nextIndex);
    return matchedIndices[nextIndex];
  }, [matchedIndices, currentMatchIndex]);

  /**
   * Navigate to previous matched message
   */
  const goToPrevMatch = useCallback(() => {
    if (matchedIndices.length === 0) return -1;

    const prevIndex = currentMatchIndex === 0
      ? matchedIndices.length - 1
      : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    return matchedIndices[prevIndex];
  }, [matchedIndices, currentMatchIndex]);

  /**
   * Get total number of matches
   */
  const totalMatches = matchedIndices.length;

  /**
   * Get current match number (1-indexed for display)
   */
  const currentMatchNumber = matchedIndices.length > 0 ? currentMatchIndex + 1 : 0;

  /**
   * Highlight matched text in message
   * Returns the original text (highlighting can be done in UI layer)
   */
  const highlightMatch = useCallback((text: string) => {
    // This is a simple utility, actual highlighting should be done in the UI
    return text;
  }, []);

  return {
    searchMode,
    searchQuery,
    enableSearch,
    disableSearch,
    setSearchQuery,
    filterMessages,
    highlightMatch,
    matchedIndices,
    currentMatchIndex,
    currentMatchNumber,
    totalMatches,
    goToNextMatch,
    goToPrevMatch,
  };
}
