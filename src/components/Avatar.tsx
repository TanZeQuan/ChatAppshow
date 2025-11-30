// src/components/Avatar.tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Props = {
  uri: string;
  size?: number;
};

export default function Avatar({ uri, size = 50 }: Props) {
  return (
    <View style={{ ...styles.container, width: size, height: size }}>
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size/2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 25,
  },
});
