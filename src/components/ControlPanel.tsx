import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMemoryStore } from '@/stores/memoryStore';
import { CATEGORY_COLORS, LifeCategory } from '@/types/memory';

const ControlPanel: React.FC = () => {
  const { controls, updateControl, updateCategoryBalance } = useMemoryStore();
  
  const categories = Object.keys(CATEGORY_COLORS) as LifeCategory[];
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Simulation Controls</Text>
      
      {/* Total Memories Control */}
      <View style={styles.control}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Total Memories</Text>
          <Text style={styles.value}>{controls.totalMemories}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={100}
          maximumValue={2000}
          step={50}
          value={controls.totalMemories}
          onValueChange={(value) => updateControl('totalMemories', value)}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#374151"
          thumbTintColor="#3B82F6"
        />
      </View>
      
      {/* Time Span Control */}
      <View style={styles.control}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Time Span (Days)</Text>
          <Text style={styles.value}>{controls.timeSpanDays}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={30}
          maximumValue={1825}
          step={30}
          value={controls.timeSpanDays}
          onValueChange={(value) => updateControl('timeSpanDays', value)}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#374151"
          thumbTintColor="#3B82F6"
        />
      </View>
      
      {/* Significance Variation Control */}
      <View style={styles.control}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Significance Variation</Text>
          <Text style={styles.value}>{controls.significanceVariation.toFixed(2)}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={controls.significanceVariation}
          onValueChange={(value) => updateControl('significanceVariation', value)}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#374151"
          thumbTintColor="#3B82F6"
        />
      </View>
      
      {/* Category Balance Controls */}
      <Text style={styles.sectionTitle}>Category Balance</Text>
      <Text style={styles.hint}>Adjust the distribution of life categories</Text>
      
      {categories.map((category) => (
        <View key={category} style={styles.control}>
          <View style={styles.labelRow}>
            <View style={styles.categoryLabel}>
              <View 
                style={[
                  styles.colorDot, 
                  { backgroundColor: CATEGORY_COLORS[category] }
                ]} 
              />
              <Text style={styles.label}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </View>
            <Text style={styles.value}>
              {(controls.categoryBalance[category] * 100).toFixed(0)}%
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={controls.categoryBalance[category]}
            onValueChange={(value) => updateCategoryBalance(category, value)}
            minimumTrackTintColor={CATEGORY_COLORS[category]}
            maximumTrackTintColor="#374151"
            thumbTintColor={CATEGORY_COLORS[category]}
          />
        </View>
      ))}
      
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total Distribution: {(Object.values(controls.categoryBalance).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
        </Text>
        <Text style={styles.summaryHint}>
          (doesn't need to equal 100% - values are normalized)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  control: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  summary: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  summaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryHint: {
    fontSize: 11,
    color: '#6B7280',
  },
});

export default ControlPanel;
