import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMemoryStore } from '@/stores/memoryStore';
import ZoomableRadialMap from '@/components/ZoomableRadialMap';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIDEBAR_WIDTH = 60; // Slim sidebar

const SimulationScreenV2: React.FC = () => {
  const [showControls, setShowControls] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const memories = useMemoryStore(state => state.memories);
  const { controls, updateControl, updateCategoryBalance } = useMemoryStore();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Main Visualization - Full Screen */}
        <View style={styles.visualizationContainer}>
          <ZoomableRadialMap 
            memories={memories}
            width={SCREEN_WIDTH - SIDEBAR_WIDTH}
            height={SCREEN_HEIGHT}
          />
        
        {/* Stats Overlay - Top Left */}
        <View style={styles.statsOverlay}>
          <Text style={styles.statLabel}>MOMENTS</Text>
          <Text style={styles.statValue}>{memories.length.toLocaleString()}</Text>
          <Text style={styles.statSubtext}>
            {controls.timeSpanDays} days • {Math.round(memories.length / controls.timeSpanDays * 30)} per month
          </Text>
          <View style={styles.zoomHint}>
            <Text style={styles.zoomHintText}>
              🖱️ Scroll to zoom • Middle-click to pan
            </Text>
            <Text style={styles.zoomHintText}>
              📱 Pinch to zoom • Drag to pan
            </Text>
          </View>
        </View>

        {/* Legend Overlay - Bottom */}
        <View style={styles.legendOverlay}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fff', opacity: 0.3 }]} />
              <Text style={styles.legendText}>Inner Ring = Recent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fff', opacity: 0.6 }]} />
              <Text style={styles.legendText}>Outer Ring = Past</Text>
            </View>
          </View>
          <Text style={styles.legendHint}>
            Each segment represents a life category • Dot size = significance
          </Text>
        </View>
      </View>
      
      {/* Slim Left Sidebar */}
      <View style={styles.sidebar}>
        {/* Logo/Title */}
        <View style={styles.sidebarHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCenter} />
            <View style={styles.logoRing} />
          </View>
        </View>

        {/* Control Toggle */}
        <TouchableOpacity 
          style={[styles.sidebarButton, showControls && styles.sidebarButtonActive]}
          onPress={() => setShowControls(!showControls)}
        >
          <Text style={styles.sidebarIcon}>⚙</Text>
          <Text style={styles.sidebarLabel}>Controls</Text>
        </TouchableOpacity>

        {/* Info Button */}
        <TouchableOpacity style={styles.sidebarButton}>
          <Text style={styles.sidebarIcon}>ℹ</Text>
          <Text style={styles.sidebarLabel}>Info</Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Memory Count at Bottom */}
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>{memories.length}</Text>
          <Text style={styles.footerLabel}>memories</Text>
        </View>
      </View>

      {/* Expandable Control Panel */}
      {showControls && (
        <View style={styles.controlPanel}>
          <View style={styles.controlHeader}>
            <Text style={styles.controlTitle}>Simulation Controls</Text>
            <TouchableOpacity onPress={() => setShowControls(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.controlScroll} showsVerticalScrollIndicator={false}>
            {/* Quick Presets */}
            <View style={styles.controlSection}>
              <Text style={styles.sectionTitle}>Quick Presets</Text>
              <View style={styles.presetGrid}>
                <TouchableOpacity 
                  style={styles.presetButton}
                  onPress={() => {
                    updateControl('totalMemories', 200);
                    updateControl('timeSpanDays', 90);
                  }}
                >
                  <Text style={styles.presetLabel}>3 Months</Text>
                  <Text style={styles.presetValue}>200 memories</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.presetButton}
                  onPress={() => {
                    updateControl('totalMemories', 500);
                    updateControl('timeSpanDays', 365);
                  }}
                >
                  <Text style={styles.presetLabel}>1 Year</Text>
                  <Text style={styles.presetValue}>500 memories</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.presetButton}
                  onPress={() => {
                    updateControl('totalMemories', 1500);
                    updateControl('timeSpanDays', 1095);
                  }}
                >
                  <Text style={styles.presetLabel}>3 Years</Text>
                  <Text style={styles.presetValue}>1500 memories</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.presetButton}
                  onPress={() => {
                    updateControl('totalMemories', 3000);
                    updateControl('timeSpanDays', 1825);
                  }}
                >
                  <Text style={styles.presetLabel}>5 Years</Text>
                  <Text style={styles.presetValue}>3000 memories</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Manual Controls */}
            <View style={styles.controlSection}>
              <Text style={styles.sectionTitle}>Manual Settings</Text>
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Total Memories</Text>
                <Text style={styles.controlValue}>{controls.totalMemories}</Text>
              </View>
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Time Span</Text>
                <Text style={styles.controlValue}>{controls.timeSpanDays} days</Text>
              </View>
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Significance Variation</Text>
                <Text style={styles.controlValue}>{controls.significanceVariation.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.controlHint}>
              <Text style={styles.hintText}>
                💡 Tap presets for quick configurations. Full controls coming in Phase 2.
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000',
  },
  visualizationContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  
  // Sidebar Styles
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#0a0a0a',
    borderLeftWidth: 1,
    borderLeftColor: '#1a1a1a',
    paddingVertical: 20,
    alignItems: 'center',
  },
  sidebarHeader: {
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  logoRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    opacity: 0.3,
  },
  sidebarButton: {
    width: 50,
    paddingVertical: 12,
    marginTop: 20,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  sidebarButtonActive: {
    backgroundColor: '#1a1a1a',
  },
  sidebarIcon: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 4,
  },
  sidebarLabel: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sidebarFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  footerLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Overlay Styles
  statsOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 36,
  },
  statSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  zoomHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  zoomHintText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  
  legendOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#ccc',
  },
  legendHint: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Control Panel Styles
  controlPanel: {
    position: 'absolute',
    right: SIDEBAR_WIDTH,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#0f0f0f',
    borderLeftWidth: 1,
    borderLeftColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  controlScroll: {
    flex: 1,
  },
  controlSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  presetValue: {
    fontSize: 10,
    color: '#666',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  controlLabel: {
    fontSize: 12,
    color: '#ccc',
  },
  controlValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  controlHint: {
    padding: 20,
  },
  hintText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

export default SimulationScreenV2;
