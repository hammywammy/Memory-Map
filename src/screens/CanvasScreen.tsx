import React from 'react';
import { View, StyleSheet } from 'react-native';
import InfiniteCanvas from '@/components/InfiniteCanvas';

export default function CanvasScreen() {
  return (
    <View style={styles.container}>
      <InfiniteCanvas />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
