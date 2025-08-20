import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { ToastContainer } from './src/components/ToastContainer';
import AppNavigator from './src/components/navigation/AppNavigator';

export default function App() {
  console.log('App starting...');
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <AppNavigator />
          <ToastContainer />
          <StatusBar style="light" backgroundColor="#003875" />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
