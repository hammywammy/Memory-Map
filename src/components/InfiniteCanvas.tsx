import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec, processTransform3d } from '@shopify/react-native-skia';
import { useAnimatedReaction, runOnJS, withRepeat, withTiming, Easing, useSharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { TIME_RINGS, getTimeRingForDate } from '@/utils/ringGeometry';
import { CATEGORY_COLORS } from '@/types/memory';
import { useMemoryStore } from '@/stores/memoryStore';
import { layoutMemories } from '@/utils/memoryLayout';
import { calculateLOD, getRingOpacity, RENDER_BUDGETS } from '@/utils/lod';
import PerformanceTracker from '@/components/PerformanceTracker';
import { useCameraController } from '@/hooks/useCameraController';

const { width: W, height: H } = Dimensions.get('window');
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
  
  // Camera controller with Matrix4 transforms
  const { gesture, scale, translateX, translateY, focalX, focalY } = useCameraController({
    minZoom: 0.1,
    maxZoom: 10,
  });
  
  const [visibleCount, setVisibleCount] = useState(0);
  const [simplifiedCount, setSimplifiedCount] = useState(0);
  const [standardCount, setStandardCount] = useState(0);
  const [detailedCount, setDetailedCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  
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

  // Calculate visible memories based on camera transform
  const renderData = useSharedValue<RenderData>({
    simplified: [],
    standard: [],
    detailed: [],
    zoom: 1,
  });

  useAnimatedReaction(
    () => ({
      zoom: scale.value,
      ox: translateX.value,
      oy: translateY.value,
    }),
    (camera) => {
      'worklet';
      
      const worldWidth = W / camera.zoom;
      const worldHeight = H / camera.zoom;
      const padding = VIEWPORT_PADDING / camera.zoom;
      
      const cameraCenterX = -camera.ox / camera.zoom;
      const cameraCenterY = -camera.oy / camera.zoom;
      
      const bounds = {
        minX: cameraCenterX - worldWidth / 2 - padding,
        maxX: cameraCenterX + worldWidth / 2 + padding,
        minY: cameraCenterY - worldHeight / 2 - padding,
        maxY: cameraCenterY + worldHeight / 2 + padding,
      };
      
      const visible = positionedMemories.filter(m => 
        m.worldX >= bounds.minX &&
        m.worldX <= bounds.maxX &&
        m.worldY >= bounds.minY &&
        m.worldY <= bounds.maxY
      );
      
      const simplified: PositionedMemoryWithLOD[] = [];
      const standard: PositionedMemoryWithLOD[] = [];
      const detailed: PositionedMemoryWithLOD[] = [];
      
      for (const memory of visible) {
        const lod = calculateLOD(memory.baseSize, camera.zoom, memory.significance);
        
        if (lod.level === 'simplified' && simplified.length < RENDER_BUDGETS.simplified) {
          simplified.push(memory);
        } else if (lod.level === 'standard' && standard.length < RENDER_BUDGETS.standard) {
          standard.push(memory);
        } else if (lod.level === 'detailed' && detailed.length < RENDER_BUDGETS.detailed) {
          detailed.push(memory);
        }
      }
      
      renderData.value = { simplified, standard, detailed, zoom: camera.zoom };
    }
  );

  useAnimatedReaction(
    () => pulseAnim.value,
    (pulse) => {
      'worklet';
      runOnJS(setCurrentPulse)(pulse);
    }
  );

  useAnimatedReaction(
    () => ({
      simplified: renderData.value.simplified,
      standard: renderData.value.standard,
      detailed: renderData.value.detailed,
      zoom: renderData.value.zoom,
      ringOpacity: getRingOpacity(scale.value),
    }),
    (current, previous) => {
      'worklet';
      
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
        runOnJS(setSimplifiedMemories)(current.simplified);
        runOnJS(setStandardMemories)(current.standard);
        runOnJS(setDetailedMemories)(current.detailed);
      }
    }
  );

  // Canvas transform - combine centering with camera
  const canvasTransform = useDerivedValue(() => {
    'worklet';
    
    // Compose transforms: center screen + pan + focal zoom
    return processTransform3d([
      // Center the canvas
      { translateX: W / 2 },
      { translateY: H / 2 },
      // Apply panning
      { translateX: translateX.value },
      { translateY: translateY.value },
      // Apply scaling (no focal point needed here - we'll use origin prop)
      { scale: scale.value },
    ]);
  });

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
      
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Apply transform with focal point as origin */}
            <Group
              transform={canvasTransform}
              origin={{ x: focalX, y: focalY }}
            >
              {/* Time rings */}
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
              
              {/* Simplified memories */}
              {simplifiedMemories.map(memory => {
                const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
                const color = CATEGORY_COLORS[memory.category];
                const pulse = currentPulse;
                const glowRadius = lod.renderSize * (1 + pulse * 1.5);
                const glowOpacity = 0.5 * (1 - pulse * 0.6);
                
                return (
                  <Group key={memory.id}>
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={glowRadius}
                      color={color}
                      opacity={glowOpacity * 0.4}
                    />
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize * (1 + pulse * 0.5)}
                      color={color}
                      opacity={glowOpacity * 0.7}
                    />
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
              
              {/* Standard memories */}
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
              
              {/* Detailed memories */}
              {detailedMemories.map(memory => {
                const lod = calculateLOD(memory.baseSize, zoomLevel, memory.significance);
                const color = CATEGORY_COLORS[memory.category];
                const plusSize = lod.renderSize * 0.4;
                const lineWidth = Math.max(2, lod.renderSize * 0.08);
                
                return (
                  <Group key={memory.id}>
                    {lod.shouldShowGlow && (
                      <Circle
                        cx={memory.worldX}
                        cy={memory.worldY}
                        r={lod.renderSize * 1.3}
                        color={color}
                        opacity={0.2}
                      />
                    )}
                    <Circle
                      cx={memory.worldX}
                      cy={memory.worldY}
                      r={lod.renderSize}
                      color={color}
                      opacity={0.9}
                    />
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
              
              {/* Center point */}
              <Circle cx={0} cy={0} r={12} color="white" opacity={0.9} />
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
