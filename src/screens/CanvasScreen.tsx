import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkiaTest from '@/components/SkiaTest';

export default function CanvasScreen() {
  return (
    <View style={styles.container}>
      <SkiaTest />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
