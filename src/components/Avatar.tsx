import React, { useState } from 'react';
import { Image, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  borderRadius?: number;
  showCameraBadge?: boolean;
  isUploading?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  size = 80,
  borderRadius = 8,
  showCameraBadge = false,
  isUploading = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const shouldShowPlaceholder = !uri || imageError || uri.trim() === '';

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: borderRadius,
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {shouldShowPlaceholder ? (
        <View style={[styles.placeholder, avatarStyle]}>
          <Ionicons name="person" size={size * 0.45} color="#fff" />
        </View>
      ) : (
        <>
          {isLoading && (
            <View style={[styles.placeholder, avatarStyle]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
          <Image
            source={{ uri }}
            style={[avatarStyle, isLoading && styles.hidden]}
            onLoad={() => setIsLoading(false)}
            onError={(e) => {
              console.warn('Avatar load error:', e.nativeEvent.error);
              console.warn('Failed URI:', uri);
              setImageError(true);
              setIsLoading(false);
            }}
          />
        </>
      )}

      {showCameraBadge && (
        <View style={[styles.cameraBadge, { width: size * 0.3, height: size * 0.3 }]}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="camera" size={size * 0.175} color="#fff" />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  placeholder: {
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hidden: {
    opacity: 0,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 100,
    backgroundColor: '#0a0a0aff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
