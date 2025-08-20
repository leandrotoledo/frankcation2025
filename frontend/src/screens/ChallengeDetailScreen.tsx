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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Challenge } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';

interface Props {
  route: any;
  navigation: any;
}

const ChallengeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { challengeId } = route.params;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, refreshUser } = useAuth();
  const { showError } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    loadChallenge();
  }, [challengeId]);

  const loadChallenge = async () => {
    try {
      const data = await apiService.getChallenge(challengeId);
      setChallenge(data);
    } catch (error: any) {
      showError('Failed to load challenge details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickChallenge = async () => {
    if (!challenge) return;

    try {
      await apiService.pickChallenge(challenge.id);
      loadChallenge();
      refreshUser();
    } catch (error: any) {
      showError(error.message || 'Failed to pick challenge');
    }
  };

  const handleCancelChallenge = async () => {
    if (!challenge) return;
    
    const confirmed = await confirm({
      title: 'Cancel Challenge',
      message: 'Are you sure you want to cancel this challenge?',
      confirmText: 'Yes',
      cancelText: 'No'
    });

    if (confirmed) {
      try {
        await apiService.cancelChallenge(challenge.id);
        loadChallenge();
        refreshUser();
      } catch (error: any) {
        const errorMsg = error.message || 'Failed to cancel challenge';
        showError(errorMsg);
      }
    }
  };

  const handleCompleteChallenge = () => {
    if (!challenge) return;
    navigation.navigate('Camera', { challenge });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Challenge not found</Text>
      </View>
    );
  }

  const isInProgress = challenge.status === 'in_progress' && challenge.assigned_to === user?.id;
  const isAvailable = challenge.status === 'available' && !challenge.assigned_to;


  return (
    <ScrollView style={styles.container}>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{challenge.title}</Text>
          <View style={styles.pointsBadge}>
            <Ionicons name="trophy" size={16} color="white" />
            <Text style={styles.pointsText}>{challenge.points} points</Text>
          </View>
        </View>
        
        <Text style={styles.description}>{challenge.description}</Text>
        
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Challenge Info</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.infoText}>
              Created {new Date(challenge.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="flag" size={16} color="#666" />
            <Text style={styles.infoText}>Status: {challenge.status}</Text>
          </View>
        </View>
        
        <View style={styles.actionSection}>
          {isInProgress && (
            <View style={styles.buttonContainer}>
              <Pressable 
                style={[styles.button, styles.completeButton]}
                onPress={handleCompleteChallenge}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="camera" size={20} color="white" />
                  <Text style={styles.buttonText}>Complete Challenge</Text>
                </View>
              </Pressable>
              
              <Pressable 
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelChallenge}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="close" size={20} color="#dc3545" />
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
                </View>
              </Pressable>
            </View>
          )}
          
          {isAvailable && (
            <Pressable 
              style={[styles.button, styles.pickButton]}
              onPress={handlePickChallenge}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={20} color="white" />
                <Text style={styles.buttonText}>Pick This Challenge</Text>
              </View>
            </Pressable>
          )}
          
          {!isAvailable && !isInProgress && (
            <View style={styles.statusContainer}>
              <Ionicons name="lock-closed" size={24} color="#999" />
              <Text style={styles.statusText}>This challenge is currently taken by another player</Text>
            </View>
          )}
        </View>
      </View>
      <ConfirmComponent />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 16,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
  },
  pointsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 24,
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionSection: {
    marginTop: 8,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  pickButton: {
    backgroundColor: '#ff6b35',
  },
  completeButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#dc3545',
  },
  statusContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default ChallengeDetailScreen;