import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';

const LeaderboardScreen: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user: currentUser } = useAuth();
  const { showError } = useAlert();

  const loadLeaderboard = async () => {
    try {
      const data = await apiService.getLeaderboard();
      setUsers(data);
    } catch (error: any) {
      showError('Failed to load leaderboard');
    }
  };

  useEffect(() => {
    loadLeaderboard().finally(() => setIsLoading(false));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeaderboard();
    setIsRefreshing(false);
  };

  const renderUser = ({ item, index }: { item: User; index: number }) => {
    const position = index + 1;
    const isCurrentUser = item.id === currentUser?.id;
    
    let medalIcon = null;
    let medalColor = MagicalTheme.colors.textSecondary;
    
    if (position === 1) {
      medalIcon = 'trophy';
      medalColor = MagicalTheme.colors.disneyGold;
    } else if (position === 2) {
      medalIcon = 'medal';
      medalColor = '#C0C0C0'; // Silver
    } else if (position === 3) {
      medalIcon = 'medal';
      medalColor = '#CD7F32'; // Bronze
    }

    return (
      <View style={[styles.userCard, isCurrentUser && styles.currentUserCard]}>
        <LinearGradient
          colors={isCurrentUser 
            ? ['rgba(107, 70, 193, 0.1)', 'rgba(255, 215, 0, 0.05)']
            : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']
          }
          style={styles.userCardGradient}
        >
        <View style={styles.positionContainer}>
          {medalIcon ? (
            <Ionicons name={medalIcon} size={24} color={medalColor} />
          ) : (
            <Text style={styles.position}>{position}</Text>
          )}
        </View>
        
        <View style={styles.avatarContainer}>
          {item.profile_image ? (
            <Image 
              source={{ uri: apiService.getMediaUrl(item.profile_image) }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={MagicalTheme.colors.textMuted} />
            </View>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && styles.currentUserText]}>
            {item.username}
          </Text>
          <Text style={styles.fullName}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.stats}>
            {item.challenges_completed} challenges completed
          </Text>
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={[styles.points, isCurrentUser && styles.currentUserText]}>
            {item.total_points}
          </Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
        </LinearGradient>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="podium-outline" size={64} color={MagicalTheme.colors.enchantedPurple} />
        <View style={styles.emptySparkles}>
          <Ionicons name="sparkles" size={20} color={MagicalTheme.colors.disneyGold} style={styles.sparkle1} />
          <Ionicons name="sparkles" size={16} color={MagicalTheme.colors.pixiePink} style={styles.sparkle2} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>✨ No champions yet! ✨</Text>
      <Text style={styles.emptySubtitle}>
        Complete magical quests to claim your place in the Hall of Fame!
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[MagicalTheme.colors.background, '#F0F4FF']}
          style={styles.loadingGradient}
        >
          <SparkleEffect count={8} size="medium" />
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={MagicalTheme.colors.royalBlue} />
            <Text style={styles.loadingText}>✨ Loading Hall of Fame... ✨</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[MagicalTheme.colors.background, '#F0F4FF', MagicalTheme.colors.background]}
        style={styles.backgroundGradient}
      >
        {users.length === 0 && (
          <SparkleEffect count={6} size="small" />
        )}
        
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[MagicalTheme.colors.royalBlue]}
              tintColor={MagicalTheme.colors.royalBlue}
            />
          }
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MagicalTheme.colors.background,
  },
  
  backgroundGradient: {
    flex: 1,
    position: 'relative',
  },
  
  loadingContainer: {
    flex: 1,
    backgroundColor: MagicalTheme.colors.background,
  },
  
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  loadingContent: {
    alignItems: 'center',
    zIndex: 2,
  },
  
  loadingText: {
    marginTop: MagicalTheme.spacing.md,
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  
  emptyIconContainer: {
    position: 'relative',
    marginBottom: MagicalTheme.spacing.lg,
  },
  
  emptySparkles: {
    position: 'absolute',
  },
  
  sparkle1: {
    position: 'absolute',
    top: -10,
    right: -15,
  },
  
  sparkle2: {
    position: 'absolute',
    bottom: -5,
    left: -20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: MagicalTheme.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: MagicalTheme.spacing.xxl,
    zIndex: 2,
  },
  emptyTitle: {
    fontSize: MagicalTheme.typography.title,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginTop: MagicalTheme.spacing.md,
    marginBottom: MagicalTheme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: MagicalTheme.spacing.lg,
  },
  userCard: {
    backgroundColor: 'transparent',
    borderRadius: MagicalTheme.borderRadius.lg,
    marginBottom: MagicalTheme.spacing.sm,
    ...MagicalTheme.shadows.gentle,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  
  userCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: MagicalTheme.spacing.md,
    borderRadius: MagicalTheme.borderRadius.lg,
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: MagicalTheme.colors.enchantedPurple,
    ...MagicalTheme.shadows.magical,
  },
  positionContainer: {
    width: 40,
    alignItems: 'center',
  },
  position: {
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
  },
  avatarContainer: {
    marginLeft: MagicalTheme.spacing.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: MagicalTheme.colors.disneyGold,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: MagicalTheme.colors.disneyGold,
  },
  userInfo: {
    flex: 1,
    marginLeft: MagicalTheme.spacing.md,
  },
  username: {
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
  },
  currentUserText: {
    color: MagicalTheme.colors.enchantedPurple,
  },
  fullName: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    marginTop: 2,
  },
  stats: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.textMuted,
    marginTop: 4,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  points: {
    fontSize: MagicalTheme.typography.title,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
  },
  pointsLabel: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.textSecondary,
  },
});

export default LeaderboardScreen;