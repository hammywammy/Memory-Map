export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function clamp(val: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(val, min), max);
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): [number, number] {
  'worklet';
  const screenX = (worldX - cameraX) * zoom + screenWidth / 2;
  const screenY = (worldY - cameraY) * zoom + screenHeight / 2;
  return [screenX, screenY];
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): [number, number] {
  'worklet';
  const worldX = (screenX - screenWidth / 2) / zoom + cameraX;
  const worldY = (screenY - screenHeight / 2) / zoom + cameraY;
  return [worldX, worldY];
}
