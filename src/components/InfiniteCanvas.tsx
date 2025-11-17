import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

export default function InfiniteCanvas() {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedScale.value * e.scale));
      
      const adjustX = (e.focalX - W / 2 - savedTranslateX.value) * (scale.value / savedScale.value - 1);
      const adjustY = (e.focalY - H / 2 - savedTranslateY.value) * (scale.value / savedScale.value - 1);
      
      translateX.value = savedTranslateX.value + adjustX;
      translateY.value = savedTranslateY.value + adjustY;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <View style={styles.square}>
            <Text style={styles.text}>Origin</Text>
          </View>
        </Animated.View>
      </GestureDetector>
      
      <View style={styles.debug}>
        <Text style={styles.debugText}>Zoom: {scale.value.toFixed(2)}x</Text>
        <Text style={styles.debugText}>Pos: ({Math.round(-translateX.value / scale.value)}, {Math.round(-translateY.value / scale.value)})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  square: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#3B82F6', fontSize: 12, fontWeight: '600' },
  debug: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
  },
  debugText: { 
    color: '#FFF', 
    fontSize: 14, 
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
