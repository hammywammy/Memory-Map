export type LifeCategory = 
  | 'work'
  | 'love'
  | 'social'
  | 'family'
  | 'solo'
  | 'home'
  | 'fitness'
  | 'nightlife'
  | 'travel'
  | 'creation';

export interface Memory {
  id: string;
  timestamp: Date;
  category: LifeCategory;
  significance: number; // 0-1, affects dot size
  location?: {
    lat: number;
    lng: number;
  };
  thumbnail?: string;
}

export interface CategoryDistribution {
  category: LifeCategory;
  percentage: number;
  count: number;
}

export interface SimulationControls {
  totalMemories: number;
  timeSpanDays: number;
  categoryBalance: Record<LifeCategory, number>;
  significanceVariation: number;
}

export const CATEGORY_COLORS: Record<LifeCategory, string> = {
  work: '#3B82F6',      // blue
  love: '#EC4899',      // pink
  social: '#8B5CF6',    // purple
  family: '#10B981',    // green
  solo: '#F59E0B',      // amber
  home: '#6366F1',      // indigo
  fitness: '#14B8A6',   // teal
  nightlife: '#F97316', // orange
  travel: '#06B6D4',    // cyan
  creation: '#A855F7',  // violet
};
