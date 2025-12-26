import { useCallback, useState, useRef } from 'react';
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
  // ✅ 改用消息 ID 数组而不是索引数组
  const [matchedMessageIds, setMatchedMessageIds] = useState<string[]>([]);
  const [currentMatchId, setCurrentMatchId] = useState<string>('');

  const enableSearch = useCallback(() => {
    setSearchMode(true);
  }, []);

  const disableSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery('');
    setMatchedMessageIds([]);
    setCurrentMatchId('');
  }, []);

  /**
   * Filter messages based on search query
   * ✅ Returns ALL messages (no filtering), but calculates matched message IDs
   * @param messages - Array of messages to search
   * @returns All messages (no filtering applied)
   */
  const filterMessages = useCallback((messages: any[]) => {
    // Reset matches when query is empty
    if (!searchQuery.trim()) {
      setMatchedMessageIds([]);
      setCurrentMatchId('');
      return messages;
    }

    // ✅ Find all matched message IDs (not indices)
    const matchedIds: string[] = [];
    const query = searchQuery.toLowerCase();

    messages.forEach((msg) => {
      const messageText = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
      if (messageText.toLowerCase().includes(query)) {
        matchedIds.push(msg.id);
      }
    });

    setMatchedMessageIds(matchedIds);

    // ✅ Set current match ID
    if (matchedIds.length > 0) {
      // If current match ID is still in the new matches, keep it
      if (currentMatchId && matchedIds.includes(currentMatchId)) {
        // Keep current position - do nothing
      } else {
        // Reset to first match
        setCurrentMatchId(matchedIds[0]);
      }
    } else {
      setCurrentMatchId('');
    }

    return messages;
  }, [searchQuery, currentMatchId]);

  /**
   * Navigate to next matched message
   * @returns The message ID of the next match, or empty string if no matches
   */
  const goToNextMatch = useCallback((messages: any[]) => {
    if (matchedMessageIds.length === 0) return '';

    const currentIndex = matchedMessageIds.indexOf(currentMatchId);
    const nextIndex = (currentIndex + 1) % matchedMessageIds.length;
    const nextMatchId = matchedMessageIds[nextIndex];

    setCurrentMatchId(nextMatchId);
    return nextMatchId;
  }, [matchedMessageIds, currentMatchId]);

  /**
   * Navigate to previous matched message
   * @returns The message ID of the previous match, or empty string if no matches
   */
  const goToPrevMatch = useCallback((messages: any[]) => {
    if (matchedMessageIds.length === 0) return '';

    const currentIndex = matchedMessageIds.indexOf(currentMatchId);
    const prevIndex = currentIndex <= 0
      ? matchedMessageIds.length - 1
      : currentIndex - 1;
    const prevMatchId = matchedMessageIds[prevIndex];

    setCurrentMatchId(prevMatchId);
    return prevMatchId;
  }, [matchedMessageIds, currentMatchId]);

  /**
   * Get total number of matches
   */
  const totalMatches = matchedMessageIds.length;

  /**
   * Get current match number (1-indexed for display)
   */
  const currentMatchNumber = matchedMessageIds.length > 0 && currentMatchId
    ? matchedMessageIds.indexOf(currentMatchId) + 1
    : 0;

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
    matchedMessageIds,  // ✅ 返回消息 ID 数组
    currentMatchId,     // ✅ 返回当前匹配的消息 ID
    currentMatchNumber,
    totalMatches,
    goToNextMatch,
    goToPrevMatch,
  };
}
