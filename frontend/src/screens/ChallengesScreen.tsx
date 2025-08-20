import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Challenge } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalButton from '../components/common/MagicalButton';

interface Props {
  navigation: any;
}

const ChallengesScreen: React.FC<Props> = ({ navigation }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filteredChallenges, setFilteredChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<'all' | 'my' | 'available'>('all');
  const [sortOption, setSortOption] = useState<'default' | 'points_asc' | 'points_desc'>('default');
  const [showFilters, setShowFilters] = useState(false);
  const { user, refreshUser } = useAuth();
  const { showError } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();

  const loadChallenges = async () => {
    try {
      const data = await apiService.getChallenges();
      setChallenges(data);
    } catch (error: any) {
      showError('Failed to load challenges');
    }
  };

  const applyFilters = () => {
    let filtered = [...challenges];

    // Apply challenge type filter
    if (challengeFilter === 'my' && user) {
      filtered = filtered.filter(challenge => 
        challenge.assigned_to === user.id || challenge.completed_by === user.id
      );
    } else if (challengeFilter === 'available') {
      filtered = filtered.filter(challenge => 
        challenge.status === 'available' && !challenge.assigned_to
      );
    }
    // 'all' shows everything, so no additional filtering needed

    // Apply sorting
    if (sortOption === 'points_asc') {
      filtered.sort((a, b) => a.points - b.points);
    } else if (sortOption === 'points_desc') {
      filtered.sort((a, b) => b.points - a.points);
    }
    // 'default' keeps original order

    setFilteredChallenges(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
      refreshUser();
    }, [])
  );

  useEffect(() => {
    loadChallenges().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    applyFilters();
  }, [challenges, challengeFilter, sortOption, user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadChallenges();
    await refreshUser();
    setIsRefreshing(false);
  };

  const handlePickChallenge = async (challengeId: number) => {
    try {
      await apiService.pickChallenge(challengeId);
      loadChallenges();
      refreshUser();
    } catch (error: any) {
      
      let errorMsg = error.message || 'Failed to pick challenge';
      
      // Handle specific error cases
      if (error.status === 409) {
        errorMsg = 'This challenge has already been picked by another user. Please try a different challenge.';
      }
      
      showError(errorMsg);
    }
  };

  const handleCancelChallenge = async (challengeId: number) => {
    const confirmed = await confirm({
      title: 'Cancel Challenge',
      message: 'Are you sure you want to cancel this challenge?',
      confirmText: 'Yes',
      cancelText: 'No'
    });

    if (confirmed) {
      try {
        await apiService.cancelChallenge(challengeId);
        loadChallenges();
        refreshUser();
      } catch (error: any) {
        const errorMsg = error.message || 'Failed to cancel challenge';
        showError(errorMsg);
      }
    }
  };

  const handleCompleteChallenge = (challenge: Challenge) => {
    navigation.navigate('Camera', { challenge });
  };

  const renderChallenge = ({ item }: { item: Challenge }) => {
    // DEBUG: Log challenge data to understand structure
    
    const isInProgress = item.status === 'in_progress' && item.assigned_to === user?.id;
    
    // For exclusive challenges: available only if no one has picked it
    // For open challenges: always available (multiple users can pick it)
    const isAvailable = item.status === 'available' && 
      (item.challenge_type === 'open' || !item.assigned_to);
    
    const isCompleted = item.status === 'completed';
    
    // Check different states for open challenges
    const userSubmissionInOpen = item.challenge_type === 'open' ? 
      item.submissions?.find(sub => sub.user_id === user?.id) : undefined;
    
    const userHasJoinedOpen = userSubmissionInOpen !== undefined;
    const userHasSubmittedOpen = userSubmissionInOpen && userSubmissionInOpen.post_id > 0;

    const handleCardPress = () => {
      if (isCompleted && item.completed_post_id) {
        // Navigate to the completed post
        navigation.navigate('PostDetail', { postId: item.completed_post_id });
      }
    };

    return (
      <Pressable 
        style={[styles.challengeCard, isCompleted && styles.completedCard]}
        onPress={isCompleted ? handleCardPress : undefined}
      >
        <LinearGradient
          colors={isCompleted 
            ? ['rgba(255, 255, 255, 0.95)', 'rgba(232, 245, 232, 0.9)']
            : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']
          }
          style={styles.challengeGradient}
        >
          <View style={styles.challengeContent}>
          {/* Open Challenge Banner */}
          {item.challenge_type === 'open' && (
            <LinearGradient
              colors={[MagicalTheme.colors.success + '20', MagicalTheme.colors.success + '10']}
              style={styles.openBanner}
            >
              <Ionicons name="people" size={16} color={MagicalTheme.colors.success} />
              <Text style={styles.openBannerText}>✨ Open for Everyone ✨</Text>
              {item.submissions && item.submissions.length > 0 && (
                <Text style={styles.openParticipantCount}>
                  • {item.submissions.filter(sub => sub.post_id > 0).length} submitted
                  {item.submissions.filter(sub => sub.post_id === 0).length > 0 && 
                    `, ${item.submissions.filter(sub => sub.post_id === 0).length} joined`
                  }
                </Text>
              )}
            </LinearGradient>
          )}

          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>{item.title}</Text>
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={MagicalTheme.colors.royalGradient}
                style={styles.pointsBadge}
              >
                <Ionicons name="sparkles" size={12} color="white" style={{ marginRight: 4 }} />
                <Text style={styles.pointsText}>{item.points} pts</Text>
              </LinearGradient>
            </View>
          </View>
          
          <Text style={styles.challengeDescription} numberOfLines={3}>
            {item.description}
          </Text>
          
          <View style={styles.challengeFooter}>
            {/* Exclusive challenge in progress */}
            {(isInProgress && item.challenge_type === 'exclusive') && (
              <View style={styles.buttonRow}>
                <MagicalButton
                  title="Complete Quest"
                  onPress={() => handleCompleteChallenge(item)}
                  variant="outline"
                  size="medium"
                  icon="camera"
                  style={{ flex: 1, marginRight: MagicalTheme.spacing.sm }}
                />
                
                <MagicalButton
                  title="Cancel"
                  onPress={() => handleCancelChallenge(item.id)}
                  variant="outline"
                  size="medium"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            
            {/* Open challenge - user has joined but not yet submitted */}
            {(userHasJoinedOpen && !userHasSubmittedOpen && !isCompleted) && (
              <View style={styles.buttonRow}>
                <MagicalButton
                  title="Submit Entry"
                  onPress={() => handleCompleteChallenge(item)}
                  variant="enchanted"
                  size="medium"
                  icon="camera"
                  style={{ flex: 1, marginRight: MagicalTheme.spacing.sm }}
                />
                
                <MagicalButton
                  title="Leave"
                  onPress={() => handleCancelChallenge(item.id)}
                  variant="outline"
                  size="medium"
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Open challenge - user has submitted and waiting for review */}
            {(userHasSubmittedOpen && !isCompleted) && (
              <View style={styles.statusBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="hourglass" size={16} color={MagicalTheme.colors.disneyGold} />
                  <Text style={[styles.statusText, { color: MagicalTheme.colors.disneyGold, fontWeight: 'bold' }]}>
                    Submitted - Under Review
                  </Text>
                </View>
              </View>
            )}
            
            {/* Available to pick */}
            {(isAvailable && !userHasJoinedOpen) && (
              <MagicalButton
                title={item.challenge_type === 'open' ? 'Join Adventure' : 'Begin Quest'}
                onPress={() => handlePickChallenge(item.id)}
                variant="outline"
                size="medium"
                icon="add-circle"
                fullWidth
              />
            )}
            
            {isCompleted && (
              <View style={styles.completedBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                  <Text style={styles.completedText}>
                    Completed by {item.completed_by_username}
                  </Text>
                </View>
                <Text style={styles.completedSubtext}>Tap to view post</Text>
              </View>
            )}
            
            {/* Only show "taken" status for exclusive challenges */}
            {(!isAvailable && !isInProgress && !isCompleted && item.challenge_type === 'exclusive') && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Taken by another player</Text>
              </View>
            )}
          </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="trophy-outline" size={64} color={MagicalTheme.colors.enchantedPurple} />
        <View style={styles.emptySparkles}>
          <Ionicons name="sparkles" size={20} color={MagicalTheme.colors.disneyGold} style={styles.sparkle1} />
          <Ionicons name="sparkles" size={16} color={MagicalTheme.colors.pixiePink} style={styles.sparkle2} />
          <Ionicons name="sparkles" size={14} color={MagicalTheme.colors.disneyGold} style={styles.sparkle3} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>✨ No magical quests available ✨</Text>
      <Text style={styles.emptySubtitle}>
        New enchanted adventures are coming soon! Check back later for exciting challenges to complete.
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
            <Text style={styles.loadingText}>✨ Loading magical challenges... ✨</Text>
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
        {filteredChallenges.length === 0 && (
          <SparkleEffect count={6} size="small" />
        )}
        
        {/* Filter Header */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
          style={styles.filterContainer}
        >
          <Pressable 
            style={styles.filterToggleButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="funnel" size={20} color={MagicalTheme.colors.royalBlue} />
            <Text style={styles.filterToggleText}>Magical Filters</Text>
            <Ionicons 
              name={showFilters ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={MagicalTheme.colors.royalBlue} 
            />
          </Pressable>
          
          {(challengeFilter !== 'all' || sortOption !== 'default') && (
            <Pressable 
              style={styles.clearFiltersButton}
              onPress={() => {
                setChallengeFilter('all');
                setSortOption('default');
              }}
            >
              <Text style={styles.clearFiltersText}>Reset</Text>
            </Pressable>
          )}
        </LinearGradient>

        {/* Filter Options */}
        {showFilters && (
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(248, 250, 255, 0.9)']}
            style={styles.filterOptions}
          >
          {/* Challenge Type Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Show:</Text>
            <View style={styles.filterButtons}>
              {(['all', 'my', 'available'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.filterButton,
                    challengeFilter === type && styles.filterButtonActive
                  ]}
                  onPress={() => setChallengeFilter(type)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    challengeFilter === type && styles.filterButtonTextActive
                  ]}>
                    {type === 'all' ? 'All' :
                     type === 'my' ? 'My' : 'Available'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Sort Options */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Sort:</Text>
            <View style={styles.filterButtons}>
              {(['default', 'points_asc', 'points_desc'] as const).map((sort) => (
                <Pressable
                  key={sort}
                  style={[
                    styles.filterButton,
                    sortOption === sort && styles.filterButtonActive
                  ]}
                  onPress={() => setSortOption(sort)}
                >
                  {sort !== 'default' && (
                    <Ionicons 
                      name={sort === 'points_asc' ? "arrow-up" : "arrow-down"} 
                      size={10} 
                      color={sortOption === sort ? "white" : MagicalTheme.colors.royalBlue} 
                    />
                  )}
                  <Text style={[
                    styles.filterButtonText,
                    sortOption === sort && styles.filterButtonTextActive
                  ]}>
                    {sort === 'default' ? 'Default' :
                     sort === 'points_asc' ? 'Low-High' : 'High-Low'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          </LinearGradient>
        )}

        <FlatList
          data={filteredChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => `${item.id}-${item.status}-${item.completed_by || 'none'}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[MagicalTheme.colors.royalBlue]}
              tintColor={MagicalTheme.colors.royalBlue}
            />
          }
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={filteredChallenges.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          removeClippedSubviews={false}
          windowSize={10}
        />
        <ConfirmComponent />
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
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  
  listContent: {
    padding: MagicalTheme.spacing.md,
    flexGrow: 1,
  },
  
  emptyState: {
    alignItems: 'center',
    padding: MagicalTheme.spacing.xxl,
    zIndex: 2,
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
  
  sparkle3: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  
  emptyTitle: {
    fontSize: MagicalTheme.typography.title,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginBottom: MagicalTheme.spacing.md,
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: MagicalTheme.spacing.lg,
  },
  challengeCard: {
    backgroundColor: 'transparent',
    borderRadius: MagicalTheme.borderRadius.lg,
    marginBottom: MagicalTheme.spacing.md,
    ...MagicalTheme.shadows.gentle,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  
  challengeGradient: {
    borderRadius: MagicalTheme.borderRadius.lg,
  },
  
  challengeContent: {
    padding: MagicalTheme.spacing.md,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeTitle: {
    flex: 1,
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginRight: MagicalTheme.spacing.md,
  },
  
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.xs + 2,
    borderRadius: MagicalTheme.borderRadius.round,
    ...MagicalTheme.shadows.subtle,
  },
  
  pointsText: {
    color: MagicalTheme.colors.textOnDark,
    fontSize: MagicalTheme.typography.small,
    fontWeight: MagicalTheme.typography.weights.bold,
  },
  
  challengeDescription: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: MagicalTheme.spacing.md,
  },
  challengeFooter: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
  },
  pickButton: {
    backgroundColor: MagicalTheme.colors.royalBlue,
  },
  completeButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  cancelButtonText: {
    color: '#dc3545',
  },
  statusBadge: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  completedCard: {
  },
  completedBadge: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  completedText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  completedSubtext: {
    color: '#28a745',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    ...MagicalTheme.shadows.subtle,
  },
  
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MagicalTheme.spacing.sm,
  },
  
  filterToggleText: {
    color: MagicalTheme.colors.royalBlue,
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.semibold,
  },
  
  clearFiltersButton: {
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.xs + 2,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    borderRadius: MagicalTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  
  clearFiltersText: {
    color: MagicalTheme.colors.textSecondary,
    fontSize: MagicalTheme.typography.caption,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  filterOptions: {
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    gap: MagicalTheme.spacing.md,
    ...MagicalTheme.shadows.subtle,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MagicalTheme.colors.royalBlue,
    backgroundColor: 'transparent',
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: MagicalTheme.colors.royalBlue,
  },
  filterButtonText: {
    color: MagicalTheme.colors.royalBlue,
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.sm,
    marginBottom: MagicalTheme.spacing.md,
    borderRadius: MagicalTheme.borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: MagicalTheme.colors.success,
    gap: MagicalTheme.spacing.xs + 2,
    ...MagicalTheme.shadows.subtle,
  },
  
  openBannerText: {
    fontSize: MagicalTheme.typography.caption,
    fontWeight: MagicalTheme.typography.weights.semibold,
    color: MagicalTheme.colors.success,
  },
  
  openParticipantCount: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.success,
    opacity: 0.8,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
});

export default ChallengesScreen;