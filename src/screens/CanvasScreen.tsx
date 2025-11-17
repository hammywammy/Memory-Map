import React from 'react';
import { StyleSheet, View } from 'react-native';
import InfiniteCanvas from '@/components/InfiniteCanvas';

/**
 * Canvas Screen
 * Phase 1: Just the infinite canvas - no controls yet
 */
export default function CanvasScreen() {
  return (
    <View style={styles.container}>
      <InfiniteCanvas />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
