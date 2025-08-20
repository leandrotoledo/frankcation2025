import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import HomeScreen from '../../screens/HomeScreen';
import ChallengesScreen from '../../screens/ChallengesScreen';
import LeaderboardScreen from '../../screens/LeaderboardScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import AdminScreen from '../../screens/AdminScreen';
import { useAuth } from '../../context/AuthContext';
import MagicalTheme from '../../theme/magicalTheme';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { user } = useAuth();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Challenges':
              iconName = focused ? 'trophy' : 'trophy-outline';
              break;
            case 'Leaderboard':
              iconName = focused ? 'podium' : 'podium-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Admin':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: MagicalTheme.colors.enchantedPurple,
        tabBarInactiveTintColor: MagicalTheme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: MagicalTheme.colors.surface,
          borderTopWidth: 2,
          borderTopColor: MagicalTheme.colors.disneyGold,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          height: Platform.OS === 'ios' ? 90 : 70,
          ...MagicalTheme.shadows.gentle,
        },
        tabBarLabelStyle: {
          fontSize: MagicalTheme.typography.small,
          fontWeight: MagicalTheme.typography.weights.semibold,
        },
        headerStyle: {
          backgroundColor: MagicalTheme.colors.magicBlue,
          ...MagicalTheme.shadows.magical,
        },
        headerTintColor: MagicalTheme.colors.textOnDark,
        headerTitleStyle: {
          fontWeight: MagicalTheme.typography.weights.bold,
          fontSize: MagicalTheme.typography.heading,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: '✨ Feed' }}
      />
      <Tab.Screen 
        name="Challenges" 
        component={ChallengesScreen}
        options={{ title: '🎯 Epic Quests' }}
      />
      <Tab.Screen 
        name="Leaderboard" 
        component={LeaderboardScreen}
        options={{ title: '🏆 Hall of Fame' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: '👑 My Adventure' }}
      />
      {user?.role === 'admin' && (
        <Tab.Screen 
          name="Admin" 
          component={AdminScreen}
          options={{ title: '⚙️ Magic Control' }}
        />
      )}
    </Tab.Navigator>
  );
};

export default TabNavigator;