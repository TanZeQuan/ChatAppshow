import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SearchHeaderProps {
  // Search mode state
  searchMode: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  disableSearch: () => void;

  // Search navigation
  totalMatches: number;
  currentMatchNumber: number;
  handlePrevMatch: () => void;
  handleNextMatch: () => void;

  // Normal mode header
  chatName: string;
  onBack: () => void;
  onOpenSettings: () => void;

  // Styles
  roomStyles: any;

  // Optional call button
  showCallButton?: boolean;
  onStartCall?: () => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchMode,
  searchQuery,
  setSearchQuery,
  disableSearch,
  totalMatches,
  currentMatchNumber,
  handlePrevMatch,
  handleNextMatch,
  chatName,
  onBack,
  onOpenSettings,
  roomStyles,
  showCallButton,
  onStartCall,
}) => {
  if (searchMode) {
    // ✅ 方案1: 搜索模式 - 显示返回箭头和X按钮
    return (
      <View style={roomStyles.header}>
        {/* ✅ 左边: 返回箭头 - 直接返回上一屏 (ChatListScreen) */}
        <TouchableOpacity 
          style={roomStyles.backButton} 
          onPress={() => {
            console.log('🔙 [SearchHeader] Back arrow pressed - returning to ChatList');
            disableSearch(); // 先关闭搜索
            onBack(); // 然后返回上一屏
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>

        {/* 搜索输入框 */}
        <TextInput
          style={roomStyles.searchInput}
          placeholder="搜索消息..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />

        {/* 搜索结果导航 */}
        {totalMatches > 0 && (
          <View style={roomStyles.searchNavigation}>
            <TouchableOpacity
              style={roomStyles.navButton}
              onPress={handlePrevMatch}
              disabled={totalMatches === 0}
            >
              <Ionicons name="chevron-up" size={20} color={totalMatches > 0 ? "#333" : "#999"} />
            </TouchableOpacity>
            <Text style={roomStyles.matchCounter}>
              {currentMatchNumber}/{totalMatches}
            </Text>
            <TouchableOpacity
              style={roomStyles.navButton}
              onPress={handleNextMatch}
              disabled={totalMatches === 0}
            >
              <Ionicons name="chevron-down" size={20} color={totalMatches > 0 ? "#333" : "#999"} />
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ 右边: X按钮 - 只关闭搜索，停留在聊天页面 */}
        <TouchableOpacity 
          style={roomStyles.iconButton} 
          onPress={() => {
            console.log('❌ [SearchHeader] X button pressed - close search only');
            disableSearch();
          }}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    );
  }

  // 普通模式 header
  return (
    <View style={roomStyles.header}>
      {/* 返回箭头 - 返回上一屏 */}
      <TouchableOpacity 
        style={roomStyles.backButton} 
        onPress={() => {
          console.log('🔙 [SearchHeader] Normal mode back button pressed');
          onBack();
        }}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={roomStyles.headerTitle}>{chatName}</Text>
      <View style={{flexDirection: 'row'}}>
        {showCallButton && (
          <TouchableOpacity style={roomStyles.moreButton} onPress={onStartCall}>
            <Ionicons name="call-outline" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={roomStyles.moreButton} onPress={onOpenSettings}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
};