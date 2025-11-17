import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity, RENDER_BUDGETS } from '@/utils/lod';
import PerformanceTracker from '@/components/PerformanceTracker';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// Viewport padding for smoother culling
const VIEWPORT_PADDING = 200;

// Base dot sizes per ring (world coordinates)
const RING_DOT_SIZES = [
  30,  // Today
  22,  // This Week
  14,  // This Month
  9,   // This Quarter
  5,   // This Year
  2.5, // Years Ago
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

export default function InfiniteCanvasOptimized() {
  const memories = useMemoryStore(state => state.memories);
  
  // Performance tracking state
  const [perfStats, setPerfStats] = useState({
    visibleMemories: 0,
    simplified: 0,
    standard: 0,
    detailed: 0,
    zoom: 1,
  });
  
  // Pre-process memories
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
  
  // ═══════════════════════════════════════════════════════════════
  // CAMERA STATE
  // ═══════════════════════════════════════════════════════════════
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const panContext = useSharedValue({ x: 0, y: 0 });

  // ═══════════════════════════════════════════════════════════════
  // VIEWPORT CULLING - Calculate visible viewport in world coords
  // ═══════════════════════════════════════════════════════════════
  const viewportBounds = useDerivedValue(() => {
    'worklet';
    
    // Calculate viewport size in world coordinates
    const worldWidth = W / scale.value;
    const worldHeight = H / scale.value;
    
    // Camera center in world coordinates
    const cameraX = -translateX.value / scale.value;
    const cameraY = -translateY.value / scale.value;
    
    // Viewport bounds with padding
    const padding = VIEWPORT_PADDING / scale.value;
    
    return {
      minX: cameraX - worldWidth / 2 - padding,
      maxX: cameraX + worldWidth / 2 + padding,
      minY: cameraY - worldHeight / 2 - padding,
      maxY: cameraY + worldHeight / 2 + padding,
    };
  });

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
  // PERFORMANCE STATS UPDATE
  // ═══════════════════════════════════════════════════════════════
  useAnimatedReaction(
    () => ({
      zoom: scale.value,
      bounds: viewportBounds.value,
    }),
    (current) => {
      // This runs on UI thread, only update stats periodically
      runOnJS(setPerfStats)({
        visibleMemories: 0, // Will be updated during render
        simplified: 0,
        standard: 0,
        detailed: 0,
        zoom: current.zoom,
      });
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER WITH VIEWPORT CULLING + LOD
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* Performance Tracker */}
      <PerformanceTracker
        totalMemories={positionedMemories.length}
        visibleMemories={perfStats.visibleMemories}
        simplified={perfStats.simplified}
        standard={perfStats.standard}
        detailed={perfStats.detailed}
        zoom={perfStats.zoom}
      />
      
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* ═══════════════════════════════════════════ */}
            {/* TIME RINGS                                 */}
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
            {/* MEMORY DOTS - Viewport Culling + LOD       */}
            {/* ═══════════════════════════════════════════ */}
            {(() => {
              const bounds = viewportBounds.value;
              
              // STEP 1: VIEWPORT CULLING
              const visibleMemories = positionedMemories.filter(memory => {
                return (
                  memory.worldX >= bounds.minX &&
                  memory.worldX <= bounds.maxX &&
                  memory.worldY >= bounds.minY &&
                  memory.worldY <= bounds.maxY
                );
              });
              
              // STEP 2: LOD CATEGORIZATION
              const lodBuckets = {
                simplified: [] as PositionedMemoryWithLOD[],
                standard: [] as PositionedMemoryWithLOD[],
                detailed: [] as PositionedMemoryWithLOD[],
              };
              
              let simplifiedCount = 0;
              let standardCount = 0;
              let detailedCount = 0;
              
              for (const memory of visibleMemories) {
                const lod = calculateLOD(
                  memory.baseSize,
                  scale.value,
                  memory.significance
                );
                
                // Check render budget
                if (lod.level === 'simplified' && simplifiedCount < RENDER_BUDGETS.simplified) {
                  lodBuckets.simplified.push(memory);
                  simplifiedCount++;
                } else if (lod.level === 'standard' && standardCount < RENDER_BUDGETS.standard) {
                  lodBuckets.standard.push(memory);
                  standardCount++;
                } else if (lod.level === 'detailed' && detailedCount < RENDER_BUDGETS.detailed) {
                  lodBuckets.detailed.push(memory);
                  detailedCount++;
                }
              }
              
              // Update perf stats (will be picked up by React state)
              if (perfStats.visibleMemories !== visibleMemories.length) {
                runOnJS(setPerfStats)({
                  visibleMemories: visibleMemories.length,
                  simplified: simplifiedCount,
                  standard: standardCount,
                  detailed: detailedCount,
                  zoom: scale.value,
                });
              }
              
              // STEP 3: RENDER BY LOD LEVEL
              return (
                <>
                  {/* Render simplified first (background layer) */}
                  {lodBuckets.simplified.map(memory => {
                    const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
                    const color = CATEGORY_COLORS[memory.category];
                    
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
                  })}
                  
                  {/* Render standard (middle layer) */}
                  {lodBuckets.standard.map(memory => {
                    const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
                    const color = CATEGORY_COLORS[memory.category];
                    
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
                  })}
                  
                  {/* Render detailed (foreground layer) */}
                  {lodBuckets.detailed.map(memory => {
                    const lod = calculateLOD(memory.baseSize, scale.value, memory.significance);
                    const color = CATEGORY_COLORS[memory.category];
                    const plusSize = lod.renderSize * 0.4;
                    const lineWidth = Math.max(2, lod.renderSize * 0.08);
                    
                    return (
                      <Group key={memory.id}>
                        {/* Glow effect */}
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
                        
                        {/* + sign placeholder */}
                        {lod.shouldShowPlus && (
                          <>
                            <Line
                              p1={vec(memory.worldX, memory.worldY - plusSize)}
                              p2={vec(memory.worldX, memory.worldY + plusSize)}
                              color="white"
                              strokeWidth={lineWidth}
                              opacity={0.9}
                            />
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
                  })}
                </>
              );
            })()}
            
            {/* ═══════════════════════════════════════════ */}
            {/* CENTER DOT                                 */}
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
