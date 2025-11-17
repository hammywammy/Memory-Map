import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

export default function SkiaTest() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.1, Math.min(10, savedScale.value * e.scale));
      
      const fx = e.focalX - W / 2;
      const fy = e.focalY - H / 2;
      
      translateX.value = fx - (fx - savedTranslateX.value) * (scale.value / savedScale.value);
      translateY.value = fy - (fy - savedTranslateY.value) * (scale.value / savedScale.value);
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <Canvas style={styles.canvas}>
          <Group
            transform={[
              { translateX: W / 2 },
              { translateY: H / 2 },
              { translateX },
              { translateY },
              { scale },
            ]}
          >
            {/* 3 simple rings */}
            <Circle cx={0} cy={0} r={100} style="stroke" strokeWidth={2} color="#3B82F6" />
            <Circle cx={0} cy={0} r={200} style="stroke" strokeWidth={2} color="#8B5CF6" />
            <Circle cx={0} cy={0} r={300} style="stroke" strokeWidth={2} color="#EC4899" />
            
            {/* Center dot */}
            <Circle cx={0} cy={0} r={5} color="white" />
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
