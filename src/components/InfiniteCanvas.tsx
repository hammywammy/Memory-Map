import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { G } from 'react-native-svg';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories, PositionedMemory } from '@/utils/memoryLayout';
import { getLODForZoom, getMemoryDisplaySize } from '@/utils/lod';
import { isInViewport } from '@/utils/ringGeometry';
import RingLayer from './RingLayer';
import MemoryDot from './MemoryDot';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function InfiniteCanvas() {
  const { memories } = useMemoryStore();
  
  // Camera state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Layout memories once
  const positionedMemories = useMemo(() => layoutMemories(memories), [memories]);
  
  // Current LOD level (derived from zoom)
  const currentLOD = useDerivedValue(() => {
    return getLODForZoom(scale.value);
  });
  
  // Visible memories (with viewport culling)
  const visibleMemories = useMemo(() => {
    // This will be recomputed on pan/zoom via the render cycle
    return positionedMemories.filter((m) =>
      isInViewport(
        m.worldX,
        m.worldY,
        -translateX.value / scale.value,
        -translateY.value / scale.value,
        scale.value,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        200 // padding for smooth culling
      )
    );
  }, [positionedMemories, translateX.value, translateY.value, scale.value]);
  
  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedScale.value * e.scale));
      scale.value = newScale;
      
      // Zoom toward focal point
      const adjustX = (e.focalX - SCREEN_WIDTH / 2 - savedTranslateX.value) * 
                      (newScale / savedScale.value - 1);
      const adjustY = (e.focalY - SCREEN_HEIGHT / 2 - savedTranslateY.value) * 
                      (newScale / savedScale.value - 1);
      
      translateX.value = savedTranslateX.value + adjustX;
      translateY.value = savedTranslateY.value + adjustY;
    });

  // Pan gesture
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
      {/* Ring layer (always centered on screen) */}
      <RingLayer 
        zoom={scale.value} 
        screenWidth={SCREEN_WIDTH}
        screenHeight={SCREEN_HEIGHT}
      />
      
      {/* Memories layer */}
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Svg
            width={SCREEN_WIDTH * 4}
            height={SCREEN_HEIGHT * 4}
            viewBox={`${-SCREEN_WIDTH * 2} ${-SCREEN_HEIGHT * 2} ${SCREEN_WIDTH * 4} ${SCREEN_HEIGHT * 4}`}
          >
            <G>
              {visibleMemories.slice(0, currentLOD.value.renderBudget).map((memory) => {
                const lod = getLODForZoom(scale.value);
                const size = getMemoryDisplaySize(
                  lod.memorySize,
                  memory.significance,
                  scale.value
                );
                
                return (
                  <MemoryDot
                    key={memory.id}
                    worldX={memory.worldX}
                    worldY={memory.worldY}
                    category={memory.category}
                    significance={memory.significance}
                    size={size}
                    lod={lod}
                    screenCenterX={SCREEN_WIDTH * 2}
                    screenCenterY={SCREEN_HEIGHT * 2}
                    zoom={scale.value}
                  />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});
