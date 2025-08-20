import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import MagicalTheme from '../../theme/magicalTheme';
import TabNavigator from './TabNavigator';
import LoginScreen from '../../screens/LoginScreen';
import RegisterScreen from '../../screens/RegisterScreen';
import ChallengeDetailScreen from '../../screens/ChallengeDetailScreen';
import PostDetailScreen from '../../screens/PostDetailScreen';
import CameraScreen from '../../screens/CameraScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MagicalTheme.colors.royalBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="ChallengeDetail" 
              component={ChallengeDetailScreen}
              options={{ 
                headerShown: true,
                headerStyle: { 
                  backgroundColor: MagicalTheme.colors.magicBlue,
                  ...MagicalTheme.shadows.magical 
                },
                headerTintColor: MagicalTheme.colors.textOnDark,
                headerTitle: '✨ Quest Details',
                headerTitleStyle: {
                  fontWeight: MagicalTheme.typography.weights.bold,
                  fontSize: MagicalTheme.typography.heading,
                }
              }}
            />
            <Stack.Screen 
              name="PostDetail" 
              component={PostDetailScreen}
              options={{ 
                headerShown: true,
                headerStyle: { 
                  backgroundColor: MagicalTheme.colors.magicBlue,
                  ...MagicalTheme.shadows.magical 
                },
                headerTintColor: MagicalTheme.colors.textOnDark,
                headerTitle: '✨ Magical Moment',
                headerTitleStyle: {
                  fontWeight: MagicalTheme.typography.weights.bold,
                  fontSize: MagicalTheme.typography.heading,
                }
              }}
            />
            <Stack.Screen 
              name="Camera" 
              component={CameraScreen}
              options={{ 
                headerShown: true,
                headerStyle: { 
                  backgroundColor: MagicalTheme.colors.magicBlue,
                  ...MagicalTheme.shadows.magical 
                },
                headerTintColor: MagicalTheme.colors.textOnDark,
                headerTitle: '✨ Complete Quest',
                headerTitleStyle: {
                  fontWeight: MagicalTheme.typography.weights.bold,
                  fontSize: MagicalTheme.typography.heading,
                }
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default AppNavigator;