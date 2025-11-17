// src/components/SkiaTest.tsx
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, useValue } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function SkiaTest() {
  console.log('🎨 SkiaTest rendering');
  
  // Reanimated values for gestures (worklet thread)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  // Skia values for rendering (UI thread)
  const skiaTranslateX = useValue(0);
  const skiaTranslateY = useValue(0);
  const skiaScale = useValue(1);

  // Bridge function to update Skia values
  const updateSkiaValues = (tx: number, ty: number, s: number) => {
    skiaTranslateX.current = tx;
    skiaTranslateY.current = ty;
    skiaScale.current = s;
  };

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * e.scale)
      );
      
      scale.value = newScale;
      
      const focalX = e.focalX - W / 2;
      const focalY = e.focalY - H / 2;
      
      translateX.value = focalX - (focalX - savedTranslateX.value) * (newScale / savedScale.value);
      translateY.value = focalY - (focalY - savedTranslateY.value) * (newScale / savedScale.value);
      
      // Update Skia values
      runOnJS(updateSkiaValues)(translateX.value, translateY.value, scale.value);
    });

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
      
      // Update Skia values
      runOnJS(updateSkiaValues)(translateX.value, translateY.value, scale.value);
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group
            transform={[
              { translateX: W / 2 },
              { translateY: H / 2 },
              { translateX: skiaTranslateX }, // Now using Skia values
              { translateY: skiaTranslateY },
              { scale: skiaScale },
            ]}
          >
            {/* 3 rings */}
            <Circle cx={0} cy={0} r={100} style="stroke" strokeWidth={2} color="#3B82F6" />
            <Circle cx={0} cy={0} r={200} style="stroke" strokeWidth={2} color="#8B5CF6" />
            <Circle cx={0} cy={0} r={300} style="stroke" strokeWidth={2} color="#EC4899" />
            
            {/* Center dot */}
            <Circle cx={0} cy={0} r={10} color="white" />
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },
});

