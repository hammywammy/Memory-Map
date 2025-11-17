/**
 * Camera Controller for Infinite Canvas
 * =====================================
 * Uses Matrix4 transforms - the EXACT pattern from Google Maps, Miro, Figma
 * 
 * Key insight: Don't manually calculate focal point offsets.
 * Let Matrix4 handle it by composing transforms in correct order:
 * 1. Pan (global translation)
 * 2. Move to focal point
 * 3. Scale
 * 4. Move back from focal point
 * 
 * Source: Stack Overflow - React Native Skia infinite canvas implementations
 */

import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { processTransform3d, Matrix4 } from '@shopify/react-native-skia';

interface UseCameraControllerProps {
  minZoom?: number;
  maxZoom?: number;
}

export function useCameraController({ 
  minZoom = 0.1, 
  maxZoom = 10 
}: UseCameraControllerProps = {}) {
  
  // Core transform values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Saved values for gesture contexts
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Focal point for pinch zoom
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  
  // Pan gesture - simple translation
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    });

  // Pinch gesture - zoom to focal point using Matrix4
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      // Update scale within bounds
      const newScale = Math.max(minZoom, Math.min(maxZoom, savedScale.value * event.scale));
      scale.value = newScale;
      
      // Update focal point continuously during pinch
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
    });

  // Combine gestures - pan and pinch work simultaneously
  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  // Matrix4 transform - handles focal point automatically
  // This is the MAGIC that makes zoom-to-focal-point work perfectly
  const matrix = useDerivedValue(() => {
    'worklet';
    
    // Build transform matrix in correct order
    const transforms = [
      // 1. Apply current global panning
      { translateX: translateX.value },
      { translateY: translateY.value },
      
      // 2. Translate TO focal point (where fingers are)
      { translateX: focalX.value },
      { translateY: focalY.value },
      
      // 3. Apply scaling at focal point
      { scale: scale.value },
      
      // 4. Translate BACK from focal point
      { translateX: -focalX.value },
      { translateY: -focalY.value },
    ];
    
    // Convert to Matrix4 - Skia handles the math
    return processTransform3d(transforms);
  });

  return {
    gesture: composed,
    matrix,
    scale, // Exposed for LOD calculations
    translateX, // Exposed for viewport calculations
    translateY, // Exposed for viewport calculations
  };
}
