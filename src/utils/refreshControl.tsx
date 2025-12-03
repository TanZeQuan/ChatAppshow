// utils/refreshControl.tsx
import React from 'react';
import { RefreshControl } from 'react-native';

interface RefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  title?: string;
  colors?: string[];
  tintColor?: string;
}

/**
 * 可复用的下拉刷新组件
 * @param refreshing - 是否正在刷新
 * @param onRefresh - 刷新回调函数
 * @param title - 刷新文本（可选）
 * @param colors - Android 颜色数组（可选）
 * @param tintColor - iOS 颜色（可选）
 */
export const createRefreshControl = ({
  refreshing,
  onRefresh,
  title = '下拉刷新',
  colors = ['#FFD700'],
  tintColor = '#FFD700',
}: RefreshControlProps) => {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={colors} // Android
      tintColor={tintColor} // iOS
      title={title}
      titleColor="#666"
      progressBackgroundColor="#FFFFFF" // Android
    />
  );
};

/**
 * 默认的金色主题刷新控件
 */
export const GoldenRefreshControl = ({
  refreshing,
  onRefresh,
  title,
}: Omit<RefreshControlProps, 'colors' | 'tintColor'>) => {
  return createRefreshControl({
    refreshing,
    onRefresh,
    title,
    colors: ['#FFD700', '#FFA500'],
    tintColor: '#FFD700',
  });
};

/**
 * 自定义 Hook 用于管理刷新状态
 */
export const useRefresh = (onRefreshCallback: () => Promise<void>) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshCallback();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, handleRefresh };
};

/**
 * 预设的刷新配置
 */
export const RefreshPresets = {
  golden: {
    colors: ['#FFD700', '#FFA500'],
    tintColor: '#FFD700',
  },
  blue: {
    colors: ['#4A90E2', '#357ABD'],
    tintColor: '#4A90E2',
  },
  green: {
    colors: ['#4CAF50', '#45A049'],
    tintColor: '#4CAF50',
  },
  red: {
    colors: ['#FF3B30', '#E53935'],
    tintColor: '#FF3B30',
  },
};

export default {
  createRefreshControl,
  GoldenRefreshControl,
  useRefresh,
  RefreshPresets,
};