import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CanvasScreen from './src/screens/CanvasScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar barStyle="light-content" />
          <CanvasScreen />
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
