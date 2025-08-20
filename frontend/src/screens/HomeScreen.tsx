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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Post } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { formatRelativeTime } from '../utils/timeFormat';
import { getImageAspectRatio, ImageAspectRatio } from '../utils/imageUtils';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';

interface Props {
  navigation: any;
}

// Video Post Component for handling expo-video hooks
const VideoPost: React.FC<{ 
  item: Post; 
  isVisible: boolean; 
}> = ({ item, isVisible }) => {
  const player = useVideoPlayer(apiService.getMediaUrl(item.media_url), (player) => {
    player.loop = true;
    player.muted = true;
  });

  React.useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <View style={styles.videoContainer}>
      <VideoView
        style={styles.postVideo}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit="cover"
        useNativeControls={false}
        crossOrigin="anonymous"
        playsInline={true}
      />
    </View>
  );
};

// Photo Post Component for handling dynamic aspect ratios
const PhotoPost: React.FC<{ 
  item: Post; 
}> = ({ item }) => {
  const [aspectRatio, setAspectRatio] = React.useState<ImageAspectRatio>({ ratio: 1, type: 'square' });

  React.useEffect(() => {
    const loadAspectRatio = async () => {
      try {
        const imageAspectRatio = await getImageAspectRatio(apiService.getMediaUrl(item.media_url));
        setAspectRatio(imageAspectRatio);
      } catch (error) {
      }
    };
    
    loadAspectRatio();
  }, [item.media_url]);

  return (
    <Image 
      source={{ uri: apiService.getMediaUrl(item.media_url) }}
      style={[styles.postImage, { aspectRatio: aspectRatio.ratio }]}
      resizeMode="cover"
    />
  );
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [visibleVideoId, setVisibleVideoId] = useState<number | null>(null);
  const [savedVisibleVideoId, setSavedVisibleVideoId] = useState<number | null>(null);
  const { user } = useAuth();
  const { showError } = useAlert();
  const isFocused = useIsFocused();

  const loadPosts = async (pageNum: number = 1, isRefresh: boolean = false) => {
    try {
      const newPosts = await apiService.getFeed(pageNum, 20);
      
      // Filter out any invalid posts that don't have IDs
      const validPosts = (newPosts || []).filter(post => post && post.id);
      
      if (pageNum === 1 || isRefresh) {
        setPosts(validPosts);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...validPosts]);
        setPage(pageNum);
      }
      
      // If we got fewer posts than requested, we've reached the end
      setHasMore(validPosts.length === 20);
    } catch (error: any) {
      if (pageNum === 1 || isRefresh) {
        showError('Failed to load posts');
      } else {
        showError('Failed to load more posts');
        // Reset hasMore on error to allow retry
        setHasMore(true);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPosts(1, true).finally(() => setIsLoading(false));
    }, [])
  );

  // Handle video pause/resume when tab focus changes
  useEffect(() => {
    if (!isFocused) {
      // Tab lost focus - save current video and pause all
      if (visibleVideoId !== null) {
        setSavedVisibleVideoId(visibleVideoId);
        setVisibleVideoId(null);
      }
    } else {
      // Tab gained focus - restore previous video if it was playing
      if (savedVisibleVideoId !== null) {
        setVisibleVideoId(savedVisibleVideoId);
        setSavedVisibleVideoId(null);
      }
    }
  }, [isFocused, visibleVideoId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setHasMore(true); // Reset pagination on refresh\n    setPage(1); // Reset page counter
    
    try {
      await loadPosts(1, true);
    } catch (error) {
      // Error already handled in loadPosts
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore && !isRefreshing) {
      setIsLoadingMore(true);
      loadPosts(page + 1).finally(() => setIsLoadingMore(false));
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // Find the first visible video post
    const visibleVideoPost = viewableItems.find((item: any) => 
      item.item && item.item.media_type === 'video' && item.isViewable
    );
    
    if (visibleVideoPost) {
      setVisibleVideoId(visibleVideoPost.item.id);
    } else {
      setVisibleVideoId(null);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 30, // Video starts playing when 30% visible
    minimumViewTime: 200, // Wait 200ms before triggering
  };

  const handleLike = async (postId: number) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.user_liked) {
        await apiService.unlikePost(postId);
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, user_liked: false, likes_count: (p.likes_count || 0) - 1 }
            : p
        ));
      } else {
        await apiService.likePost(postId);
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, user_liked: true, likes_count: (p.likes_count || 0) + 1 }
            : p
        ));
      }
    } catch (error: any) {
      showError('Failed to update like');
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            {item.user_profile_image ? (
              <Image 
                source={{ uri: `${apiService.getMediaUrl(item.user_profile_image)}?t=${Date.now()}` }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={20} color="#999" />
            )}
          </View>
          <View style={styles.userText}>
            <Text style={styles.username}>{item.username}</Text>
            <Pressable onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
              <Text style={styles.challengeTitle}>{item.challenge_title}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      
      <View style={styles.imageContainer}>
        {item.media_type === 'video' ? (
          <VideoPost 
            item={item} 
            isVisible={visibleVideoId === item.id} 
          />
        ) : (
          <PhotoPost 
            item={item} 
          />
        )}
        
        {item.media_type === 'video' && visibleVideoId !== item.id && (
          <View style={styles.playButton}>
            <Ionicons name="play" size={30} color="white" />
          </View>
        )}
        
        {item.revoked && (
          <View style={styles.revokedOverlay}>
            <View style={styles.revokedBadge}>
              <Ionicons name="warning" size={20} color="#dc3545" />
              <Text style={styles.revokedText}>Points Revoked</Text>
            </View>
            <Text style={styles.revokedSubtext}>
              This post was reviewed by an admin and points were revoked
            </Text>
          </View>
        )}
      </View>
      
      {item.caption ? (
        <Pressable 
          style={styles.captionContainer}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        >
          <Text style={styles.caption}>{item.caption}</Text>
        </Pressable>
      ) : null}
      
      <View style={styles.postFooter}>
        <View style={styles.postActions}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={item.user_liked ? 'heart' : 'heart-outline'} 
                size={24} 
                color={item.user_liked ? MagicalTheme.colors.pixiePink : '#666'} 
              />
              <Text style={styles.actionText}>{(item.likes_count ?? 0).toString()}</Text>
            </View>
          </Pressable>
          
          <Pressable 
            style={styles.actionButton}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={22} color="#666" />
              <Text style={styles.actionText}>{(item.comments_count ?? 0).toString()}</Text>
            </View>
          </Pressable>
        </View>
        
        {/* Points Badge or Pending Review */}
        {item.revoked ? null : (
          (() => {
            // For open challenges, check if it's pending review
            if (item.challenge_type === 'open' && item.challenge_status !== 'completed') {
              return (
                <View style={[styles.pointsBadge, styles.pendingBadge]}>
                  <Ionicons name="hourglass" size={12} color={MagicalTheme.colors.disneyGold} />
                  <Text style={[styles.pointsText, styles.pendingText]}>Pending Review</Text>
                </View>
              );
            }
            
            // For open challenges that are completed, only show points if this user won
            if (item.challenge_type === 'open' && item.challenge_status === 'completed') {
              if (item.challenge_completed_by === item.user_id) {
                // This user won the challenge
                return (
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>{item.challenge_points || 0} pts</Text>
                  </View>
                );
              } else {
                // This user didn't win, don't show points
                return (
                  <View style={[styles.pointsBadge, styles.notAwardedBadge]}>
                    <Text style={[styles.pointsText, styles.notAwardedText]}>Not Awarded</Text>
                  </View>
                );
              }
            }
            
            // For exclusive challenges, always show points
            return (
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsText}>{item.challenge_points || 0} pts</Text>
              </View>
            );
          })()
        )}
      </View>
      
      <Pressable onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
        <Text style={styles.timestamp}>
          {formatRelativeTime(item.created_at)}
        </Text>
      </Pressable>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="camera-outline" size={64} color={MagicalTheme.colors.enchantedPurple} />
        <View style={styles.emptySparkles}>
          <Ionicons name="sparkles" size={20} color={MagicalTheme.colors.disneyGold} style={styles.sparkle1} />
          <Ionicons name="sparkles" size={16} color={MagicalTheme.colors.pixiePink} style={styles.sparkle2} />
          <Ionicons name="sparkles" size={14} color={MagicalTheme.colors.disneyGold} style={styles.sparkle3} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>✨ No magical moments yet! ✨</Text>
      <Text style={styles.emptySubtitle}>
        Complete challenges to share your enchanted adventures and see posts from other explorers.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={MagicalTheme.colors.royalBlue} />
        <Text style={styles.footerLoaderText}>Loading more posts...</Text>
      </View>
    );
  };

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[MagicalTheme.colors.background, '#F0F4FF']}
          style={styles.loadingGradient}
        >
          <SparkleEffect count={8} size="medium" />
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={MagicalTheme.colors.royalBlue} />
            <Text style={styles.loadingText}>✨ Loading magical moments... ✨</Text>
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
        {posts.length === 0 && (
          <SparkleEffect count={6} size="small" />
        )}
        
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[MagicalTheme.colors.royalBlue]}
              tintColor={MagicalTheme.colors.royalBlue}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          // Performance optimizations for lightweight scrolling
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          getItemLayout={undefined} // Disable for dynamic height posts
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.feedContainer}
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
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  
  feedContainer: {
    paddingBottom: MagicalTheme.spacing.lg,
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
  postCard: {
    backgroundColor: MagicalTheme.colors.surface,
    marginHorizontal: MagicalTheme.spacing.md,
    marginVertical: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.gentle,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  postHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userText: {
    flex: 1,
  },
  username: {
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
  },
  challengeTitle: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.enchantedPurple,
    marginTop: 2,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  imageContainer: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 9/16,
    maxHeight: 500,
    minHeight: 300,
    backgroundColor: '#000',
    position: 'relative',
  },
  postVideo: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  revokedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  revokedText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  revokedSubtext: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  pointsBadge: {
    backgroundColor: MagicalTheme.colors.royalBlue,
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
  pendingBadge: {
    backgroundColor: MagicalTheme.colors.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    color: MagicalTheme.colors.textPrimary,
  },
  notAwardedBadge: {
    backgroundColor: MagicalTheme.colors.castleGray,
  },
  notAwardedText: {
    color: MagicalTheme.colors.textOnDark,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  caption: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  timestamp: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: MagicalTheme.spacing.lg,
    paddingHorizontal: MagicalTheme.spacing.md,
    gap: MagicalTheme.spacing.sm,
  },
  footerLoaderText: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
});

export default HomeScreen;