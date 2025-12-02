import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Switch, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  // GestureResponderEvent
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../store/chatStore';

interface RouteParams {
  chatId: string;
  chatName: string;
  avatar?: string;
}

export default function PersonalDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as RouteParams;
  const { chatId, chatName, avatar } = params;

  const { clearChat } = useChatStore();
  
  const [pushNotification, setPushNotification] = useState(false);
  const [topNotification, setTopNotification] = useState(true);
  const [strongReminder, setStrongReminder] = useState(true);

  const handleSearchHistory = () => {
    Alert.alert('查询聊天记录', '此功能即将推出');
  };

  const handleClearHistory = () => {
    Alert.alert(
      '清空聊天历史',
      `确定要清空与 ${chatName} 的所有聊天记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '清空', 
          style: 'destructive',
          onPress: () => {
            clearChat(chatId);
            Alert.alert('成功', '聊天记录已清空');
          }
        }
      ]
    );
  };

  // function handleOpenChatSettings(event: GestureResponderEvent): void {
  //   throw new Error('Function not implemented.');
  // }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>个人详情</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={60} color="#999" />
              )}
            </View>
            <Text style={styles.profileName}>{chatName}</Text>
            <Text style={styles.profileSubtext}>在线</Text>
          </View>

          {/* Quick Message Section */}
          <Text style={styles.sectionLabel}>快捷信令</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.item} onPress={handleSearchHistory}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="search" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>查询聊天记录</Text>
                <Text style={styles.itemSubtitle}>查找历史消息</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Chat Settings Section */}
          <Text style={styles.sectionLabel}>聊天设置</Text>
          <View style={styles.section}>
            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="notifications-outline" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>免打扰</Text>
                <Text style={styles.itemSubtitle}>关闭消息推送</Text>
              </View>
              <Switch
                value={pushNotification}
                onValueChange={setPushNotification}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="star" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>置顶</Text>
                <Text style={styles.itemSubtitle}>置顶聊天</Text>
              </View>
              <Switch
                value={topNotification}
                onValueChange={setTopNotification}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.item}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="warning" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>强提醒</Text>
                <Text style={styles.itemSubtitle}>强提醒推送消息</Text>
              </View>
              <Switch
                value={strongReminder}
                onValueChange={setStrongReminder}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.separator} />
{/* 
            <TouchableOpacity style={styles.item} onPress={handleOpenChatSettings}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF4CC' }]}>
                <Ionicons name="settings-outline" size={20} color="#F5C842" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>更多设置</Text>
                <Text style={styles.itemSubtitle}>聊天设置和隐私</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity> */}
          </View>

          {/* Danger Zone Section */}
          <Text style={styles.sectionLabel}>危险区</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.item} onPress={handleClearHistory}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: '#FF4444' }]}>清空聊天历史</Text>
                <Text style={styles.itemSubtitle}>删除所有聊天消息</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8DC",
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F5C842",
    borderBottomWidth: 1,
    borderBottomColor: "#E5B830",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  placeholder: {
    width: 40,
  },

  /** CONTENT */
  scrollView: {
    flex: 1,
  },
  
  /** PROFILE SECTION */
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#D1D1D6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: 14,
    color: "#999",
  },

  /** SECTION */
  sectionLabel: {
    fontSize: 13,
    color: "#999",
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#999",
  },
  separator: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginLeft: 64,
  },
});