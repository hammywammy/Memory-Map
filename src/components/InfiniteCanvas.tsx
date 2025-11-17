import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity, RENDER_BUDGETS } from '@/utils/lod';
import PerformanceTracker from '@/components/PerformanceTracker';

const { width: W, height: H } = Dimensions.get('window');
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;
const VIEWPORT_PADDING = 200;

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

interface RenderData {
  simplified: PositionedMemoryWithLOD[];
  standard: PositionedMemoryWithLOD[];
  detailed: PositionedMemoryWithLOD[];
  zoom: number;
}

export default function InfiniteCanvas() {
  const memories = useMemoryStore(state => state.memories);
  
  // ALL rendering state stored in React state (JS thread) - no shared values accessed during render
  const [visibleCount, setVisibleCount] = useState(0);
  const [simplifiedCount, setSimplifiedCount] = useState(0);
  const [standardCount, setStandardCount] = useState(0);
  const [detailedCount, setDetailedCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Store render-ready data in React state
  const [simplifiedMemories, setSimplifiedMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [standardMemories, setStandardMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [detailedMemories, setDetailedMemories] = useState<PositionedMemoryWithLOD[]>([]);
  const [ringOpacityValue, setRingOpacityValue] = useState(0.3);
  const [currentPulse, setCurrentPulse] = useState(0);
  
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
  
  // Camera state - using simple x, y, zoom model instead of complex focal point system
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraZoom = useSharedValue(1);
  
  // Saved state for gestures
  const savedCamera = useSharedValue({ x: 0, y: 0, zoom: 1 });
  const panContext = useSharedValue({ x: 0, y: 0 });

  // Pulsing animation for simplified dots
  const pulseAnim = useSharedValue(0);
  
  React.useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  // Calculate what to render (runs on UI thread)
  const renderData = useDerivedValue<RenderData>(() => {
    'worklet';
    
    // Viewport bounds in world coordinates
    const worldWidth = W / cameraZoom.value;
    const worldHeight = H / cameraZoom.value;
    const padding = VIEWPORT_PADDING / cameraZoom.value;
    
    const bounds = {
      minX: cameraX.value - worldWidth / 2 - padding,
      maxX: cameraX.value + worldWidth / 2 + padding,
      minY: cameraY.value - worldHeight / 2 - padding,
      maxY: cameraY.value + worldHeight / 2 + padding,
    };
    
    // Filter visible
    const visible = positionedMemories.filter(m => 
      m.worldX >= bounds.minX &&
      m.worldX <= bounds.maxX &&
      m.worldY >= bounds.minY &&
      m.worldY <= bounds.maxY
    );
    
    // Categorize by LOD
    const simplified: PositionedMemoryWithLOD[] = [];
    const standard: PositionedMemoryWithLOD[] = [];
    const detailed: PositionedMemoryWithLOD[] = [];
    
    for (const memory of visible) {
      const lod = calculateLOD(memory.baseSize, cameraZoom.value, memory.significance);
      
      if (lod.level === 'simplified' && simplified.length < RENDER_BUDGETS.simplified) {
        simplified.push(memory);
      } else if (lod.level === 'standard' && standard.length < RENDER_BUDGETS.standard) {
        standard.push(memory);
      } else if (lod.level === 'detailed' && detailed.length < RENDER_BUDGETS.detailed) {
        detailed.push(memory);
      }
    }
    
    return { simplified, standard, detailed, zoom: cameraZoom.value };
  });

  // Sync pulse animation to React state
  useAnimatedReaction(
    () => pulseAnim.value,
    (pulse) => {
      'worklet';
      runOnJS(setCurrentPulse)(pulse);
    }
  );

  // Update React state from UI thread (proper bridge crossing)
  useAnimatedReaction(
    () => ({
      simplified: renderData.value.simplified,
      standard: renderData.value.standard,
      detailed: renderData.value.detailed,
      zoom: renderData.value.zoom,
      ringOpacity: getRingOpacity(cameraZoom.value),
    }),
    (current, previous) => {
      'worklet';
      
      // Update counts
      const total = current.simplified.length + current.standard.length + current.detailed.length;
      
      if (!previous || 
          current.simplified.length !== previous.simplified.length ||
          current.standard.length !== previous.standard.length ||
          current.detailed.length !== previous.detailed.length ||
          Math.abs(current.zoom - previous.zoom) > 0.01) {
        
        runOnJS(setVisibleCount)(total);
        runOnJS(setSimplifiedCount)(current.simplified.length);
        runOnJS(setStandardCount)(current.standard.length);
        runOnJS(setDetailedCount)(current.detailed.length);
        runOnJS(setZoomLevel)(current.zoom);
        runOnJS(setRingOpacityValue)(current.ringOpacity);
        
        // Update actual memory arrays for rendering
        runOnJS(setSimplifiedMemories)(current.simplified);
        runOnJS(setStandardMemories)(current.standard);
        runOnJS(setDetailedMemories)(current.detailed);
      }
    }
  );

  // Camera transform - CORRECT ORDER for zoom-to-focal-point
  const transform = useDerivedValue(() => {
    'worklet';
    
    return [
      // 1. Center the origin at screen center
      { translateX: W / 2 },
      { translateY: H / 2 },
      
      // 2. Apply zoom (scales around centered origin)
      { scale: cameraZoom.value },
      
      // 3. Move world based on camera position
      { translateX: -cameraX.value * cameraZoom.value },
      { translateY: -cameraY.value * cameraZoom.value },
    ];
  });

  // Helper: Screen to World coordinate conversion
  const screenToWorld = (screenX: number, screenY: number, zoom: number, camX: number, camY: number) => {
    'worklet';
    return {
      x: (screenX - W / 2) / zoom + camX,
      y: (screenY - H / 2) / zoom + camY,
    };
  };

  // ✅ FIXED: Pinch gesture with proper focal point zoom
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      // Save current camera state
      savedCamera.value = {
        x: cameraX.value,
        y: cameraY.value,
        zoom: cameraZoom.value,
      };
    })
    .onUpdate((e) => {
      // Calculate new zoom level
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedCamera.value.zoom * e.scale)
      );
      
      // Get focal point in screen coordinates
      const focalScreenX = e.focalX;
      const focalScreenY = e.focalY;
      
      // Convert focal point to world coordinates at OLD zoom
      const worldPointBefore = screenToWorld(
        focalScreenX,
        focalScreenY,
        savedCamera.value.zoom,
        savedCamera.value.x,
        savedCamera.value.y
      );
      
      // Convert focal point to world coordinates at NEW zoom
      // (if we didn't adjust camera position)
      const worldPointAfter = screenToWorld(
        focalScreenX,
        focalScreenY,
        newZoom,
        savedCamera.value.x,
        savedCamera.value.y
      );
      
      // Adjust camera position to keep the world point under the fingers
      cameraZoom.value = newZoom;
      cameraX.value = savedCamera.value.x + (worldPointAfter.x - worldPointBefore.x);
      cameraY.value = savedCamera.value.y + (worldPointAfter.y - worldPointBefore.y);
    });

  // Pan gesture - compensate for zoom level
  const panGesture = Gesture.Pan()
    .onStart(() => {
      panContext.value = { x: cameraX.value, y: cameraY.value };
    })
    .onUpdate((e) => {
      // Divide by zoom to make pan feel consistent at all zoom levels
      cameraX.value = panContext.value.x - e.translationX / cameraZoom.value;
      cameraY.value = panContext.value.y - e.translationY / cameraZoom.value;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.container}>
      <PerformanceTracker
        totalMemories={positionedMemories.length}
        visibleMemories={visibleCount}
        simplified={simplifiedCount}
        standard={standardCount}
        detailed={detailedCount}
        zoom={zoomLevel}
      />
      
      <GestureDetector gesture={combinedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* TIME RINGS - using React state */}
            {TIME_RINGS.map((ring) => (
              <Circle
                key={`ring-${ring.index}`}
                cx={0}
                cy={0}
                r={ring.outerRadius}
                style="stroke"
                strokeWidth={2}
                color={ring.color}
                opacity={ringOpacityValue}
              />
            ))}
            
            {/* SIMPLIFIED - Pulsing distant stars - using React state */}
            {simplifiedMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              
              // Pulsing glow using React state pulse value
              const pulse = currentPulse;
              const glowRadius = lod.renderSize * (1 + pulse * 1.5);
              const glowOpacity = 0.5 * (1 - pulse * 0.6);
              
              return (
                <Group key={memory.id}>
                  {/* Outer glow */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={glowRadius}
                    color={color}
                    opacity={glowOpacity * 0.4}
                  />
                  {/* Inner glow */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize * (1 + pulse * 0.5)}
                    color={color}
                    opacity={glowOpacity * 0.7}
                  />
                  {/* Core */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.9}
                  />
                </Group>
              );
            })}
            
            {/* STANDARD - Regular circles - using React state */}
            {standardMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
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
            
            {/* DETAILED - Circles with + sign - using React state */}
            {detailedMemories.map(memory => {
              const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
              const color = CATEGORY_COLORS[memory.category];
              const plusSize = lod.renderSize * 0.4;
              const lineWidth = Math.max(2, lod.renderSize * 0.08);
              
              return (
                <Group key={memory.id}>
                  {/* Glow */}
                  {lod.shouldShowGlow && (
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize * 1.3}
                      color={color}
                      opacity={0.2}
                    />
                  )}
                  {/* Circle */}
                  <Circle
                    cx={memory.worldX}
                    cy={memory.worldY}
                    r={lod.renderSize}
                    color={color}
                    opacity={0.9}
                  />
                  {/* + sign */}
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
            
            {/* CENTER DOT */}
            <Circle cx={0} cy={0} r={12} color="white" opacity={0.9} />
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
