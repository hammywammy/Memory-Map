import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue, useFrameCallback, runOnJS } from 'react-native-reanimated';

interface PerformanceStats {
  fps: number;
  totalMemories: number;
  visibleMemories: number;
  simplified: number;
  standard: number;
  detailed: number;
  zoom: number;
}

interface PerformanceTrackerProps {
  totalMemories: number;
  visibleMemories: number;
  simplified: number;
  standard: number;
  detailed: number;
  zoom: number;
}

export default function PerformanceTracker({
  totalMemories,
  visibleMemories,
  simplified,
  standard,
  detailed,
  zoom,
}: PerformanceTrackerProps) {
  const [frameTime, setFrameTime] = useState(16.67); // ~60fps
  const [fps, setFps] = useState(60);
  
  const lastFrameTime = useSharedValue(Date.now());
  const frameTimes = useSharedValue<number[]>([]); // Rolling average
  
  // Measure actual frame render time
  useFrameCallback(() => {
    'worklet';
    
    const now = Date.now();
    const deltaTime = now - lastFrameTime.value;
    lastFrameTime.value = now;
    
    // Keep rolling window of last 10 frames
    frameTimes.value.push(deltaTime);
    if (frameTimes.value.length > 10) {
      frameTimes.value.shift();
    }
    
    // Calculate average every frame
    if (frameTimes.value.length >= 3) {
      const avg = frameTimes.value.reduce((a, b) => a + b, 0) / frameTimes.value.length;
      const calculatedFps = Math.round(1000 / avg);
      
      // Update React state on JS thread
      runOnJS(setFrameTime)(avg);
      runOnJS(setFps)(calculatedFps);
    }
  });
  
  // FPS color coding
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#10B981'; // green
    if (fps >= 40) return '#F59E0B'; // amber
    return '#EF4444'; // red
  };
  
  // Frame time color coding
  const getFrameTimeColor = (ms: number) => {
    if (ms <= 16.67) return '#10B981'; // 60fps+
    if (ms <= 25) return '#F59E0B'; // 40-60fps
    return '#EF4444'; // <40fps
  };
  
  return (
    <View style={styles.container}>
      {/* FPS Display */}
      <View style={styles.row}>
        <Text style={[styles.fpsLabel, { color: getFpsColor(fps) }]}>
          {fps} FPS
        </Text>
        <Text style={[styles.frameTimeLabel, { color: getFrameTimeColor(frameTime) }]}>
          {frameTime.toFixed(1)}ms
        </Text>
      </View>
      
      {/* Zoom Level */}
      <View style={styles.row}>
        <Text style={styles.label}>Zoom:</Text>
        <Text style={styles.value}>{zoom.toFixed(2)}x</Text>
      </View>
      
      {/* Memory Counts */}
      <View style={styles.row}>
        <Text style={styles.label}>Total:</Text>
        <Text style={styles.value}>{totalMemories}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Visible:</Text>
        <Text style={styles.value}>{visibleMemories}</Text>
      </View>
      
      {/* LOD Breakdown */}
      <View style={styles.separator} />
      
      <View style={styles.row}>
        <Text style={styles.lodLabel}>● Simplified:</Text>
        <Text style={styles.value}>{simplified}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.lodLabel}>● Standard:</Text>
        <Text style={styles.value}>{standard}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.lodLabel}>● Detailed:</Text>
        <Text style={styles.value}>{detailed}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 12,
    minWidth: 180,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fpsLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  frameTimeLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  label: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  lodLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  value: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'monospace',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 6,
  },
});
