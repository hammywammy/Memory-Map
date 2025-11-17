/**
 * LOD (Level of Detail) System
 * Determines how memories should be rendered based on zoom level
 */

export type LODLevel = 'particle' | 'dot' | 'circle' | 'detailed';

export interface LODConfig {
  level: LODLevel;
  minZoom: number;
  maxZoom: number;
  memorySize: number; // base size in pixels
  showGlow: boolean;
  showThumbnail: boolean;
  renderBudget: number; // max memories to render at this LOD
}

// LOD definitions based on zoom level
export const LOD_CONFIGS: LODConfig[] = [
  {
    level: 'particle',
    minZoom: 0,
    maxZoom: 0.3,
    memorySize: 3,
    showGlow: false,
    showThumbnail: false,
    renderBudget: 10000,
  },
  {
    level: 'dot',
    minZoom: 0.3,
    maxZoom: 1.0,
    memorySize: 8,
    showGlow: false,
    showThumbnail: false,
    renderBudget: 5000,
  },
  {
    level: 'circle',
    minZoom: 1.0,
    maxZoom: 3.0,
    memorySize: 18,
    showGlow: true,
    showThumbnail: false,
    renderBudget: 2000,
  },
  {
    level: 'detailed',
    minZoom: 3.0,
    maxZoom: Infinity,
    memorySize: 36,
    showGlow: true,
    showThumbnail: true,
    renderBudget: 500,
  },
];

/**
 * Get LOD configuration for current zoom level
 */
export function getLODForZoom(zoom: number): LODConfig {
  'worklet';
  for (const config of LOD_CONFIGS) {
    if (zoom >= config.minZoom && zoom < config.maxZoom) {
      return config;
    }
  }
  return LOD_CONFIGS[LOD_CONFIGS.length - 1];
}

/**
 * Calculate actual memory size based on LOD and significance
 * Significance ranges from 0-1 and affects size
 */
export function getMemoryDisplaySize(
  baseSize: number,
  significance: number,
  zoom: number
): number {
  'worklet';
  // Significance multiplier: 0.5x to 1.5x
  const significanceFactor = 0.5 + significance;
  
  // Apply zoom factor (memories grow with zoom for better visibility)
  const zoomFactor = Math.sqrt(zoom);
  
  return baseSize * significanceFactor * zoomFactor;
}

/**
 * Determine if a ring should show labels based on zoom
 */
export function shouldShowRingLabels(zoom: number): boolean {
  'worklet';
  return zoom >= 0.5;
}

/**
 * Calculate ring line opacity based on zoom
 */
export function getRingOpacity(zoom: number): number {
  'worklet';
  if (zoom < 0.3) return 0.1;
  if (zoom < 1.0) return 0.2 + (zoom - 0.3) * 0.3;
  if (zoom < 3.0) return 0.4;
  return 0.5;
}
