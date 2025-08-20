import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Challenge } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageAspectRatio, ImageAspectRatio } from '../utils/imageUtils';
import { compressChallengeImageForWeb } from '../utils/webImageCompression';
import { useAlert } from '../hooks/useAlert';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalButton from '../components/common/MagicalButton';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  route: any;
  navigation: any;
}

// Video Preview Component for handling expo-video hooks
const VideoPreview: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  const player = useVideoPlayer(videoUri, (player) => {
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
    <VideoView
      style={styles.previewVideo}
      player={player}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      contentFit="contain"
      useNativeControls={true}
      crossOrigin="anonymous"
      playsInline={true}
    />
  );
};

// Photo Preview Component for handling dynamic aspect ratios
const PhotoPreview: React.FC<{ imageUri: string }> = ({ imageUri }) => {
  const [aspectRatio, setAspectRatio] = React.useState<ImageAspectRatio>({ ratio: 1, type: 'square' });

  React.useEffect(() => {
    const loadAspectRatio = async () => {
      try {
        const imageAspectRatio = await getImageAspectRatio(imageUri);
        setAspectRatio(imageAspectRatio);
      } catch (error) {
      }
    };
    
    loadAspectRatio();
  }, [imageUri]);

  return (
    <Image 
      source={{ uri: imageUri }} 
      style={[styles.previewImage, { aspectRatio: aspectRatio.ratio }]} 
      resizeMode="cover"
    />
  );
};

const CameraScreen: React.FC<Props> = ({ route, navigation }) => {
  const { challenge }: { challenge: Challenge } = route.params;
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Background upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const { refreshUser } = useAuth();
  const { showError, showSuccess } = useAlert();

  useEffect(() => {
    const updateLayout = () => {
      setScreenHeight(Dimensions.get('window').height);
    };
    
    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);


  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      showError('Camera and photo library permissions are required to complete challenges.');
      return false;
    }
    return true;
  };

  const uploadMediaInBackground = async (file: File | null, mediaUri: string, type: 'photo' | 'video') => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web' && file) {
        // Use the actual File object for web
        formData.append('media', file);
      } else {
        // Use React Native format for mobile
        const mimeType = type === 'video' ? 'video/mp4' : 'image/jpeg';
        const fileName = type === 'video' ? 'challenge_video.mp4' : 'challenge_photo.jpg';
        
        formData.append('media', {
          uri: mediaUri,
          type: mimeType,
          name: fileName,
        } as any);
      }

      // Simulate upload progress (since we can't track real progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await apiService.uploadMedia(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedMediaId(result.media_id);
      setIsUploading(false);
      
    } catch (error: any) {
      setIsUploading(false);
      setUploadError(error.message || 'Upload failed');
    }
  };


  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      // Use native HTML file input with camera capture for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.capture = 'environment'; // This enables camera on mobile browsers
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          let processedFile = file;
          
          // Compress images for better mobile data usage
          if (file.type.startsWith('image/')) {
            try {
              processedFile = await compressChallengeImageForWeb(file);
            } catch (error) {
            }
          }
          
          const mediaUrl = URL.createObjectURL(processedFile);
          const type = file.type.startsWith('video/') ? 'video' : 'photo';
          
          setSelectedFile(processedFile);
          setSelectedMedia(mediaUrl);
          setMediaType(type);
          
          // Start background upload immediately
          uploadMediaInBackground(processedFile, mediaUrl, type);
        }
      };
      input.click();
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'all',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, // Optimized for mobile data usage
      videoMaxDuration: 60, // Increased to 60 seconds
      videoQuality: ImagePicker.VideoQuality.Medium, // Optimized for mobile
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'photo';
      
      setSelectedMedia(asset.uri);
      setMediaType(type);
      
      // Start background upload immediately
      uploadMediaInBackground(null, asset.uri, type);
    }
  };

  const handleSelectFromLibrary = async () => {
    if (Platform.OS === 'web') {
      // Use native HTML file input for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          let processedFile = file;
          
          // Compress images for better mobile data usage
          if (file.type.startsWith('image/')) {
            try {
              processedFile = await compressChallengeImageForWeb(file);
            } catch (error) {
            }
          }
          
          const mediaUrl = URL.createObjectURL(processedFile);
          const type = file.type.startsWith('video/') ? 'video' : 'photo';
          
          setSelectedFile(processedFile);
          setSelectedMedia(mediaUrl);
          setMediaType(type);
          
          // Start background upload immediately
          uploadMediaInBackground(processedFile, mediaUrl, type);
        }
      };
      input.click();
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'all',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, // Optimized for mobile data usage
      videoMaxDuration: 60, // Increased to 60 seconds
      videoQuality: ImagePicker.VideoQuality.Medium, // Optimized for mobile
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'photo';
      
      setSelectedMedia(asset.uri);
      setMediaType(type);
      
      // Start background upload immediately
      uploadMediaInBackground(null, asset.uri, type);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMedia) {
      showError('Please take a photo or video to complete the challenge.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let response;
      
      if (uploadedMediaId && !uploadError) {
        // Use pre-uploaded media (Instagram-style)
        response = await apiService.completeChallenge(challenge.id, {
          media_id: uploadedMediaId,
          caption: caption.trim() || undefined
        });
      } else {
        // Fallback to direct upload if background upload failed
        const formData = new FormData();
        
        if (Platform.OS === 'web' && selectedFile) {
          // Use the actual File object for web
          formData.append('media', selectedFile);
        } else {
          // Use React Native format for mobile
          const mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const fileName = mediaType === 'video' ? 'challenge_video.mp4' : 'challenge_photo.jpg';
          
          formData.append('media', {
            uri: selectedMedia,
            type: mimeType,
            name: fileName,
          } as any);
        }
        
        if (caption.trim()) {
          formData.append('caption', caption.trim());
        }

        response = await apiService.completeChallenge(challenge.id, {
          formData: formData
        });
      }
      
      showSuccess(`Congratulations! You earned ${response.points_earned} points.`);
      refreshUser();
      navigation.navigate('Main', { screen: 'Home' });
    } catch (error: any) {
      showError(error.message || 'Failed to submit challenge completion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[MagicalTheme.colors.background, '#F0F4FF', MagicalTheme.colors.background]}
        style={styles.backgroundGradient}
      >
        <SparkleEffect count={8} size="medium" />
        
        <ScrollView 
          style={Platform.OS === 'web' ? [styles.scrollView, styles.webScrollView] : styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { minHeight: Math.max(screenHeight + 200, 900) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
        style={styles.challengeInfo}
      >
        <View style={styles.challengeHeader}>
          <Ionicons name="sparkles" size={24} color={MagicalTheme.colors.disneyGold} />
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Ionicons name="sparkles" size={24} color={MagicalTheme.colors.disneyGold} />
        </View>
        <Text style={styles.challengeDescription}>{challenge.description}</Text>
        <LinearGradient
          colors={MagicalTheme.colors.royalGradient}
          style={styles.pointsBadge}
        >
          <Ionicons name="trophy" size={16} color={MagicalTheme.colors.textOnDark} />
          <Text style={styles.pointsText}>{challenge.points} magical points</Text>
        </LinearGradient>
      </LinearGradient>

      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
        style={styles.mediaSection}
      >
        <Text style={styles.sectionTitle}>✨ Capture Your Magical Moment ✨</Text>
        
        {selectedMedia ? (
          <View style={styles.mediaPreview}>
            {mediaType === 'video' ? (
              <VideoPreview videoUri={selectedMedia} />
            ) : (
              <PhotoPreview imageUri={selectedMedia} />
            )}
            
            {/* Upload overlay */}
            {(isUploading || uploadError) && (
              <View style={styles.uploadOverlay}>
                <View style={styles.uploadIndicator}>
                  {uploadError ? (
                    <>
                      <Ionicons name="warning" size={48} color={MagicalTheme.colors.error} />
                      <Text style={styles.uploadText}>✨ Magic Failed ✨</Text>
                      <Text style={styles.uploadSubtext}>Will retry on submit</Text>
                    </>
                  ) : isUploading ? (
                    <>
                      <ActivityIndicator size="large" color={MagicalTheme.colors.disneyGold} />
                      <Text style={styles.uploadText}>✨ Casting Magic... ✨</Text>
                      <Text style={styles.uploadSubtext}>{uploadProgress}%</Text>
                    </>
                  ) : uploadedMediaId ? (
                    <>
                      <Ionicons name="checkmark-circle" size={48} color={MagicalTheme.colors.success} />
                      <Text style={styles.uploadText}>✨ Magic Complete! ✨</Text>
                      <Text style={styles.uploadSubtext}>Ready for adventure</Text>
                    </>
                  ) : null}
                </View>
              </View>
            )}
            
            {/* Show success indicator when upload is complete */}
            {uploadedMediaId && !isUploading && !uploadError && (
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={20} color={MagicalTheme.colors.success} />
              </View>
            )}
            
            <Pressable 
              style={[styles.removeButton, isSubmitting && styles.removeButtonDisabled]}
              onPress={() => {
                if (!isSubmitting) {
                  setSelectedMedia(null);
                  setSelectedFile(null);
                  setMediaType(null);
                  setUploadedMediaId(null);
                  setUploadError(null);
                  setUploadProgress(0);
                  setIsUploading(false);
                }
              }}
              disabled={isSubmitting}
            >
              <Ionicons name="close" size={20} color={isSubmitting ? "#666" : "white"} />
            </Pressable>
            {mediaType === 'video' && !isSubmitting && (
              <View style={styles.videoIndicator}>
                <Ionicons name="videocam" size={16} color="white" />
                <Text style={styles.videoText}>Video</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.mediaButtons}>
            <MagicalButton
              title="Take Photo/Video"
              onPress={handleTakePhoto}
              variant="outline"
              size="large"
              icon="camera"
              disabled={isSubmitting}
              style={styles.mediaButton}
            />
            
            <MagicalButton
              title="Choose from Library"
              onPress={handleSelectFromLibrary}
              variant="outline"
              size="large"
              icon="images"
              disabled={isSubmitting}
              style={styles.mediaButton}
            />
          </View>
        )}
      </LinearGradient>

      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
        style={styles.captionSection}
      >
        <Text style={styles.sectionTitle}>✨ Share Your Magical Story ✨</Text>
        <TextInput
          style={[styles.captionInput, isSubmitting && styles.captionInputDisabled]}
          value={caption}
          onChangeText={setCaption}
          placeholder={isSubmitting ? "✨ Casting magic..." : "✨ Share your magical adventure..."}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
          editable={!isSubmitting}
        />
        <Text style={styles.characterCount}>{caption.length}/500</Text>
      </LinearGradient>

      <View style={styles.actionSection}>
        <MagicalButton
          title={isSubmitting ? "✨ Casting Magic..." : "✨ Complete Quest ✨"}
          onPress={handleSubmit}
          variant="outline"
          size="large"
          icon={isSubmitting ? undefined : "checkmark-circle"}
          disabled={!selectedMedia || isSubmitting}
          fullWidth
          style={styles.submitButton}
        />
        
        <MagicalButton
          title="Return to Quests"
          onPress={() => navigation.goBack()}
          variant="outline"
          size="medium"
          icon="arrow-back"
          disabled={isSubmitting}
          style={styles.cancelButton}
        />
      </View>
        </ScrollView>
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
      overflow: 'hidden',
    }),
  },
  
  backgroundGradient: {
    flex: 1,
    position: 'relative',
  },
  
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  webScrollView: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'scroll',
    WebkitOverflowScrolling: 'touch',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
  },
  challengeInfo: {
    padding: MagicalTheme.spacing.md,
    marginHorizontal: MagicalTheme.spacing.sm,
    marginBottom: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.magical,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MagicalTheme.spacing.sm,
    gap: MagicalTheme.spacing.sm,
  },
  challengeTitle: {
    fontSize: MagicalTheme.typography.title,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    textAlign: 'center',
  },
  challengeDescription: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: MagicalTheme.spacing.md,
    textAlign: 'center',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.round,
    alignSelf: 'center',
    ...MagicalTheme.shadows.subtle,
  },
  pointsText: {
    color: MagicalTheme.colors.textOnDark,
    fontSize: MagicalTheme.typography.caption,
    fontWeight: MagicalTheme.typography.weights.bold,
    marginLeft: 4,
  },
  mediaSection: {
    margin: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.lg,
    padding: MagicalTheme.spacing.md,
    ...MagicalTheme.shadows.magical,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  sectionTitle: {
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginBottom: MagicalTheme.spacing.md,
    textAlign: 'center',
  },
  mediaButtons: {
    flexDirection: 'column',
    gap: MagicalTheme.spacing.md,
  },
  mediaButton: {
    marginBottom: MagicalTheme.spacing.sm,
  },
  // mediaButtonText - Removed as using MagicalButton now
  mediaPreview: {
    position: 'relative',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    borderRadius: 12,
  },
  previewVideo: {
    width: '100%',
    aspectRatio: 4/5, // Match feed video ratio
    maxHeight: 250,
    minHeight: 150,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  captionSection: {
    margin: MagicalTheme.spacing.sm,
    borderRadius: MagicalTheme.borderRadius.lg,
    padding: MagicalTheme.spacing.md,
    ...MagicalTheme.shadows.magical,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  captionInput: {
    borderWidth: 2,
    borderColor: MagicalTheme.colors.border,
    borderRadius: MagicalTheme.borderRadius.lg,
    padding: MagicalTheme.spacing.sm,
    fontSize: MagicalTheme.typography.caption,
    backgroundColor: MagicalTheme.colors.surface,
    minHeight: 80,
    maxHeight: 80,
    color: MagicalTheme.colors.textPrimary,
    ...MagicalTheme.shadows.subtle,
  },
  characterCount: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.textMuted,
    textAlign: 'right',
    marginTop: MagicalTheme.spacing.sm,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  actionSection: {
    padding: MagicalTheme.spacing.sm,
    paddingBottom: MagicalTheme.spacing.xxl,
    gap: MagicalTheme.spacing.md,
  },
  submitButton: {
    marginBottom: MagicalTheme.spacing.sm,
  },
  cancelButton: {
    // Style handled by MagicalButton
  },
  // Upload overlay styles
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  uploadIndicator: {
    alignItems: 'center',
    padding: 20,
  },
  uploadText: {
    color: MagicalTheme.colors.textOnDark,
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    marginTop: MagicalTheme.spacing.sm,
    textAlign: 'center',
  },
  uploadSubtext: {
    color: MagicalTheme.colors.cloudWhite,
    fontSize: MagicalTheme.typography.caption,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.9,
  },
  // Disabled states
  removeButtonDisabled: {
    backgroundColor: 'rgba(102, 102, 102, 0.8)',
  },
  captionInputDisabled: {
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    color: MagicalTheme.colors.textMuted,
    opacity: 0.7,
  },
  successBadge: {
    position: 'absolute',
    top: MagicalTheme.spacing.sm,
    right: MagicalTheme.spacing.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: MagicalTheme.borderRadius.lg,
    padding: 4,
    ...MagicalTheme.shadows.subtle,
  },
});

export default CameraScreen;