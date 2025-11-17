import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate, isInViewport } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity } from '@/utils/lod';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// Base dot sizes per ring (world coordinates)
// These will scale based on zoom to create screen-space LOD
const RING_DOT_SIZES = [
  30,  // Today - large inner ring
  22,  // This Week
  14,  // This Month
  9,   // This Quarter
  5,   // This Year
  2.5, // Years Ago - tiny outer ring
];

interface PositionedMemoryWithLOD {
  id: string;
  worldX: number;
  worldY: number;
  baseSize: number;
  ringIndex: number;
  category: string;
  significance: number;
}

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // Pre-process memories with their world positions and base sizes
  const positionedMemories = useMemo(() => {
    const now = new Date();
    const positioned = layoutMemories(memories);
    
    return positioned.map(memory => {
      const ring = getTimeRingForDate(memory.timestamp, now);
      const baseSize = RING_DOT_SIZES[ring.index];
      
      return {
        id: memory.id,
        worldX: memory.worldX,
        worldY: memory.worldY,
        baseSize,
        ringIndex: ring.index,
        category: memory.category,
        significance: memory.significance,
      };
    });
  }, [memories]);
  
  console.log(`📊 ${positionedMemories.length} memories positioned`);
  
  // ═══════════════════════════════════════════════════════════════
  // CAMERA STATE (Shared Values for UI Thread)
  // ═══════════════════════════════════════════════════════════════
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // ═══════════════════════════════════════════════════════════════
  // CAMERA TRANSFORM
  // ═══════════════════════════════════════════════════════════════
  const transform = useDerivedValue(() => {
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

  // ═══════════════════════════════════════════════════════════════
  // GESTURES
  // ═══════════════════════════════════════════════════════════════
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      focalX.value = e.focalX - W / 2;
      focalY.value = e.focalY - H / 2;
    })
    .onUpdate((e) => {
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedScale.value * e.scale));
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panContext.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((e) => {
      translateX.value = panContext.value.x + e.translationX;
      translateY.value = panContext.value.y + e.translationY;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* ═══════════════════════════════════════════ */}
            {/* TIME RINGS - Background structure          */}
            {/* ═══════════════════════════════════════════ */}
            {TIME_RINGS.map((ring) => {
              const opacity = getRingOpacity(scale.value);
              
              return (
                <Circle
                  key={`ring-${ring.index}`}
                  cx={0}
                  cy={0}
                  r={ring.outerRadius}
                  style="stroke"
                  strokeWidth={2}
                  color={ring.color}
                  opacity={opacity}
                />
              );
            })}
            
            {/* ═══════════════════════════════════════════ */}
            {/* MEMORY DOTS - Screen-Space LOD System      */}
            {/* ═══════════════════════════════════════════ */}
            {positionedMemories.map((memory) => {
              // Step 1: Calculate LOD based on screen-space size
              // This is where the magic happens - worldSize × zoom = screenSize
              const lod = calculateLOD(
                memory.baseSize,      // World size (2.5px to 30px)
                scale.value,          // Current zoom (0.05 to 10)
                memory.significance   // Importance (0-1)
              );
              
              const color = CATEGORY_COLORS[memory.category];
              
              // Step 2: Render based on LOD level
              if (lod.level === 'simplified') {
                // ─────────────────────────────────────────
                // SIMPLIFIED: Tiny distant dot
                // ─────────────────────────────────────────
                return (
                  <Circle
                    key={memory.id}
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.7}
                  />
                );
                
              } else if (lod.level === 'standard') {
                // ─────────────────────────────────────────
                // STANDARD: Regular solid circle
                // ─────────────────────────────────────────
                return (
                  <Circle
                    key={memory.id}
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.85}
                  />
                );
                
              } else {
                // ─────────────────────────────────────────
                // DETAILED: Circle with + sign placeholder
                // ─────────────────────────────────────────
                const plusSize = lod.renderSize * 0.4; // + sign is 40% of circle
                const lineWidth = Math.max(2, lod.renderSize * 0.08);
                
                return (
                  <Group key={memory.id}>
                    {/* Optional glow effect */}
                    {lod.shouldShowGlow && (
                      <Circle
                        cx={memory.worldX}
                        cy={memory.worldY}
                        r={lod.renderSize * 1.3}
                        color={color}
                        opacity={0.2}
                      />
                    )}
                    
                    {/* Main circle */}
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize}
                      color={color}
                      opacity={0.9}
                    />
                    
                    {/* + sign placeholder (will be replaced with thumbnail later) */}
                    {lod.shouldShowPlus && (
                      <>
                        {/* Vertical line of + */}
                        <Line
                          p1={vec(memory.worldX, memory.worldY - plusSize)}
                          p2={vec(memory.worldX, memory.worldY + plusSize)}
                          color="white"
                          strokeWidth={lineWidth}
                          opacity={0.9}
                        />
                        {/* Horizontal line of + */}
                        <Line
                          p1={vec(memory.worldX - plusSize, memory.worldY)}
                          p2={vec(memory.worldX + plusSize, memory.worldY)}
                          color="white"
                          strokeWidth={lineWidth}
                          opacity={0.9}
                        />
                      </>
                    )}
                  </Group>
                );
              }
            })}
            
            {/* ═══════════════════════════════════════════ */}
            {/* CENTER DOT - "You are here"                */}
            {/* ═══════════════════════════════════════════ */}
            <Circle cx={0} cy={0} r={12} color="white" opacity={0.9} />
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  canvas: { 
    flex: 1 
  },
});
