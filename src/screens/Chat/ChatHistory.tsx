import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<number>(27);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const daysOfWeek: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const daysInMonth: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

  const getDayOfWeek = (day: number): number => {
    // August 2025 starts on Friday (day 5)
    const firstDayOffset = 5;
    return (firstDayOffset + day - 1) % 7;
  };

  const renderEmptyCells = () => {
    const emptyCells = [];
    for (let i = 0; i < getDayOfWeek(1); i++) {
      emptyCells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    return emptyCells;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCD34D" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>查找聊天记录</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filter Options */}
        <View style={styles.filterGrid}>
          <TouchableOpacity style={styles.filterButton}>
            <View style={styles.filterIconContainer}>
              <Ionicons name="image-outline" size={28} color="#4B5563" />
            </View>
            <Text style={styles.filterText}>图片</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <View style={styles.filterIconContainer}>
              <Ionicons name="folder-outline" size={28} color="#4B5563" />
            </View>
            <Text style={styles.filterText}>文件</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowModal(true)}
          >
            <View style={styles.filterIconContainer}>
              <Ionicons name="calendar-outline" size={28} color="#4B5563" />
            </View>
            <Text style={styles.filterText}>日期</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Modal Header */}
            <Text style={styles.modalTitle}>日期选择</Text>

            {/* Calendar */}
            <View style={styles.calendar}>
              <Text style={styles.monthYear}>8月 2025</Text>

              {/* Days of Week */}
              <View style={styles.daysOfWeekRow}>
                {daysOfWeek.map((day, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.dayOfWeek,
                      index === 3 && styles.dayOfWeekHighlight,
                    ]}
                  >
                    {day}
                  </Text>
                ))}
              </View>

              {/* Calendar Days */}
              <View style={styles.calendarGrid}>
                {renderEmptyCells()}
                {daysInMonth.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(day)}
                  >
                    <View
                      style={[
                        styles.dayButton,
                        day === selectedDate && styles.selectedDay,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          day === selectedDate && styles.selectedDayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.submitButtonText}>提交</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF9C3',
  },
  // Header Styles
  header: {
    backgroundColor: '#FCD34D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  // Body Styles
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 32,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#374151',
  },
  // Filter Styles
  filterGrid: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 40,
  },
  filterButton: {
    alignItems: 'center',
  },
  filterIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  filterText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '400',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 20,
  },
  // Calendar Styles
  calendar: {
    marginBottom: 20,
  },
  monthYear: {
    textAlign: 'center',
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 20,
    fontWeight: '400',
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  dayOfWeek: {
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  dayOfWeekHighlight: {
    color: '#F59E0B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dayButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  selectedDay: {
    backgroundColor: '#FBBF24',
  },
  dayText: {
    fontSize: 14,
    color: '#374151',
  },
  selectedDayText: {
    color: '#1F2937',
    fontWeight: '500',
  },
  // Submit Button
  submitButton: {
    backgroundColor: '#FBBF24',
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
});

export default ChatHistoryScreen;