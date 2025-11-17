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
  const [fps, setFps] = useState(60);
  const lastTime = useSharedValue(Date.now());
  const frameCount = useSharedValue(0);
  
  // Calculate FPS using frame callback
  useFrameCallback(() => {
    'worklet';
    frameCount.value += 1;
    
    const now = Date.now();
    const elapsed = now - lastTime.value;
    
    // Update FPS every 500ms
    if (elapsed >= 500) {
      const currentFps = Math.round((frameCount.value / elapsed) * 1000);
      runOnJS(setFps)(currentFps);
      
      frameCount.value = 0;
      lastTime.value = now;
    }
  });
  
  // FPS color coding
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#10B981'; // green
    if (fps >= 40) return '#F59E0B'; // amber
    return '#EF4444'; // red
  };
  
  return (
    <View style={styles.container}>
      {/* FPS Display */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: getFpsColor(fps) }]}>
          {fps} FPS
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
    top: 60, // Below status bar
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
