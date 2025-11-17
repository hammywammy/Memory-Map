// src/components/SkiaTest.tsx
import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

const { width: W, height: H } = Dimensions.get('window');

export default function SkiaTest() {
  console.log('🎨 SkiaTest rendering');
  console.log('Screen dimensions:', W, H);

  return (
    <View style={styles.container}>
      <Text style={styles.debugText}>Skia Test - Should see red circle</Text>
      <Canvas style={styles.canvas}>
        {/* Dead simple: Red circle at screen center */}
        <Circle 
          cx={W / 2} 
          cy={H / 2} 
          r={100} 
          color="red" 
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  canvas: { 
    flex: 1,
  },
  debugText: {
    position: 'absolute',
    top: 50,
    left: 20,
    color: 'white',
    fontSize: 18,
    zIndex: 999,
  }
});
