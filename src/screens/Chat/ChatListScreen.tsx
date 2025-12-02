import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../store/chatStore';
import { useContactStore } from '../../store/contactStore';

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { chats, getLastMessage } = useChatStore();
  const { contacts } = useContactStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Build chat previews from store contacts
  const chatPreviews = useMemo(() => {
    return contacts.map(contact => {
      const messages = chats[contact.id] || [];
      const lastMessage = getLastMessage(contact.id);

      return {
        ...contact,
        lastMessage: lastMessage?.text || '开始聊天',
        time: lastMessage
          ? new Date(lastMessage.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
          : '',
        messageCount: messages.length,
        unread: 0,
      };
    }).sort((a, b) => {
      const aLast = getLastMessage(a.id);
      const bLast = getLastMessage(b.id);
      if (!aLast) return 1;
      if (!bLast) return -1;
      return new Date(bLast.createdAt).getTime() - new Date(aLast.createdAt).getTime();
    });
  }, [contacts, chats, getLastMessage]);

  // Filter chats based on search query
  const filteredChats = chatPreviews.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = (chatId: string, chatName: string) => {
    navigation.navigate('ChatRoom', { chatId, chatName });
  };

  const renderChatItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item.id, item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.time && <Text style={styles.time}>{item.time}</Text>}
            {item.messageCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.messageCount}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.message} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFD966', '#FFB84D']}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>森通</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Chat List */}
      <View style={styles.listContainer}>
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>没有聊天记录</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  gradientHeader: { paddingBottom: scaleHeight(16) },
  header: { paddingHorizontal: scaleWidth(16), paddingVertical: scaleHeight(12), alignItems: 'center' },
  headerTitle: { fontSize: scaleFont(18), fontWeight: '600', color: '#333' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: scaleWidth(16), marginTop: scaleHeight(8), borderRadius: 20, paddingHorizontal: scaleWidth(12), paddingVertical: scaleHeight(8) },
  searchIcon: { marginRight: scaleWidth(8) },
  searchInput: { flex: 1, fontSize: scaleFont(15), color: '#333', padding: 0 },
  listContainer: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: scaleHeight(12) },
  listContent: { paddingHorizontal: scaleWidth(16) },
  chatItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: scaleWidth(12), marginBottom: scaleHeight(8), shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  avatarContainer: { width: scaleWidth(48), height: scaleWidth(48), marginRight: scaleWidth(12) },
  avatar: { width: scaleWidth(48), height: scaleWidth(48), borderRadius: scaleWidth(8) },
  avatarPlaceholder: { width: scaleWidth(48), height: scaleWidth(48), backgroundColor: '#E8E8E8', borderRadius: scaleWidth(8), justifyContent: 'center', alignItems: 'center' },
  chatContent: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scaleHeight(4) },
  badge: { backgroundColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6, minWidth: 20, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: scaleFont(12), fontWeight: '600' },
  name: { fontSize: scaleFont(16), fontWeight: '500', color: '#333' },
  time: { fontSize: scaleFont(12), color: '#999' },
  message: { fontSize: scaleFont(14), color: '#999' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: scaleHeight(60) },
  emptyText: { fontSize: scaleFont(16), color: '#999', marginTop: scaleHeight(12) },
});
