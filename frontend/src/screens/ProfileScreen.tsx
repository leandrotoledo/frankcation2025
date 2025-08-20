import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { Challenge } from '../types';
import apiService from '../services/api';
import { compressProfileImageForWeb } from '../utils/webImageCompression';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalButton from '../components/common/MagicalButton';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  navigation?: any;
}

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, refreshUser } = useAuth();
  const { showError, showSuccess } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);

  useEffect(() => {
    loadActiveChallenges();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadActiveChallenges();
    }, [])
  );

  const loadActiveChallenges = async () => {
    if (!user) return;
    
    try {
      const challenges = await apiService.getChallenges();
      const userActiveChallenges = challenges.filter(
        challenge => challenge.assigned_to === user.id && challenge.status === 'in_progress'
      );
      setActiveChallenges(userActiveChallenges);
    } catch (error: any) {
    } finally {
      setIsLoadingChallenges(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Sorry, we need camera roll permissions to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6, // Optimized for mobile data usage while maintaining profile quality
      });

      if (!result.canceled && result.assets[0]) {
        setIsUpdating(true);
        
        const formData = new FormData();
        
        if (Platform.OS === 'web') {
          // For web, we need to convert the URI to a Blob and compress
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
          
          try {
            const compressedFile = await compressProfileImageForWeb(file);
            formData.append('profile_image', compressedFile, 'profile.jpg');
          } catch (error) {
            formData.append('profile_image', blob, 'profile.jpg');
          }
        } else {
          // For React Native
          formData.append('profile_image', {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            name: 'profile.jpg',
          } as any);
        }
        
        if (user) {
          formData.append('first_name', user.first_name);
          formData.append('last_name', user.last_name);
        }

        await apiService.updateProfile(formData);
        await refreshUser();
        showSuccess('Profile picture updated!');
      }
    } catch (error: any) {
      showError(error.message || 'Failed to update profile picture');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    
    const confirmed = await confirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      confirmColor: '#dc3545'
    });
    
    if (confirmed) {
      logout();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[MagicalTheme.colors.background, '#F0F4FF', MagicalTheme.colors.background]}
        style={styles.backgroundGradient}
      >
        <SparkleEffect count={6} size="small" />
        
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable 
          style={styles.avatarContainer}
          onPress={handleImagePicker}
          disabled={isUpdating}
        >
          <View>
            {user.profile_image ? (
              <Image 
                source={{ uri: `${apiService.getMediaUrl(user.profile_image)}?t=${Date.now()}` }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={MagicalTheme.colors.textMuted} />
              </View>
            )}
            <View style={styles.editIcon}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </View>
        </Pressable>
        
        <Text style={styles.name}>
          {user.first_name} {user.last_name}
        </Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{user.total_points}</Text>
          <Text style={styles.statLabel}>Total Points</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{user.challenges_completed}</Text>
          <Text style={styles.statLabel}>Challenges Completed</Text>
        </View>
      </View>

      {/* Active Challenges Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Challenges ({activeChallenges.length})</Text>
        
        {isLoadingChallenges ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={MagicalTheme.colors.royalBlue} />
            <Text style={styles.loadingText}>✨ Loading magical adventures... ✨</Text>
          </View>
        ) : activeChallenges.length > 0 ? (
          activeChallenges.map((challenge) => (
            <Pressable 
              key={challenge?.id || Math.random().toString()} 
              style={styles.challengeItem}
              onPress={() => navigation?.navigate?.('Camera', { challenge })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengePoints}>{challenge.points} pts</Text>
                </View>
                <View style={styles.challengeStatus}>
                  <Ionicons name="hourglass-outline" size={16} color={MagicalTheme.colors.disneyGold} />
                  <Text style={styles.statusText}>In Progress</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginLeft: 4 }} />
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="trophy-outline" size={48} color={MagicalTheme.colors.enchantedPurple} />
              <View style={styles.emptySparkles}>
                <Ionicons name="sparkles" size={16} color={MagicalTheme.colors.disneyGold} style={styles.sparkle1} />
                <Ionicons name="sparkles" size={12} color={MagicalTheme.colors.pixiePink} style={styles.sparkle2} />
              </View>
            </View>
            <Text style={styles.emptyText}>✨ No active adventures ✨</Text>
            <Text style={styles.emptySubtext}>Visit the Epic Quests to begin your magical journey!</Text>
          </View>
        )}
      </View>


      <MagicalButton
        title="End Adventure"
        onPress={handleLogout}
        variant="outline"
        size="large"
        icon="log-out-outline"
        style={styles.logoutButton}
        textStyle={styles.logoutText}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>✨ The Frankcation 2025 Challenge ✨</Text>
        <Text style={styles.footerText}>Where Magic Meets Adventure</Text>
      </View>
        <ConfirmComponent />
        </ScrollView>
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
  
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
    padding: MagicalTheme.spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...MagicalTheme.shadows.magical,
    borderBottomLeftRadius: MagicalTheme.borderRadius.xl,
    borderBottomRightRadius: MagicalTheme.borderRadius.xl,
    marginBottom: MagicalTheme.spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: MagicalTheme.spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: MagicalTheme.colors.disneyGold,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MagicalTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: MagicalTheme.colors.disneyGold,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: MagicalTheme.colors.enchantedPurple,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: MagicalTheme.colors.cloudWhite,
    ...MagicalTheme.shadows.subtle,
  },
  name: {
    fontSize: MagicalTheme.typography.title,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: MagicalTheme.spacing.md,
    gap: MagicalTheme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: MagicalTheme.spacing.lg,
    borderRadius: MagicalTheme.borderRadius.lg,
    alignItems: 'center',
    ...MagicalTheme.shadows.gentle,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  statNumber: {
    fontSize: MagicalTheme.typography.hero,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.royalBlue,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  section: {
    marginTop: MagicalTheme.spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: MagicalTheme.spacing.md,
    borderRadius: MagicalTheme.borderRadius.lg,
    overflow: 'hidden',
    ...MagicalTheme.shadows.gentle,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  sectionTitle: {
    fontSize: MagicalTheme.typography.heading,
    fontWeight: MagicalTheme.typography.weights.bold,
    color: MagicalTheme.colors.textPrimary,
    padding: MagicalTheme.spacing.md,
    paddingBottom: MagicalTheme.spacing.sm,
  },
  logoutButton: {
    marginHorizontal: MagicalTheme.spacing.md,
    marginVertical: MagicalTheme.spacing.lg,
  },
  logoutText: {
    color: MagicalTheme.colors.error,
  },
  footer: {
    alignItems: 'center',
    padding: MagicalTheme.spacing.xl,
  },
  footerText: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.textMuted,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: MagicalTheme.spacing.lg,
  },
  loadingText: {
    marginLeft: MagicalTheme.spacing.sm,
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MagicalTheme.spacing.md,
    paddingVertical: MagicalTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
  },
  challengeInfo: {
    flex: 1,
    marginRight: MagicalTheme.spacing.sm,
  },
  challengeTitle: {
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.semibold,
    color: MagicalTheme.colors.textPrimary,
    marginBottom: 2,
  },
  challengePoints: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.royalBlue,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  challengeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: MagicalTheme.typography.small,
    color: MagicalTheme.colors.disneyGold,
    marginLeft: 4,
    fontWeight: MagicalTheme.typography.weights.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: MagicalTheme.spacing.xxl,
    paddingHorizontal: MagicalTheme.spacing.md,
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
    top: -8,
    right: -12,
  },
  
  sparkle2: {
    position: 'absolute',
    bottom: -4,
    left: -16,
  },
  
  emptyText: {
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.semibold,
    color: MagicalTheme.colors.textPrimary,
    marginTop: MagicalTheme.spacing.sm,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: MagicalTheme.typography.caption,
    color: MagicalTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ProfileScreen;