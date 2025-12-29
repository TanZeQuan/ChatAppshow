import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
import { readChatMessages, updateGroup } from '../../api/Chat';
import { ensureFullImageUrl } from '../../api/service';
import { useContactStore } from '../../store/contactStore';
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
  const allContacts = useContactStore((state) => state.contacts); // ✅ Get contacts from store

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [latestMemberIds, setLatestMemberIds] = useState<string[]>([]); // ✅ Latest member IDs from API

  // Load friends list
  const loadFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ Step 1: Get latest group members from API
      console.log('📥 [AddGroupMembers] Loading latest group members...');
      const groupResult = await readChatMessages({
        chat_id: chatId,
        user_id: currentUserId,
        offset: 0,
      });

      let currentMemberIds: string[] = currentMembers; // Default to route params

      if (groupResult.success && groupResult.data?.group && Array.isArray(groupResult.data.group)) {
        // Use latest member IDs from API
        currentMemberIds = groupResult.data.group.map((m: any) => m.user_id);
        setLatestMemberIds(currentMemberIds);
        console.log('✅ [AddGroupMembers] Got latest members:', currentMemberIds);
      } else {
        console.warn('⚠️ [AddGroupMembers] Failed to load group members, using route params');
      }

      // ✅ Step 2: Get friends from contactStore
      console.log('📥 [AddGroupMembers] Loading friends from contactStore:', {
        totalContacts: allContacts.length,
        contacts: allContacts,
      });

      // Filter out members already in the group
      const friendsList: Friend[] = allContacts
        .filter(contact => {
          const isInGroup = currentMemberIds.includes(contact.id);
          console.log('📥 [AddGroupMembers] Checking contact:', {
            id: contact.id,
            name: contact.name,
            isInGroup,
          });
          return !isInGroup; // Only include friends NOT in the group
        })
        .map(contact => ({
          user_id: contact.id,
          name: contact.name,
          image: contact.avatar || '',
        }));

      console.log('📥 [AddGroupMembers] Filtered friends:', {
        total: friendsList.length,
        currentMembers: currentMemberIds.length,
        currentMemberIds,
        friendsList,
      });

      setFriends(friendsList);
    } catch (error) {
      console.error('Failed to load friends:', error);
      Alert.alert('错误', '加载好友列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, currentUserId, currentMembers, allContacts]);

  useEffect(() => {
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContacts]);

  // ✅ Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [AddGroupMembers] Screen focused, reloading friends...');
      loadFriends();
    }, [loadFriends])
  );

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
      console.log('➕ [AddMembers] Adding members:', {
        chatId,
        currentUserId,
        selectedFriends: selectedArray,
        totalCount: selectedArray.length,
      });

      const results = await Promise.all(
        selectedArray.map(async (friendId) => {
          console.log(`➕ [AddMembers] Adding friend ${friendId}...`);
          console.log(`➕ [AddMembers] Calling updateGroup with:`, {
            chat_id: chatId,
            user_id: currentUserId,
            action: 'add',
            target_id: friendId,
          });
          const result = await updateGroup({
            chat_id: chatId,
            user_id: currentUserId,
            action: 'add',
            target_id: friendId,
          });
          console.log(`➕ [AddMembers] Result for ${friendId}:`, {
            success: result.success,
            message: result.message,
            data: result.data,
            fullResult: result,
          });
          return { friendId, success: result.success, message: result.message, data: result.data };
        })
      );

      console.log('➕ [AddMembers] All results:', results);

      // Check results
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;
      const failedMembers = results.filter((r) => !r.success);

      console.log('➕ [AddMembers] Summary:', {
        successCount,
        failureCount,
        failedMembers,
      });

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
        const errorMessages = failedMembers.map(f => `${f.friendId}: ${f.message}`).join('\n');
        console.error('❌ [AddMembers] All failed:', errorMessages);
        Alert.alert('添加失败', `所有成员添加失败：\n${errorMessages}`);
      }
    } catch (error) {
      console.error('❌ [AddMembers] Exception:', error);
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
            <Ionicons name="checkmark" size={16} color={colors.text.white} />
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
            <ActivityIndicator size="small" color={colors.functional.green} />
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.yellowLight,
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRightButton: {
    padding: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  headerRightText: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },
  headerRightTextDisabled: {
    color: colors.text.grayLight,
  },
  selectedBar: {
    backgroundColor: colors.background.yellowPale,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: borders.width1,
    borderBottomColor: colors.functional.yellowBright,
  },
  selectedText: {
    fontSize: typography.fontSize14,
    color: colors.text.grayDark,
    fontWeight: typography.fontWeight500,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSize14,
    color: colors.text.grayDark,
  },
  listContainer: {
    paddingTop: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.white,
    paddingVertical: 14,
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
    width: 50,
    height: 50,
    borderRadius: borders.radius25,
    backgroundColor: colors.background.grayLight,
    marginRight: 14,
  },
  friendName: {
    fontSize: typography.fontSize16,
    color: colors.text.dark,
    fontWeight: typography.fontWeight500,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borders.radius4,
    borderWidth: borders.width2,
    borderColor: colors.border.grayMedium,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.white,
  },
  checkboxSelected: {
    backgroundColor: colors.functional.green,
    borderColor: colors.functional.green,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.gray,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontSize14,
    color: colors.text.grayLight,
    marginTop: 8,
    textAlign: 'center',
  },
});
