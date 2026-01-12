/**
 * Shared styles for ChatRoomScreen and GroupRoomScreen
 *
 * This file contains all common styles used by both single chat and group chat screens.
 * Each screen can extend these base styles with their own specific styles.
 */

import { StyleSheet as RNStyleSheet } from 'react-native';
import { borders, colors, typography } from './index';

// Responsive scaling functions
import { Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');
const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

/**
 * Base styles shared between ChatRoom and GroupRoom
 */
export const baseRoomStyles = RNStyleSheet.create({
  // Container
  safeArea: {
    flex: 1
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.yellowBright,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.grayLight,
  },
  backButton: {
    padding: scaleWidth(4),
  },
  moreButton: {
    padding: scaleWidth(4),
  },
  iconButton: {
    padding: scaleWidth(4),
  },
 friendDeletedWarning: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFF3F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0E0',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 8,
    marginRight: 12,
  },
  reAddButton: {
    backgroundColor: '#FFD966',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reAddButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#333',
  },
  
  // ✅ 禁用的输入栏
  disabledInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  disabledInputText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  // Search header
  searchInput: {
    flex: 1,
    height: scaleHeight(36),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius18,
    paddingHorizontal: scaleWidth(12),
    fontSize: scaleFont(14),
    color: colors.text.dark,
    marginHorizontal: scaleWidth(8),
  },
  searchResultText: {
    fontSize: scaleFont(12),
    color: colors.text.grayMedium,
    marginRight: scaleWidth(8),
  },

  // ✅ Search navigation controls
  searchNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scaleWidth(8),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius18,
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleWidth(4),
  },
  navButton: {
    padding: scaleWidth(4),
  },
  matchCounter: {
    fontSize: scaleFont(13),
    color: colors.text.dark,
    marginHorizontal: scaleWidth(6),
    fontWeight: typography.fontWeight600,
    minWidth: scaleWidth(40),
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: scaleHeight(12),
    fontSize: scaleFont(14),
    color: colors.text.grayDark,
  },
  typingIndicator: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(4),
    fontSize: scaleFont(12),
    color: colors.text.grayDark,
    fontStyle: 'italic',
  },

  // Keyboard
  keyboardAvoidingView: {
    flex: 1
  },

  // Chat list
  chatList: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(16),
  },

  // Message rows
  messageRow: {
    flexDirection: 'row',
    marginVertical: scaleHeight(6),
    alignItems: 'flex-start',
  },
  messageRowLeft: {
    justifyContent: 'flex-start'
  },
  messageRowRight: {
    justifyContent: 'flex-end'
  },

  // Avatar
  avatar: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: borders.radius4,
    backgroundColor: colors.background.white,
    marginHorizontal: scaleWidth(8),
    overflow: 'hidden',
  },
  avatarImage: {
    width: scaleWidth(40),
    height: scaleWidth(40),
  },

  // Message bubble
  bubble: {
    maxWidth: '60%',
    borderRadius: borders.radius4,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
  },
  bubbleLeft: {
    backgroundColor: colors.background.white
  },
  bubbleRight: {
    backgroundColor: colors.functional.green
  },

  // Message text
  messageText: {
    fontSize: scaleFont(14),
    color: colors.text.blackMedium,
    lineHeight: scaleHeight(22),
  },

  // Timestamp
  timestamp: {
    fontSize: scaleFont(11),
    color: colors.text.grayDark,
    marginTop: scaleHeight(4),
    opacity: 0.7,
  },

  // Input section
  inputSection: {
    backgroundColor: colors.background.grayLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.gradientYellow[1],
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(12),
    borderTopWidth: borders.width1,
    borderTopColor: colors.border.grayLight,
  },
  // iconButton: {
  //   padding: scaleWidth(8),
  // },
  input: {
    flex: 1,
    minHeight: scaleHeight(36),
    maxHeight: scaleHeight(100),
    backgroundColor: colors.background.white,
    borderRadius: borders.radius10,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
    fontSize: scaleFont(16),
    color: colors.text.blackMedium,
  },

  // Toolbar (attachment options)
  toolbar: {
    backgroundColor: colors.background.grayLight,
    paddingVertical: scaleHeight(20),
    paddingHorizontal: scaleWidth(10),
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scaleHeight(10),
  },
  toolbarButton: {
    alignItems: 'center',
    width: scaleWidth(70),
  },
  toolbarIconContainer: {
    width: scaleWidth(50),
    height: scaleWidth(50),
    borderRadius: borders.radius8,
    backgroundColor: colors.background.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(6),
  },
  toolbarLabel: {
    fontSize: scaleFont(12),
    color: colors.text.blackMedium,
    textAlign: 'center',
  },

  // Voice message styles
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(4),
    borderRadius: borders.radius16,
    maxWidth: scaleWidth(260),
    minWidth: scaleWidth(150),
  },
  voicePlayButton: {
    width: scaleWidth(35),
    height: scaleWidth(35),
    borderRadius: scaleWidth(24),
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(12),
  },
  voiceInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  voiceMessageText: {
    fontSize: scaleFont(14),
    color: colors.text.blackMedium,
    lineHeight: scaleHeight(22),
    marginBottom: scaleHeight(2),
  },
  voiceDuration: {
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: '#667eea',
    letterSpacing: 0.3,
  },

  // Image message styles
  imageGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(4),
    marginBottom: scaleHeight(4),
  },
  messageImage: {
    width: scaleWidth(120),
    height: scaleWidth(120),
    borderRadius: borders.radius8,
    backgroundColor: colors.background.grayLight,
  },
});

/**
 * Styles specific to ChatRoomScreen (single chat)
 */
export const chatRoomSpecificStyles = RNStyleSheet.create({
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.blackMedium,
    flex: 1,
    textAlign: 'center', // Single chat title is centered
  },

  // Empty state (only shown in single chat)
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scaleHeight(60),
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: colors.text.grayLight,
    marginTop: scaleHeight(12),
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: colors.text.grayMedium,
    marginTop: scaleHeight(6),
  },
});

/**
 * Styles specific to GroupRoomScreen (group chat)
 */
export const groupRoomSpecificStyles = RNStyleSheet.create({
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight500,
    color: colors.text.blackMedium,
    // No textAlign - group chat title is not centered in flex container
  },
  headerSubtitle: {
    fontSize: typography.fontSize12,
    color: colors.text.grayDark,
    marginTop: scaleHeight(2),
  },

  // Sender name (only shown in group chat)
  senderName: {
    fontWeight: typography.fontWeight600,
    marginBottom: scaleHeight(2),
    fontSize: typography.fontSize12, // Smaller font for group sender names
    color: colors.text.grayDark,
  },

  // Loading footer for pagination
  loadingFooter: {
    paddingVertical: scaleHeight(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Helper to merge base styles with specific styles
 */
export const createRoomStyles = (specificStyles: any) => {
  return {
    ...baseRoomStyles,
    ...specificStyles,
  };
};
