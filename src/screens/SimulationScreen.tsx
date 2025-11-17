import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { useMemoryStore } from '@/stores/memoryStore';
import RadialMemoryMap from '@/components/RadialMemoryMap';
import ControlPanel from '@/components/ControlPanel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SimulationScreen: React.FC = () => {
  const [showControls, setShowControls] = useState(true);
  const memories = useMemoryStore(state => state.memories);
  
  const visualizationHeight = showControls 
    ? SCREEN_HEIGHT * 0.55 
    : SCREEN_HEIGHT * 0.95;
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Memory Map Simulation</Text>
          <Text style={styles.subtitle}>{memories.length} moments visualized</Text>
        </View>
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={() => setShowControls(!showControls)}
        >
          <Text style={styles.toggleText}>
            {showControls ? '◀ Hide' : '▶ Controls'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Radial Visualization */}
      <View style={[styles.visualizationContainer, { height: visualizationHeight }]}>
        <RadialMemoryMap 
          memories={memories}
          width={SCREEN_WIDTH}
          height={visualizationHeight}
        />
        
        {/* Legend overlay */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>Center = Now • Outer Rings = Past</Text>
          <Text style={styles.legendText}>Segments = Life Categories</Text>
        </View>
      </View>
      
      {/* Control Panel */}
      {showControls && (
        <View style={styles.controlsContainer}>
          <ControlPanel />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1F2937',
    borderRadius: 6,
  },
  toggleText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  visualizationContainer: {
    backgroundColor: '#000',
    position: 'relative',
  },
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  legendText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginVertical: 2,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
});

export default SimulationScreen;
