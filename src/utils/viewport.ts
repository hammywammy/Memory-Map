/**
 * Viewport System - Industry Standard Infinite Canvas
 * Based on Miro, Figma, Excalidraw architecture
 * 
 * Core Principles:
 * 1. World space (infinite) vs Screen space (viewport)
 * 2. Camera navigates through world space
 * 3. Viewport culling - only render visible objects
 * 4. Efficient coordinate transforms
 */

export interface Camera {
  x: number;        // Camera position in world space
  y: number;
  zoom: number;     // Scale factor (1 = 100%)
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Screen to World coordinate conversion
 * Used for: Touch events, clicks, interactions
 */
export function screenToWorld(
  screenPoint: Point,
  camera: Camera,
  screenWidth: number,
  screenHeight: number
): Point {
  return {
    x: (screenPoint.x - screenWidth / 2) / camera.zoom + camera.x,
    y: (screenPoint.y - screenHeight / 2) / camera.zoom + camera.y,
  };
}

/**
 * World to Screen coordinate conversion
 * Used for: Rendering objects on screen
 */
export function worldToScreen(
  worldPoint: Point,
  camera: Camera,
  screenWidth: number,
  screenHeight: number
): Point {
  return {
    x: (worldPoint.x - camera.x) * camera.zoom + screenWidth / 2,
    y: (worldPoint.y - camera.y) * camera.zoom + screenHeight / 2,
  };
}

/**
 * Get visible world bounds for viewport culling
 * Only objects within these bounds need to be rendered
 */
export function getVisibleBounds(
  camera: Camera,
  screenWidth: number,
  screenHeight: number,
  padding: number = 100
): Bounds {
  const halfWidth = (screenWidth / 2 + padding) / camera.zoom;
  const halfHeight = (screenHeight / 2 + padding) / camera.zoom;
  
  return {
    minX: camera.x - halfWidth,
    maxX: camera.x + halfWidth,
    minY: camera.y - halfHeight,
    maxY: camera.y + halfHeight,
  };
}

/**
 * Check if point is visible in viewport
 * Critical for viewport culling performance
 */
export function isPointVisible(
  point: Point,
  bounds: Bounds
): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Clamp zoom to reasonable limits
 * Prevents extreme zoom levels that break rendering
 */
export function clampZoom(
  zoom: number,
  min: number = 0.01,
  max: number = 100
): number {
  return Math.max(min, Math.min(max, zoom));
}

/**
 * Zoom towards a specific point (like cursor position)
 * Keeps the focal point stationary while zooming
 * This is the "pinch to zoom" feel users expect
 */
export function zoomTowards(
  camera: Camera,
  focalScreenPoint: Point,
  zoomDelta: number,
  screenWidth: number,
  screenHeight: number
): Camera {
  // Convert focal point to world coordinates
  const worldFocal = screenToWorld(focalScreenPoint, camera, screenWidth, screenHeight);
  
  // Calculate new zoom level
  const newZoom = clampZoom(camera.zoom * (1 + zoomDelta));
  const zoomRatio = newZoom / camera.zoom;
  
  // Adjust camera position to keep focal point stationary
  return {
    x: worldFocal.x - (worldFocal.x - camera.x) / zoomRatio,
    y: worldFocal.y - (worldFocal.y - camera.y) / zoomRatio,
    zoom: newZoom,
  };
}
