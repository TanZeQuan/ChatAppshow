import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureFullImageUrl } from '../../api/service';
import { Contact, useContactStore } from '../../store/contactStore';
import { borders, colors, typography } from '../../styles';

type SelectContactForCardRouteProp = {
  onSelectContact: (contact: Contact) => void;
};

const SelectContactForCard = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { onSelectContact } = route.params as SelectContactForCardRouteProp;

  const contacts = useContactStore((state) => state.contacts);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectContact = (contact: Contact) => {
    onSelectContact(contact);
    navigation.goBack();
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleSelectContact(item)}
    >
      <Image
        source={
          !item.avatar || 
          item.avatar.trim() === '' || 
          item.avatar.trim() === "https://balkingly-hemitropic-lelah.ngrok-free.dev"
            ? require('../../assets/images/personal.png')
            : { uri: ensureFullImageUrl(item.avatar) }
        }
        style={styles.avatar}
      />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#FFEFB0', '#FFF9E5']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>选择联系人</Text>
          <View style={{ width: 24 }} />
        </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? '未找到匹配的联系人' : '暂无联系人'}
            </Text>
          </View>
        }
      />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.yellowBright,
  },
  headerTitle: {
    fontSize: typography.fontSize18,
    fontWeight: '600',
    color: colors.text.black,
    textAlign: 'center',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.white,
    borderRadius: borders.radius30,
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
    color: colors.text.gray,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize15,
    color: colors.text.black,
    padding: 0,
  },
  listContainer: {
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: borders.width05,
    borderBottomColor: colors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borders.radius4,
    marginRight: 12,
    backgroundColor: colors.background.gray,
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: typography.fontSize16,
    color: colors.text.black,
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: typography.fontSize16,
    color: colors.text.grayLight,
  },
});

export default SelectContactForCard;