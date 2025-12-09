import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles';

export default function AddGroupMembers() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { chatId, chatName, currentMembers } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加群成员</Text>
        <TouchableOpacity style={styles.headerRightButton} onPress={() => Alert.alert('添加', '选择成员功能待实现')}>
          <Ionicons name="checkmark" size={24} color={colors.text.black} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.contentText}>添加群成员到: {chatName} ({chatId})</Text>
        <Text style={styles.contentText}>当前成员: {currentMembers.length} 人</Text>
        <Text style={styles.contentText}>功能尚未实现。</Text>
      </View>
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
    fontSize: typography.fontSize18,
    fontWeight: typography.fontWeight600,
    color: colors.text.black,
  },
  headerRightButton: {
    paddingLeft: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentText: {
    fontSize: typography.fontSize16,
    color: colors.text.gray,
    marginBottom: 10,
  },
});
