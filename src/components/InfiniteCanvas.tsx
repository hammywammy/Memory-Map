import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Group, Circle, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { TIME_RINGS } from '@/utils/ringGeometry';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function InfiniteCanvas() {
  // Camera state (world space)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Saved gesture state
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Calculate new scale
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * e.scale)
      );
      
      scale.value = newScale;
      
      // Zoom toward focal point
      // Formula: translate = focal - (focal - oldTranslate) * (newScale / oldScale)
      const focalX = e.focalX - SCREEN_WIDTH / 2;
      const focalY = e.focalY - SCREEN_HEIGHT / 2;
      
      translateX.value = focalX - (focalX - savedTranslateX.value) * (newScale / savedScale.value);
      translateY.value = focalY - (focalY - savedTranslateY.value) * (newScale / savedScale.value);
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
    });

  // Combine gestures
  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group
            // Apply camera transform
            transform={[
              { translateX: SCREEN_WIDTH / 2 },
              { translateY: SCREEN_HEIGHT / 2 },
              { translateX: translateX },
              { translateY: translateY },
              { scale: scale },
            ]}
          >
            {/* Render rings */}
            {TIME_RINGS.map((ring) => (
              <Group key={ring.index}>
                {/* Ring circle */}
                <Circle
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={2}
                  color={ring.color}
                />
                
                {/* Ring label (only show when zoomed in enough) */}
                {scale.value >= 0.5 && (
                  <SkiaText
                    x={-30}
                    y={-ring.outerRadius - 10}
                    text={ring.label}
                    color={ring.color.replace('0.3', '0.8')}
                    size={14}
                  />
                )}
              </Group>
            ))}
            
            {/* Center dot to show origin */}
            <Circle
              cx={0}
              cy={0}
              r={10}
              color="rgba(255, 255, 255, 0.5)"
            />
          </Group>
        </Canvas>
      </GestureDetector>
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
});
