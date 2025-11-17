import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { 
  useSharedValue, 
  useDerivedValue, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// LOD thresholds
const LOD_DETAILED = 2.5;
const LOD_CIRCLE = 0.5;

const RING_BASE_SIZES = [30, 22, 14, 9, 5, 2.5];

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // 🔥 FIX: Simple easing that works on mobile
  const pulse = useSharedValue(0);
  
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { 
        duration: 2500, 
        easing: Easing.inOut(Easing.ease) // ✅ Use .ease instead of .sine
      }),
      -1,
      true
    );
  }, []);
  
  // Pre-compute positioned memories
  const positionedMemories = useMemo(() => {
    console.log(`📊 Laying out ${memories.length} memories...`);
    const now = new Date();
    const positioned = layoutMemories(memories);
    
    return positioned.map((memory, index) => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_BASE_SIZES[ring.index];
      const sizeFactor = 0.5 + memory.significance;
      const finalSize = baseSize * sizeFactor;
      
      return {
        id: memory.id,
        worldX: memory.worldX,
        worldY: memory.worldY,
        category: memory.category,
        ringIndex: ring.index,
        finalSize,
        phaseOffset: (index % 20) / 20,
      };
    });
  }, [memories]);
  
  console.log(`✨ ${positionedMemories.length} memories ready to render`);
  
  // Camera - all shared values
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // Viewport bounds for culling
  const viewportBounds = useDerivedValue(() => {
    'worklet';
    const zoom = scale.value;
    const panX = translateX.value;
    const panY = translateY.value;
    
    const margin = 500 / zoom;
    
    return {
      left: (-W / 2 - panX) / zoom - margin,
      right: (W / 2 - panX) / zoom + margin,
      top: (-H / 2 - panY) / zoom - margin,
      bottom: (H / 2 - panY) / zoom + margin,
    };
  });

  // Transform
  const transform = useDerivedValue(() => {
    'worklet';
    return [
      { translateX: W / 2 },
      { translateY: H / 2 },
      { translateX: translateX.value },
      { translateY: translateY.value },
      { translateX: -focalX.value },
      { translateY: -focalY.value },
      { scale: scale.value },
      { translateX: focalX.value },
      { translateY: focalY.value },
    ];
  });

  // 🔥 FIX: Gestures with proper worklet directives
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet';
      savedScale.value = scale.value;
      focalX.value = e.focalX - W / 2;
      focalY.value = e.focalY - H / 2;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = savedScale.value * e.scale;
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      panContext.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = panContext.value.x + e.translationX;
      translateY.value = panContext.value.y + e.translationY;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // 🔥 FIX: Simplified render with inline culling
  const renderMemories = () => {
    const bounds = viewportBounds.value;
    const zoom = scale.value;
    const pulseValue = pulse.value;
    
    const result = [];
    
    // Only render visible memories
    for (let i = 0; i < positionedMemories.length; i++) {
      const memory = positionedMemories[i];
      
      // Viewport culling
      if (
        memory.worldX < bounds.left ||
        memory.worldX > bounds.right ||
        memory.worldY < bounds.top ||
        memory.worldY > bounds.bottom
      ) {
        continue; // Skip off-screen
      }
      
      const color = CATEGORY_COLORS[memory.category];
      const cx = memory.worldX;
      const cy = memory.worldY;
      const size = memory.finalSize;
      
      // LOD 1: DETAILED - + sign
      if (zoom >= LOD_DETAILED) {
        const crossSize = size * 0.4;
        result.push(
          <Group key={memory.id}>
            <Circle
              cx={cx}
              cy={cy}
              r={size}
              color={color}
              opacity={0.9}
            />
            <Line
              p1={vec(cx - crossSize, cy)}
              p2={vec(cx + crossSize, cy)}
              color="white"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <Line
              p1={vec(cx, cy - crossSize)}
              p2={vec(cx, cy + crossSize)}
              color="white"
              strokeWidth={1.5}
              opacity={0.9}
            />
          </Group>
        );
      }
      // LOD 2: CIRCLE
      else if (zoom >= LOD_CIRCLE) {
        result.push(
          <Circle
            key={memory.id}
            cx={cx}
            cy={cy}
            r={size}
            color={color}
            opacity={0.85}
          />
        );
      }
      // LOD 3: POINT - pulsing
      else {
        const pulsePhase = (pulseValue + memory.phaseOffset) % 1;
        const pulseOpacity = 0.4 + pulsePhase * 0.5;
        
        result.push(
          <Circle
            key={memory.id}
            cx={cx}
            cy={cy}
            r={size * 0.8}
            color={color}
            opacity={pulseOpacity}
          />
        );
      }
    }
    
    return result;
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* Rings */}
            {TIME_RINGS.map((ring) => (
              <Circle
                key={`ring-${ring.index}`}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={1}
                color={ring.color}
                opacity={0.25}
              />
            ))}
            
            {/* Memories */}
            {renderMemories()}
            
            {/* Center */}
            <Circle cx={0} cy={0} r={10} color="white" opacity={0.95} />
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
