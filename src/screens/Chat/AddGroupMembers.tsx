import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateGroup } from '../../api/Chat';
import { readFriends } from '../../api/Friend';
import { ensureFullImageUrl } from '../../api/service';
import { useUserStore } from '../../store/userStore';
import { borders, colors, typography } from '../../styles';

interface Friend {
  user_id: string;
  name: string;
  image: string;
}

interface RouteParams {
  chatId: string;
  chatName: string;
  currentMembers: string[];
}

export default function AddGroupMembers() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { chatId, chatName, currentMembers } = route.params as RouteParams;

  const currentUserId = useUserStore((state) => state.user?.id) || '';

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Load friends list
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const result = await readFriends(2); // Get accepted friends

      if (result.success && result.data) {
        // ✅ Correctly extract friend IDs from request and approve arrays
        const friendsList: Friend[] = [];

        // From request array: I am request_id, friend is approve_id
        if (result.data.request) {
          result.data.request.forEach((friend: any) => {
            const friendId = friend.approve_id; // ✅ Friend is the approve_id
            if (friendId && !currentMembers.includes(friendId)) {
              friendsList.push({
                user_id: friendId,
                name: friend.name || friend.username || '未知',
                image: friend.image || '',
              });
            }
          });
        }

        // From approve array: I am approve_id, friend is request_id
        if (result.data.approve) {
          result.data.approve.forEach((friend: any) => {
            const friendId = friend.request_id; // ✅ Friend is the request_id
            if (friendId && !currentMembers.includes(friendId)) {
              friendsList.push({
                user_id: friendId,
                name: friend.name || friend.username || '未知',
                image: friend.image || '',
              });
            }
          });
        }

        console.log('📥 [AddGroupMembers] Loaded friends:', {
          total: friendsList.length,
          filtered: friendsList.filter(f => !currentMembers.includes(f.user_id)).length,
          currentMembers: currentMembers,
        });

        setFriends(friendsList);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
      Alert.alert('错误', '加载好友列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleAddMembers = async () => {
    if (selectedFriends.size === 0) {
      Alert.alert('提示', '请至少选择一位好友');
      return;
    }

    setIsAdding(true);

    try {
      // Add members one by one (API only supports one target_id at a time)
      const selectedArray = Array.from(selectedFriends);
      const results = await Promise.all(
        selectedArray.map(async (friendId) => {
          const result = await updateGroup({
            chat_id: chatId,
            user_id: currentUserId,
            action: 'add',
            target_id: friendId,
          });
          return { friendId, success: result.success, message: result.message };
        })
      );

      // Check results
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        Alert.alert(
          '添加成功',
          `成功添加 ${successCount} 位成员${failureCount > 0 ? `，${failureCount} 位添加失败` : ''}`,
          [
            {
              text: '确定',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('添加失败', '所有成员添加失败，请重试');
      }
    } catch (error) {
      console.error('Failed to add members:', error);
      Alert.alert('错误', '添加成员失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => {
    const isSelected = selectedFriends.has(item.user_id);
    const avatarUrl = ensureFullImageUrl(item.image);

    return (
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => toggleFriendSelection(item.user_id)}
        disabled={isAdding}
      >
        <View style={styles.friendLeft}>
          <Image
            source={
              avatarUrl
                ? { uri: avatarUrl }
                : require('../../assets/images/personal.png')
            }
            style={styles.friendAvatar}
          />
          <Text style={styles.friendName}>{item.name}</Text>
        </View>
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={18} color={colors.text.white} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={colors.text.grayLight} />
      <Text style={styles.emptyText}>没有可添加的好友</Text>
      <Text style={styles.emptySubtext}>所有好友都已在群聊中</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isAdding}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加群成员</Text>
        <TouchableOpacity
          style={styles.headerRightButton}
          onPress={handleAddMembers}
          disabled={isAdding || selectedFriends.size === 0}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.functional.blue} />
          ) : (
            <Text
              style={[
                styles.headerRightText,
                selectedFriends.size === 0 && styles.headerRightTextDisabled,
              ]}
            >
              确定
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {selectedFriends.size > 0 && (
        <View style={styles.selectedBar}>
          <Text style={styles.selectedText}>
            已选择 {selectedFriends.size} 位好友
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.functional.yellow} />
          <Text style={styles.loadingText}>加载好友列表...</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={
            friends.length === 0 ? styles.emptyListContainer : styles.listContainer
          }
          ListEmptyComponent={renderEmptyList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.chatBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.background.yellowLight,
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
    textAlign: 'center',
  },
  headerRightButton: {
    paddingLeft: 10,
    minWidth: 50,
    alignItems: 'flex-end',
  },
  headerRightText: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
    color: colors.functional.blue,
  },
  headerRightTextDisabled: {
    color: colors.text.grayLight,
  },
  selectedBar: {
    backgroundColor: colors.background.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.light,
  },
  selectedText: {
    fontSize: typography.fontSize14,
    color: colors.functional.blue,
    fontWeight: typography.fontWeight500,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSize14,
    color: colors.text.grayDark,
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.light,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: borders.radius24,
    backgroundColor: colors.background.grayLight,
    marginRight: 12,
  },
  friendName: {
    fontSize: typography.fontSize16,
    color: colors.text.dark,
    fontWeight: typography.fontWeight500,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borders.radius12,
    borderWidth: borders.width2,
    borderColor: colors.border.gray,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.white,
  },
  checkboxSelected: {
    backgroundColor: colors.functional.blue,
    borderColor: colors.functional.blue,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.gray,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
    marginTop: 8,
    textAlign: 'center',
  },
});
