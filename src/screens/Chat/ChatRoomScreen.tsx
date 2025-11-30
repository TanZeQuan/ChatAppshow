import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';

export default function ChatRoomScreen() {
  const route = useRoute<any>();
  const userName = route.params?.userName || 'Unknown';

  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello!' },
    { id: '2', text: 'Welcome to the chat room.' }
  ]);

  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text: input }
    ]);

    setInput('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chat with {userName}</Text>

      <FlatList
        data={messages}
        style={{ flex: 1 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type message..."
          value={input}
          onChangeText={setInput}
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  bubble: {
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginRight: 10
  },
});
