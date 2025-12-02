import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useContactStore, Contact } from "../../store/contactStore";
import { useUserStore } from "../../store/userStore";
import { useChatStore } from "../../store/chatStore";

const { width, height } = Dimensions.get("window");

const scaleWidth = (size: number) => (width / 375) * size;
const scaleHeight = (size: number) => (height / 812) * size;
const scaleFont = (size: number) => (width / 375) * size;

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, name } = route.params;

  const { contacts, addContact, removeContact, getContactById } = useContactStore();
  const { user, token } = useUserStore();
  const { getLastMessage } = useChatStore();
  
  const [isFriend, setIsFriend] = useState(() => !!getContactById(userId));

  // Get contact info if exists
  const existingContact = getContactById(userId);
  const lastMessage = getLastMessage(userId);

  // Mock user data - replace with API call
  const userProfile = {
    id: userId,
    name: name,
    avatar: existingContact?.avatar || `https://i.pravatar.cc/150?u=${userId}`,
    bio: "Hey there! I'm using this chat app.",
    phone: "+1 234 567 8900",
    email: `${userId}@example.com`,
    joinedDate: "January 2024",
    online: existingContact?.online || false,
  };

  const handleAddFriend = () => {
    if (!token) {
      Alert.alert("Error", "Please login first");
      return;
    }

    const newContact: Contact = {
      id: userProfile.id,
      name: userProfile.name,
      avatar: userProfile.avatar,
      online: userProfile.online,
    };

    addContact(newContact);
    setIsFriend(true);

    Alert.alert("Success", `${userProfile.name} has been added to your contacts!`);
  };

  const handleRemoveFriend = () => {
    Alert.alert(
      "Remove Contact",
      `Are you sure you want to remove ${userProfile.name} from your contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeContact(userId);
            setIsFriend(false);
            Alert.alert("Removed", `${userProfile.name} has been removed from your contacts.`);
          },
        },
      ]
    );
  };

  const handleStartChat = () => {
    if (!isFriend) {
      Alert.alert(
        "Not a Contact",
        "Please add this user to your contacts first to start chatting.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Contact", onPress: handleAddFriend },
        ]
      );
      return;
    }

    navigation.navigate("ChatRoom", {
      type: "single",
      targetUserId: userId,
      name: name,
    });
  };

  const handleVideoCall = () => {
    if (!isFriend) {
      Alert.alert("Not a Contact", "Please add this user to your contacts first.");
      return;
    }
    Alert.alert("Video Call", "Video call feature coming soon!");
  };

  const handleVoiceCall = () => {
    if (!isFriend) {
      Alert.alert("Not a Contact", "Please add this user to your contacts first.");
      return;
    }
    Alert.alert("Voice Call", "Voice call feature coming soon!");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: userProfile.avatar }}
              style={styles.avatar}
            />
            {userProfile.online && <View style={styles.onlineDot} />}
          </View>
          <Text style={styles.userName}>{userProfile.name}</Text>
          <Text style={styles.userId}>ID: {userProfile.id}</Text>
          {userProfile.online && (
            <View style={styles.onlineBadge}>
              <View style={styles.onlineIndicator} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          )}
          
          {/* Show last message time if exists */}
          {lastMessage && (
            <Text style={styles.lastActivity}>
              Last message: {new Date(lastMessage.createdAt).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionButton, !isFriend && styles.actionButtonDisabled]}
            onPress={handleStartChat}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="chatbubble" size={24} color={isFriend ? "#007AFF" : "#999"} />
            </View>
            <Text style={[styles.actionLabel, !isFriend && styles.actionLabelDisabled]}>
              Message
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, !isFriend && styles.actionButtonDisabled]}
            onPress={handleVoiceCall}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="call" size={24} color={isFriend ? "#34C759" : "#999"} />
            </View>
            <Text style={[styles.actionLabel, !isFriend && styles.actionLabelDisabled]}>
              Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, !isFriend && styles.actionButtonDisabled]}
            onPress={handleVideoCall}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="videocam" size={24} color={isFriend ? "#FF9500" : "#999"} />
            </View>
            <Text style={[styles.actionLabel, !isFriend && styles.actionLabelDisabled]}>
              Video
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.infoItem}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Bio</Text>
              <Text style={styles.infoValue}>{userProfile.bio}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{userProfile.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{userProfile.phone}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Joined</Text>
              <Text style={styles.infoValue}>{userProfile.joinedDate}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsSection}>
          {isFriend ? (
            <>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={handleStartChat}
              >
                <Ionicons name="chatbubble" size={20} color="#fff" style={styles.btnIcon} />
                <Text style={styles.primaryButtonText}>Send Message</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dangerButton}
                onPress={handleRemoveFriend}
              >
                <Ionicons name="person-remove" size={20} color="#fff" style={styles.btnIcon} />
                <Text style={styles.dangerButtonText}>Remove Contact</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleAddFriend}
            >
              <Ionicons name="person-add" size={20} color="#fff" style={styles.btnIcon} />
              <Text style={styles.primaryButtonText}>Add to Contacts</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Additional Options */}
        <View style={styles.optionsSection}>
          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="notifications-outline" size={22} color="#333" />
            <Text style={styles.optionText}>Mute Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="shield-outline" size={22} color="#333" />
            <Text style={styles.optionText}>Block User</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="flag-outline" size={22} color="#FF3B30" />
            <Text style={[styles.optionText, styles.dangerText]}>Report User</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  /** HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: {
    padding: scaleWidth(8),
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: "600",
    color: "#333",
  },
  moreButton: {
    padding: scaleWidth(8),
  },

  /** CONTENT */
  content: {
    flex: 1,
  },

  /** PROFILE HEADER */
  profileHeader: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingVertical: scaleHeight(30),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: scaleHeight(16),
  },
  avatar: {
    width: scaleWidth(100),
    height: scaleHeight(100),
    borderRadius: scaleWidth(50),
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  onlineDot: {
    position: "absolute",
    bottom: scaleHeight(5),
    right: scaleWidth(5),
    width: scaleWidth(20),
    height: scaleHeight(20),
    backgroundColor: "#34C759",
    borderRadius: scaleWidth(10),
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontSize: scaleFont(24),
    fontWeight: "700",
    color: "#333",
    marginBottom: scaleHeight(4),
  },
  userId: {
    fontSize: scaleFont(14),
    color: "#999",
    marginBottom: scaleHeight(12),
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(6),
    borderRadius: 20,
    gap: scaleWidth(6),
    marginBottom: scaleHeight(8),
  },
  onlineIndicator: {
    width: scaleWidth(8),
    height: scaleHeight(8),
    backgroundColor: "#34C759",
    borderRadius: scaleWidth(4),
  },
  onlineText: {
    fontSize: scaleFont(12),
    color: "#34C759",
    fontWeight: "600",
  },
  lastActivity: {
    fontSize: scaleFont(12),
    color: "#999",
    marginTop: scaleHeight(4),
  },

  /** QUICK ACTIONS */
  quickActions: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: scaleHeight(20),
    paddingHorizontal: scaleWidth(20),
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  actionButton: {
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: scaleWidth(56),
    height: scaleHeight(56),
    backgroundColor: "#F5F5F5",
    borderRadius: scaleWidth(28),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: scaleHeight(8),
  },
  actionLabel: {
    fontSize: scaleFont(12),
    color: "#666",
    fontWeight: "500",
  },
  actionLabelDisabled: {
    color: "#999",
  },

  /** INFO SECTION */
  infoSection: {
    backgroundColor: "#FFFFFF",
    marginTop: scaleHeight(12),
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(20),
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
    marginBottom: scaleHeight(16),
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: scaleHeight(16),
    gap: scaleWidth(12),
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: scaleFont(13),
    color: "#999",
    marginBottom: scaleHeight(4),
  },
  infoValue: {
    fontSize: scaleFont(15),
    color: "#333",
    fontWeight: "500",
  },

  /** ACTION BUTTONS */
  actionButtonsSection: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    gap: scaleHeight(12),
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    paddingVertical: scaleHeight(14),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnIcon: {
    marginRight: scaleWidth(8),
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: scaleFont(16),
    fontWeight: "600",
  },
  dangerButton: {
    flexDirection: "row",
    backgroundColor: "#FF3B30",
    paddingVertical: scaleHeight(14),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontSize: scaleFont(16),
    fontWeight: "600",
  },

  /** OPTIONS SECTION */
  optionsSection: {
    backgroundColor: "#FFFFFF",
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(20),
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(20),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: scaleWidth(12),
  },
  optionText: {
    flex: 1,
    fontSize: scaleFont(15),
    color: "#333",
  },
  dangerText: {
    color: "#FF3B30",
  },
});