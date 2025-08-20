import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Post, Comment } from '../types';
import apiService from '../services/api';
import { formatRelativeTime } from '../utils/timeFormat';
import { useAuth } from '../context/AuthContext';
import { getImageAspectRatio, ImageAspectRatio } from '../utils/imageUtils';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalButton from '../components/common/MagicalButton';

interface Props {
  route: any;
  navigation: any;
}

// Video Detail Component for handling expo-video hooks
const VideoDetail: React.FC<{ mediaUrl: string }> = ({ mediaUrl }) => {
  const player = useVideoPlayer(mediaUrl, (player) => {
    player.loop = false;
    player.muted = false;
  });

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
        allowsFullscreen
        allowsPictureInPicture
        contentFit="cover"
        useNativeControls={true}
        crossOrigin="anonymous"
        playsInline={true}
      />
    </View>
  );
};

// Photo Detail Component for handling dynamic aspect ratios
const PhotoDetail: React.FC<{ mediaUrl: string }> = ({ mediaUrl }) => {
  const [aspectRatio, setAspectRatio] = React.useState<ImageAspectRatio>({ ratio: 1, type: 'square' });

  React.useEffect(() => {
    const loadAspectRatio = async () => {
      try {
        const imageAspectRatio = await getImageAspectRatio(mediaUrl);
        setAspectRatio(imageAspectRatio);
      } catch (error) {
      }
    };
    
    loadAspectRatio();
  }, [mediaUrl]);

  return (
    <Image 
      source={{ uri: mediaUrl }}
      style={[styles.postImage, { aspectRatio: aspectRatio.ratio }]}
      resizeMode="cover"
    />
  );
};

const PostDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const { showError, showSuccess } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    loadPost();
    loadComments();
  }, [postId]);

  const loadPost = async () => {
    try {
      const data = await apiService.getPost(postId);
      setPost(data);
    } catch (error: any) {
      showError('Failed to load post');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await apiService.getComments(postId);
      setComments(data);
    } catch (error: any) {
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;

    try {
      if (post.user_liked) {
        await apiService.unlikePost(post.id);
        setPost(prev => prev ? {
          ...prev,
          user_liked: false,
          likes_count: (prev.likes_count || 0) - 1
        } : null);
      } else {
        await apiService.likePost(post.id);
        setPost(prev => prev ? {
          ...prev,
          user_liked: true,
          likes_count: (prev.likes_count || 0) + 1
        } : null);
      }
    } catch (error: any) {
      showError('Failed to update like');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const comment = await apiService.createComment(postId, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
      setShowCommentInput(false);
    } catch (error: any) {
      showError('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRevokePoints = async () => {
    if (!post) return;

    const confirmed = await confirm({
      title: 'Revoke Points',
      message: 'Are you sure you want to revoke points from this post? The challenge will be returned to the available pool for any user to pick up.',
      confirmText: 'Revoke',
      cancelText: 'Cancel',
      confirmColor: '#dc3545'
    });

    if (confirmed) {
      try {
        await apiService.revokePostPoints(post.id);
        showSuccess('Points revoked successfully. The challenge has been returned to the available pool.');
        navigation.goBack();
      } catch (error: any) {
        showError(error.message || 'Failed to revoke points');
      }
    }
  };

  const renderComment = (item: Comment) => (
    <View key={item.id} style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        {item.user_profile_image ? (
          <Image 
            source={{ uri: `${apiService.getMediaUrl(item.user_profile_image)}?t=${Date.now()}` }}
            style={styles.commentAvatarImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person" size={16} color={MagicalTheme.colors.textMuted} />
        )}
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{item.username}</Text>
          <Text style={styles.commentTime}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
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
            <Text style={styles.loadingText}>✨ Loading magical post... ✨</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[MagicalTheme.colors.background, '#F0F4FF', MagicalTheme.colors.background]}
        style={styles.backgroundGradient}
      >
        <SparkleEffect count={6} size="small" />
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        bounces={true}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        removeClippedSubviews={false}
      >
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              {post.user_profile_image ? (
                <Image 
                  source={{ uri: `${apiService.getMediaUrl(post.user_profile_image)}?t=${Date.now()}` }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={20} color={MagicalTheme.colors.textMuted} />
              )}
            </View>
            <View style={styles.userText}>
              <Text style={styles.username}>{post.username}</Text>
              <Text style={styles.challengeTitle}>{post.challenge_title}</Text>
            </View>
          </View>
        </View>
        
        {post.revoked && (
          <View style={styles.revokedBanner}>
            <View style={styles.revokedIcon}>
              <Ionicons name="warning" size={24} color="#dc3545" />
            </View>
            <View style={styles.revokedContent}>
              <Text style={styles.revokedTitle}>Points Revoked</Text>
              <Text style={styles.revokedMessage}>
                This post was reviewed by an admin and points were revoked. The challenge has been returned to the available pool for any user to pick up.
              </Text>
            </View>
          </View>
        )}
        
        {post.media_type === 'video' ? (
          <VideoDetail mediaUrl={apiService.getMediaUrl(post.media_url)} />
        ) : (
          <PhotoDetail mediaUrl={apiService.getMediaUrl(post.media_url)} />
        )}
        
        <View style={styles.postActions}>
          <Pressable 
            style={styles.actionButton}
            onPress={handleLike}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={post.user_liked ? 'heart' : 'heart-outline'} 
                size={28} 
                color={post.user_liked ? MagicalTheme.colors.pixiePink : MagicalTheme.colors.textSecondary} 
              />
              <Text style={styles.actionText}>{post.likes_count || 0}</Text>
            </View>
          </Pressable>
          
          <View style={styles.rightActions}>
            {user?.role === 'admin' && (
              <Pressable 
                style={styles.revokeButton}
                onPress={handleRevokePoints}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="remove-circle" size={20} color="#dc3545" />
                  <Text style={styles.revokeButtonText}>Revoke Points</Text>
                </View>
              </Pressable>
            )}
            
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>{post.challenge_points} pts</Text>
            </View>
          </View>
        </View>
        
        {post.caption && (
          <View style={styles.captionSection}>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        )}
        
        <Text style={styles.timestamp}>
          {formatRelativeTime(post.created_at)}
        </Text>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments</Text>
          
          {isLoadingComments ? (
            <ActivityIndicator size="small" color={MagicalTheme.colors.royalBlue} style={styles.commentsLoader} />
          ) : comments.length > 0 ? (
            comments.map((comment) => renderComment(comment))
          ) : (
            <Text style={styles.noComments}>No comments yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      {!showCommentInput && (
        <Pressable 
          style={styles.fab}
          onPress={() => setShowCommentInput(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chatbubble" size={24} color="white" />
        </Pressable>
      )}

      {/* Comment Input - shown when FAB is clicked */}
      {showCommentInput && (
        <View style={styles.commentInputOverlay} pointerEvents="box-none">
          <View style={styles.commentInput}>
            <TextInput
              style={styles.textInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              maxLength={500}
              autoFocus
            />
            <Pressable
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || isSubmittingComment}
            >
              {isSubmittingComment ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setShowCommentInput(false);
                setNewComment('');
              }}
            >
              <Ionicons name="close" size={18} color={MagicalTheme.colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}
      <ConfirmComponent />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MagicalTheme.colors.background,
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
    }),
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MagicalTheme.colors.background,
  },
  errorText: {
    fontSize: MagicalTheme.typography.heading,
    color: MagicalTheme.colors.textSecondary,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  scrollView: {
    flex: 1,
  },
  postHeader: {
    padding: MagicalTheme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    ...MagicalTheme.shadows.subtle,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: MagicalTheme.spacing.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: MagicalTheme.colors.disneyGold,
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
    color: MagicalTheme.colors.textSecondary,
    marginTop: 2,
  },
  revokedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    marginTop: 0,
  },
  revokedIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  revokedContent: {
    flex: 1,
  },
  revokedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 4,
  },
  revokedMessage: {
    fontSize: 14,
    color: '#721c24',
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 9/16, // Optimized for vertical videos
    maxHeight: 600,
    minHeight: 350,
    backgroundColor: '#000',
  },
  postVideo: {
    width: '100%',
    height: '100%',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: MagicalTheme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: MagicalTheme.spacing.sm,
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    fontWeight: MagicalTheme.typography.weights.semibold,
  },
  pointsBadge: {
    backgroundColor: MagicalTheme.colors.royalBlue,
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.round,
    ...MagicalTheme.shadows.subtle,
  },
  pointsText: {
    color: MagicalTheme.colors.textOnDark,
    fontSize: MagicalTheme.typography.caption,
    fontWeight: MagicalTheme.typography.weights.bold,
  },
  captionSection: {
    padding: MagicalTheme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
  },
  caption: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textPrimary,
    lineHeight: 22,
  },
  timestamp: {
    padding: MagicalTheme.spacing.md,
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 8,
    borderBottomColor: 'rgba(255, 255, 255, 0.7)',
  },
  commentsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: MagicalTheme.spacing.md,
    ...MagicalTheme.shadows.subtle,
  },
  commentsTitle: {
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginBottom: MagicalTheme.spacing.md,
  },
  commentsLoader: {
    marginVertical: 20,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: MagicalTheme.spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MagicalTheme.colors.disneyGold,
  },
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: MagicalTheme.typography.small,
    fontWeight: MagicalTheme.typography.weights.semibold,
    color: MagicalTheme.colors.textPrimary,
    marginRight: MagicalTheme.spacing.sm,
  },
  commentText: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: MagicalTheme.typography.tiny,
    color: MagicalTheme.colors.textMuted,
  },
  noComments: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: MagicalTheme.spacing.lg,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MagicalTheme.colors.enchantedPurple,
    alignItems: 'center',
    justifyContent: 'center',
    ...MagicalTheme.shadows.magical,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      zIndex: 1000,
      boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
    }),
  },
  commentInputOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      zIndex: 999,
    }),
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: MagicalTheme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: MagicalTheme.colors.border,
    ...MagicalTheme.shadows.magical,
  },
  textInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: MagicalTheme.colors.border,
    borderRadius: MagicalTheme.borderRadius.round,
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.sm,
    marginRight: MagicalTheme.spacing.sm,
    fontSize: MagicalTheme.typography.caption,
    height: 40,
    backgroundColor: MagicalTheme.colors.surface,
  },
  sendButton: {
    backgroundColor: MagicalTheme.colors.enchantedPurple,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...MagicalTheme.shadows.subtle,
  },
  sendButtonDisabled: {
    backgroundColor: MagicalTheme.colors.textMuted,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: MagicalTheme.spacing.sm,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: MagicalTheme.colors.error,
    paddingHorizontal: MagicalTheme.spacing.sm,
    paddingVertical: MagicalTheme.spacing.xs,
    borderRadius: MagicalTheme.borderRadius.sm,
  },
  revokeButtonText: {
    color: MagicalTheme.colors.error,
    fontSize: MagicalTheme.typography.small,
    fontWeight: MagicalTheme.typography.weights.semibold,
    marginLeft: 4,
  },
});

export default PostDetailScreen;