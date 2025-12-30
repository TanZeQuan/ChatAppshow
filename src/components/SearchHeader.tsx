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
}) => {
  if (searchMode) {
    // Search mode header
    return (
      <View style={roomStyles.header}>
        <TextInput
          style={roomStyles.searchInput}
          placeholder="搜索消息..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {/* Navigation controls */}
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
        <TouchableOpacity style={roomStyles.iconButton} onPress={disableSearch}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    );
  }

  // Normal mode header
  return (
    <View style={roomStyles.header}>
      <TouchableOpacity style={roomStyles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={roomStyles.headerTitle}>{chatName}</Text>
      <View style={{flexDirection: 'row'}}>
        <TouchableOpacity style={roomStyles.moreButton} onPress={onOpenSettings}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
