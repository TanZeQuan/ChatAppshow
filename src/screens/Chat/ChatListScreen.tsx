import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const dummyChats = [
  { id: '1', name: 'Alice', lastMessage: 'Hey! How are you?' },
  { id: '2', name: 'Bob', lastMessage: 'Let’s meet tomorrow.' },
  { id: '3', name: 'Charlie', lastMessage: 'Okay bro!' },
];

export default function ChatListScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <FlatList
        data={dummyChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => navigation.navigate('ChatRoom', { userName: item.name })}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.message}>{item.lastMessage}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  chatItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  name: { fontSize: 18, fontWeight: 'bold' },
  message: { color: '#666', marginTop: 4 }
});
