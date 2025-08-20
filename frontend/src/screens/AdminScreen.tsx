import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Challenge, ChallengeSubmission } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';

const AdminScreen: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const { showError, showSuccess } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();
  const [filteredChallenges, setFilteredChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: '',
    challenge_type: 'exclusive' as 'exclusive' | 'open',
  });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'in_progress' | 'completed'>('all');
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [userFilter, setUserFilter] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  
  // Award modal states
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedChallengeForAward, setSelectedChallengeForAward] = useState<Challenge | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<ChallengeSubmission | null>(null);
  
  const { user } = useAuth();
  const navigation = useNavigation();

  const getStatusInfo = (challenge: Challenge) => {
    if (challenge.status === 'completed') {
      return { text: 'Completed', color: '#28a745', bgColor: '#d4edda' };
    } else if (challenge.assigned_to) {
      return { text: 'In Progress', color: '#fd7e14', bgColor: '#ffeaa7' };
    } else {
      return { text: 'Available', color: '#6c757d', bgColor: '#e2e3e5' };
    }
  };

  const handleUnassignChallenge = async (challengeId: number) => {
    const confirmed = await confirm({
      title: 'Unassign Challenge',
      message: 'Are you sure you want to unassign this challenge?',
      confirmText: 'Yes',
      cancelText: 'No'
    });

    if (confirmed) {
      try {
        await apiService.unassignChallenge(challengeId);
        await loadChallenges();
      } catch (error: any) {
        showError(error.message || 'Failed to unassign challenge');
      }
    }
  };

  const handleDeleteChallenge = async (challengeId: number) => {
    const confirmed = await confirm({
      title: 'Delete Challenge',
      message: 'Are you sure you want to delete this challenge? This action cannot be undone.',
      confirmText: 'Yes',
      cancelText: 'No',
      confirmColor: '#dc3545'
    });

    if (confirmed) {
      try {
        await apiService.deleteChallenge(challengeId);
        await loadChallenges();
      } catch (error: any) {
        showError(error.message || 'Failed to delete challenge');
      }
    }
  };

  const handleAwardChallenge = async () => {
    if (!selectedChallengeForAward || !selectedWinner) return;

    const confirmed = await confirm({
      title: 'Award Challenge',
      message: `Award ${selectedChallengeForAward.points} points to ${selectedWinner.username}?`,
      confirmText: 'Award',
      cancelText: 'Cancel',
      confirmColor: '#28a745'
    });

    if (confirmed) {
      try {
        await apiService.awardChallenge(selectedChallengeForAward.id, selectedWinner.user_id);
        showSuccess(`Challenge awarded to ${selectedWinner.username}!`);
        setShowAwardModal(false);
        setSelectedChallengeForAward(null);
        setSelectedWinner(null);
        await loadChallenges();
      } catch (error: any) {
        showError(error.message || 'Failed to award challenge');
      }
    }
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [challenges, statusFilter, filterStartDate, filterEndDate, userFilter]);

  const loadChallenges = async () => {
    try {
      const data = await apiService.getAllChallenges();
      setChallenges(data || []);
      
      // Extract unique users for filter dropdown
      const users = new Set<string>();
      (data || []).forEach(challenge => {
        if (challenge.assigned_to_username) users.add(challenge.assigned_to_username);
        if (challenge.completed_by_username) users.add(challenge.completed_by_username);
      });
      setAvailableUsers(Array.from(users).sort());
    } catch (error: any) {
      setChallenges([]);
      showError('Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...challenges];

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'available') {
        filtered = filtered.filter(challenge => !challenge.assigned_to && challenge.status !== 'completed');
      } else if (statusFilter === 'in_progress') {
        filtered = filtered.filter(challenge => challenge.assigned_to && challenge.status !== 'completed');
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(challenge => challenge.status === 'completed');
      }
    }

    // Filter by start date
    if (filterStartDate) {
      filtered = filtered.filter(challenge => {
        if (!challenge.start_date) return false;
        return new Date(challenge.start_date) >= filterStartDate;
      });
    }

    // Filter by end date
    if (filterEndDate) {
      filtered = filtered.filter(challenge => {
        if (!challenge.end_date) return false;
        return new Date(challenge.end_date) <= filterEndDate;
      });
    }

    // Filter by user
    if (userFilter) {
      filtered = filtered.filter(challenge => 
        challenge.assigned_to_username === userFilter || 
        challenge.completed_by_username === userFilter
      );
    }

    setFilteredChallenges(filtered);
  };


  const handleCreateChallenge = async () => {
    if (!formData.title.trim() || !formData.description.trim() || !formData.points.trim()) {
      showError('Please fill in all fields');
      return;
    }

    const points = parseInt(formData.points);
    if (isNaN(points) || points < 1) {
      showError('Points must be a valid number greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title.trim());
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('points', formData.points);
      formDataToSend.append('challenge_type', formData.challenge_type);
      
      if (startDate) {
        formDataToSend.append('start_date', startDate.toISOString());
      }
      
      if (endDate) {
        formDataToSend.append('end_date', endDate.toISOString());
      }


      await apiService.createChallenge(formDataToSend);
      showSuccess('Challenge created successfully!');
      
      // Reset form
      setFormData({ title: '', description: '', points: '', challenge_type: 'exclusive' });
      setStartDate(null);
      setEndDate(null);
      setShowCreateForm(false);
      await loadChallenges();
    } catch (error: any) {
      showError(error.message || 'Failed to create challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#ccc" />
        <Text style={styles.accessDeniedText}>Admin Access Required</Text>
        <Text style={styles.accessDeniedSubtext}>
          You need admin privileges to access this section.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setOpenMenuId(null)} style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => setShowCreateForm(!showCreateForm)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.createButtonText}>New Challenge</Text>
          </View>
        </Pressable>
      </View>

      {showCreateForm && (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>Create New Challenge</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(value) => setFormData(prev => ({ ...prev, title: value }))}
              placeholder="Challenge title"
              maxLength={100}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => setFormData(prev => ({ ...prev, description: value }))}
              placeholder="Describe what users need to do..."
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Points</Text>
            <TextInput
              style={styles.input}
              value={formData.points}
              onChangeText={(value) => setFormData(prev => ({ ...prev, points: value }))}
              placeholder="Points to award (e.g., 100)"
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Challenge Type</Text>
            <View style={styles.challengeTypeContainer}>
              <Pressable
                style={[
                  styles.challengeTypeButton,
                  formData.challenge_type === 'exclusive' && styles.challengeTypeButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, challenge_type: 'exclusive' }))}
              >
                <View style={{ alignItems: 'center' }}>
                  <Ionicons 
                    name="person" 
                    size={20} 
                    color={formData.challenge_type === 'exclusive' ? 'white' : '#ff6b35'} 
                  />
                  <Text style={[
                    styles.challengeTypeText,
                    formData.challenge_type === 'exclusive' && styles.challengeTypeTextActive
                  ]}>
                    Exclusive
                  </Text>
                  <Text style={[
                    styles.challengeTypeSubtext,
                    formData.challenge_type === 'exclusive' && styles.challengeTypeSubtextActive
                  ]}>
                    One user only
                  </Text>
                </View>
              </Pressable>
              
              <Pressable
                style={[
                  styles.challengeTypeButton,
                  formData.challenge_type === 'open' && styles.challengeTypeButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, challenge_type: 'open' }))}
              >
                <View style={{ alignItems: 'center' }}>
                  <Ionicons 
                    name="people" 
                    size={20} 
                    color={formData.challenge_type === 'open' ? 'white' : '#ff6b35'} 
                  />
                  <Text style={[
                    styles.challengeTypeText,
                    formData.challenge_type === 'open' && styles.challengeTypeTextActive
                  ]}>
                    Open
                  </Text>
                  <Text style={[
                    styles.challengeTypeSubtext,
                    formData.challenge_type === 'open' && styles.challengeTypeSubtextActive
                  ]}>
                    Multiple users
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Start Date (Optional)</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <input
                  type="date"
                  value={startDate ? startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setStartDate(new Date(e.target.value));
                    } else {
                      setStartDate(null);
                    }
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f8f9fa',
                    fontSize: '16px',
                    width: '100%',
                    outline: 'none',
                  }}
                />
                {startDate && (
                  <Pressable 
                    style={styles.clearDateButton}
                    onPress={() => setStartDate(null)}
                  >
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#ff6b35" />
                <Text style={styles.dateButtonText}>
                  {startDate ? startDate.toLocaleDateString() : 'Select start date'}
                </Text>
                {startDate && (
                  <Pressable onPress={() => setStartDate(null)}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </Pressable>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>End Date (Optional)</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <input
                  type="date"
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setEndDate(new Date(e.target.value));
                    } else {
                      setEndDate(null);
                    }
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f8f9fa',
                    fontSize: '16px',
                    width: '100%',
                    outline: 'none',
                  }}
                />
                {endDate && (
                  <Pressable 
                    style={styles.clearDateButton}
                    onPress={() => setEndDate(null)}
                  >
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#ff6b35" />
                <Text style={styles.dateButtonText}>
                  {endDate ? endDate.toLocaleDateString() : 'Select end date'}
                </Text>
                {endDate && (
                  <Pressable onPress={() => setEndDate(null)}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </Pressable>
            )}
          </View>


          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setShowCreateForm(false);
                setFormData({ title: '', description: '', points: '', challenge_type: 'exclusive' });
                setStartDate(null);
                setEndDate(null);
                        }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleCreateChallenge}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={16} color="white" />
                  <Text style={styles.submitButtonText}>Create</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Admin Filters */}
      <View style={styles.adminFiltersContainer}>
        <Pressable 
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={20} color="#ff6b35" />
          <Text style={styles.filterToggleText}>Filters</Text>
          <Ionicons 
            name={showFilters ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#ff6b35" 
          />
        </Pressable>
        
        {(statusFilter !== 'all' || filterStartDate || filterEndDate || userFilter) && (
          <Pressable 
            style={styles.clearFiltersBtn}
            onPress={() => {
              setStatusFilter('all');
              setFilterStartDate(null);
              setFilterEndDate(null);
              setUserFilter('');
            }}
          >
            <Text style={styles.clearFiltersBtnText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {showFilters && (
        <View style={styles.adminFilterOptions}>
          {/* Status Filter */}
          <View style={styles.adminFilterRow}>
            <Text style={styles.adminFilterLabel}>Status:</Text>
            <View style={styles.statusFilterButtons}>
              {(['all', 'available', 'in_progress', 'completed'] as const).map((status) => (
                <Pressable
                  key={status}
                  style={[
                    styles.statusFilterButton,
                    statusFilter === status && styles.statusFilterButtonActive
                  ]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[
                    styles.statusFilterButtonText,
                    statusFilter === status && styles.statusFilterButtonTextActive
                  ]}>
                    {status === 'all' ? 'All' : 
                     status === 'available' ? 'Available' :
                     status === 'in_progress' ? 'In Progress' : 'Completed'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Date Filters */}
          <View style={styles.adminFilterRow}>
            <Text style={styles.adminFilterLabel}>Start Date From:</Text>
            <Pressable
              style={styles.dateFilterButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const input = document.createElement('input');
                  input.type = 'date';
                  input.onchange = (e: any) => {
                    if (e.target.value) {
                      setFilterStartDate(new Date(e.target.value));
                    }
                  };
                  input.click();
                } else {
                  // Handle mobile date picker if needed
                  setFilterStartDate(new Date());
                }
              }}
            >
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.dateFilterButtonText}>
                {filterStartDate ? filterStartDate.toLocaleDateString() : 'Select date'}
              </Text>
              {filterStartDate && (
                <Pressable onPress={() => setFilterStartDate(null)}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </Pressable>
              )}
            </Pressable>
          </View>

          <View style={styles.adminFilterRow}>
            <Text style={styles.adminFilterLabel}>End Date Until:</Text>
            <Pressable
              style={styles.dateFilterButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const input = document.createElement('input');
                  input.type = 'date';
                  input.onchange = (e: any) => {
                    if (e.target.value) {
                      setFilterEndDate(new Date(e.target.value));
                    }
                  };
                  input.click();
                } else {
                  // Handle mobile date picker if needed
                  setFilterEndDate(new Date());
                }
              }}
            >
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.dateFilterButtonText}>
                {filterEndDate ? filterEndDate.toLocaleDateString() : 'Select date'}
              </Text>
              {filterEndDate && (
                <Pressable onPress={() => setFilterEndDate(null)}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </Pressable>
              )}
            </Pressable>
          </View>

          {/* User Filter */}
          {availableUsers.length > 0 && (
            <View style={styles.adminFilterRow}>
              <Text style={styles.adminFilterLabel}>User:</Text>
              <View style={styles.userFilterContainer}>
                <Pressable
                  style={[styles.userFilterButton, userFilter && styles.userFilterButtonActive]}
                  onPress={() => setUserFilter('')}
                >
                  <Text style={[
                    styles.userFilterButtonText,
                    !userFilter && styles.userFilterButtonTextActive
                  ]}>
                    All Users
                  </Text>
                </Pressable>
                {availableUsers.map((username) => (
                  <Pressable
                    key={username}
                    style={[
                      styles.userFilterButton,
                      userFilter === username && styles.userFilterButtonActive
                    ]}
                    onPress={() => setUserFilter(userFilter === username ? '' : username)}
                  >
                    <Text style={[
                      styles.userFilterButtonText,
                      userFilter === username && styles.userFilterButtonTextActive
                    ]}>
                      {username}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.challengesList}>
        <Text style={styles.sectionTitle}>
          {statusFilter === 'all' ? 'All Challenges' : 
           statusFilter === 'available' ? 'Available Challenges' :
           statusFilter === 'in_progress' ? 'In Progress Challenges' : 'Completed Challenges'} 
          ({filteredChallenges?.length || 0})
        </Text>
        
        {(filteredChallenges || []).map((challenge) => {
          const statusInfo = getStatusInfo(challenge);
          return (
            <View key={challenge.id} style={styles.challengeCard}>
              {/* Header with title, points and gear menu */}
              <View style={styles.cardHeader}>
                <View style={styles.titleSection}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.text}
                    </Text>
                  </View>
                </View>
                <View style={styles.headerRight}>
                  {challenge.challenge_type === 'open' && (
                    <View style={styles.adminTypeBadge}>
                      <Ionicons name="people" size={12} color="#007bff" />
                      <Text style={styles.adminTypeText}>Open</Text>
                      {challenge.submissions && challenge.submissions.length > 0 && (
                        <Text style={styles.adminParticipantText}>
                          {challenge.submissions.length}
                        </Text>
                      )}
                    </View>
                  )}
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>{challenge.points} pts</Text>
                  </View>
                  <Pressable
                    style={styles.gearButton}
                    onPress={() => setOpenMenuId(openMenuId === challenge.id ? null : challenge.id)}
                  >
                    <Ionicons name="settings" size={20} color="#666" />
                  </Pressable>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.challengeDescription} numberOfLines={2}>
                {challenge.description}
              </Text>

              {/* Challenge details */}
              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(challenge.created_at).toLocaleDateString()}
                  </Text>
                </View>
                
                {challenge.start_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Start Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(challenge.start_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                
                {challenge.end_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>End Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(challenge.end_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                
                {challenge.assigned_to_username && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Assigned to:</Text>
                    <Text style={styles.detailValue}>
                      {challenge.assigned_to_username}
                    </Text>
                  </View>
                )}
                
                {challenge.completed_by_username && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Completed by:</Text>
                    <Text style={styles.detailValue}>
                      {challenge.completed_by_username}
                    </Text>
                  </View>
                )}
              </View>

              {/* Dropdown menu */}
              {openMenuId === challenge.id && (
                <View style={styles.dropdownMenu}>
                  {challenge.status === 'completed' && challenge.completed_post_id && (
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        navigation.navigate('PostDetail', { postId: challenge.completed_post_id });
                        setOpenMenuId(null);
                      }}
                    >
                      <Ionicons name="eye" size={16} color="#007bff" />
                      <Text style={[styles.menuText, { color: '#007bff' }]}>View Post</Text>
                    </Pressable>
                  )}
                  
                  {challenge.assigned_to && challenge.status === 'in_progress' && (
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        handleUnassignChallenge(challenge.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Ionicons name="person-remove" size={16} color="#f39c12" />
                      <Text style={[styles.menuText, { color: '#f39c12' }]}>Unassign User</Text>
                    </Pressable>
                  )}
                  
                  {challenge.challenge_type === 'open' && challenge.submissions && challenge.submissions.length > 0 && (
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        setSelectedChallengeForAward(challenge);
                        setShowAwardModal(true);
                        setOpenMenuId(null);
                      }}
                    >
                      <Ionicons name="trophy" size={16} color="#28a745" />
                      <Text style={[styles.menuText, { color: '#28a745' }]}>Award Challenge</Text>
                    </Pressable>
                  )}
                  
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      handleDeleteChallenge(challenge.id);
                      setOpenMenuId(null);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#dc3545" />
                    <Text style={[styles.menuText, { color: '#dc3545' }]}>Delete Challenge</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {Platform.OS !== 'web' && showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {Platform.OS !== 'web' && showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}

      {/* Award Challenge Modal */}
      {showAwardModal && selectedChallengeForAward && (
        <View style={styles.modalOverlay}>
          <View style={styles.awardModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Award Challenge</Text>
              <Pressable 
                style={styles.closeButton}
                onPress={() => {
                  setShowAwardModal(false);
                  setSelectedChallengeForAward(null);
                  setSelectedWinner(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>
            
            <Text style={styles.challengeTitleModal}>
              {selectedChallengeForAward.title}
            </Text>
            <Text style={styles.modalSubtitle}>
              Select a winner from {selectedChallengeForAward.submissions?.length || 0} submissions:
            </Text>
            
            <ScrollView style={styles.submissionsList}>
              {selectedChallengeForAward.submissions?.map((submission) => (
                <Pressable
                  key={submission.id}
                  style={[
                    styles.submissionItem,
                    selectedWinner?.id === submission.id && styles.submissionItemSelected
                  ]}
                  onPress={() => setSelectedWinner(submission)}
                >
                  <View style={styles.submissionUserInfo}>
                    {submission.user_profile_image ? (
                      <Image 
                        source={{ uri: apiService.getMediaUrl(submission.user_profile_image) }}
                        style={styles.submissionAvatar}
                      />
                    ) : (
                      <View style={styles.submissionAvatarPlaceholder}>
                        <Ionicons name="person" size={16} color="#999" />
                      </View>
                    )}
                    <View style={styles.submissionDetails}>
                      <Text style={styles.submissionUsername}>{submission.username}</Text>
                      <Text style={styles.submissionDate}>
                        {new Date(submission.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.viewPostButton}
                    onPress={() => {
                      navigation.navigate('PostDetail', { postId: submission.post_id });
                    }}
                  >
                    <Ionicons name="eye" size={16} color="#007bff" />
                    <Text style={styles.viewPostText}>View Post</Text>
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelModalButton}
                onPress={() => {
                  setShowAwardModal(false);
                  setSelectedChallengeForAward(null);
                  setSelectedWinner(null);
                }}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.awardButton,
                  !selectedWinner && styles.awardButtonDisabled
                ]}
                onPress={handleAwardChallenge}
                disabled={!selectedWinner}
              >
                <Ionicons name="trophy" size={16} color="white" />
                <Text style={styles.awardButtonText}>Award Points</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
        </ScrollView>
      </Pressable>
      <ConfirmComponent />
    </View>
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  createForm: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    minHeight: 100,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b35',
    padding: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#ffb3a0',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  challengesList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  challengeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 16,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  challengeDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  gearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  detailsGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  webDateContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearDateButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  adminFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: {
    color: '#ff6b35',
    fontSize: 16,
    fontWeight: '600',
  },
  clearFiltersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  clearFiltersBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  adminFilterOptions: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 16,
  },
  adminFilterRow: {
    marginBottom: 12,
  },
  adminFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statusFilterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ff6b35',
    backgroundColor: 'transparent',
  },
  statusFilterButtonActive: {
    backgroundColor: '#ff6b35',
  },
  statusFilterButtonText: {
    color: '#ff6b35',
    fontSize: 12,
    fontWeight: '500',
  },
  statusFilterButtonTextActive: {
    color: 'white',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  dateFilterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  userFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userFilterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'transparent',
  },
  userFilterButtonActive: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  userFilterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  userFilterButtonTextActive: {
    color: 'white',
  },
  challengeTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  challengeTypeButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ff6b35',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  challengeTypeButtonActive: {
    backgroundColor: '#ff6b35',
  },
  challengeTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b35',
    marginTop: 8,
  },
  challengeTypeTextActive: {
    color: 'white',
  },
  challengeTypeSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  challengeTypeSubtextActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  awardModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  challengeTitleModal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff6b35',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  submissionsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  submissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  submissionItemSelected: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  submissionUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  submissionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  submissionAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  submissionDetails: {
    flex: 1,
  },
  submissionUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  submissionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  viewPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    gap: 4,
  },
  viewPostText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelModalText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  awardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#28a745',
    gap: 6,
  },
  awardButtonDisabled: {
    backgroundColor: '#ccc',
  },
  awardButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  adminTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    marginRight: 8,
  },
  adminTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007bff',
  },
  adminParticipantText: {
    fontSize: 9,
    color: '#007bff',
    opacity: 0.8,
    marginLeft: 2,
  },
});

export default AdminScreen;