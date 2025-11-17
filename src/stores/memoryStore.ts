import { create } from 'zustand';
import { Memory, SimulationControls, LifeCategory } from '@/types/memory';

interface MemoryStore {
  memories: Memory[];
  controls: SimulationControls;
  
  // Actions
  generateMemories: () => void;
  updateControl: <K extends keyof SimulationControls>(
    key: K,
    value: SimulationControls[K]
  ) => void;
  updateCategoryBalance: (category: LifeCategory, value: number) => void;
}

const defaultControls: SimulationControls = {
  totalMemories: 500,
  timeSpanDays: 365,
  categoryBalance: {
    work: 0.3,
    love: 0.15,
    social: 0.2,
    family: 0.1,
    solo: 0.05,
    home: 0.05,
    fitness: 0.05,
    nightlife: 0.03,
    travel: 0.04,
    creation: 0.03,
  },
  significanceVariation: 0.5,
};

// Mock data generator
function generateMockMemories(controls: SimulationControls): Memory[] {
  const memories: Memory[] = [];
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const timeSpanMs = controls.timeSpanDays * msPerDay;
  
  // Convert category balance to cumulative distribution
  const categories = Object.keys(controls.categoryBalance) as LifeCategory[];
  const cumulative: number[] = [];
  let sum = 0;
  categories.forEach(cat => {
    sum += controls.categoryBalance[cat];
    cumulative.push(sum);
  });
  
  for (let i = 0; i < controls.totalMemories; i++) {
    // Random timestamp within timespan
    const timestamp = new Date(now.getTime() - Math.random() * timeSpanMs);
    
    // Pick category based on distribution
    const rand = Math.random();
    let category: LifeCategory = 'work';
    for (let j = 0; j < cumulative.length; j++) {
      if (rand <= cumulative[j]) {
        category = categories[j];
        break;
      }
    }
    
    // Calculate significance with variation
    const baseSignificance = 0.3 + Math.random() * 0.7;
    const variation = (Math.random() - 0.5) * controls.significanceVariation;
    const significance = Math.max(0.1, Math.min(1, baseSignificance + variation));
    
    memories.push({
      id: `mem-${i}`,
      timestamp,
      category,
      significance,
    });
  }
  
  // Sort by timestamp (oldest to newest)
  return memories.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: generateMockMemories(defaultControls),
  controls: defaultControls,
  
  generateMemories: () => {
    const { controls } = get();
    set({ memories: generateMockMemories(controls) });
  },
  
  updateControl: (key, value) => {
    set(state => ({
      controls: { ...state.controls, [key]: value }
    }));
    get().generateMemories();
  },
  
  updateCategoryBalance: (category, value) => {
    set(state => ({
      controls: {
        ...state.controls,
        categoryBalance: {
          ...state.controls.categoryBalance,
          [category]: value,
        }
      }
    }));
    get().generateMemories();
  },
}));
