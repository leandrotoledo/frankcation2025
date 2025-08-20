import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import MagicalTheme from '../theme/magicalTheme';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalButton from '../components/common/MagicalButton';

interface Props {
  navigation: any;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const { showError } = useAlert();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { username, password, confirmPassword, firstName, lastName } = formData;

    if (!username.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
      showError('Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register({
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
      });
    } catch (error: any) {
      showError(error.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[MagicalTheme.colors.magicBlue, '#1E40AF', MagicalTheme.colors.enchantedPurple]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SparkleEffect count={8} size="medium" />
        
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Magical Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Ionicons 
                  name="sparkles" 
                  size={32} 
                  color={MagicalTheme.colors.disneyGold} 
                  style={styles.sparkleIcon}
                />
                <Text style={styles.title}>Join the Magic</Text>
                <Ionicons 
                  name="sparkles" 
                  size={32} 
                  color={MagicalTheme.colors.disneyGold} 
                  style={styles.sparkleIcon}
                />
              </View>
              <Text style={styles.subtitle}>
                ✨ Begin Your Enchanted Adventure ✨
              </Text>
              <Text style={styles.description}>
                Create your magical account and join The Frankcation 2025 Challenge!
              </Text>
            </View>

            {/* Magical Form */}
            <View style={styles.formContainer}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                style={styles.form}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="person" size={20} color={MagicalTheme.colors.magicBlue} />
                    <Text style={styles.label}>Username</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formData.username}
                    onChangeText={(value) => updateField('username', value)}
                    placeholder="Choose your magical username"
                    placeholderTextColor={MagicalTheme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="happy" size={20} color={MagicalTheme.colors.magicBlue} />
                      <Text style={styles.label}>First Name</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={formData.firstName}
                      onChangeText={(value) => updateField('firstName', value)}
                      placeholder="Your first name"
                      placeholderTextColor={MagicalTheme.colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="star" size={20} color={MagicalTheme.colors.magicBlue} />
                      <Text style={styles.label}>Last Name</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={formData.lastName}
                      onChangeText={(value) => updateField('lastName', value)}
                      placeholder="Your last name"
                      placeholderTextColor={MagicalTheme.colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="key" size={20} color={MagicalTheme.colors.magicBlue} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formData.password}
                    onChangeText={(value) => updateField('password', value)}
                    placeholder="Create your secret spell (min 6 characters)"
                    placeholderTextColor={MagicalTheme.colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="shield-checkmark" size={20} color={MagicalTheme.colors.magicBlue} />
                    <Text style={styles.label}>Confirm Password</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formData.confirmPassword}
                    onChangeText={(value) => updateField('confirmPassword', value)}
                    placeholder="Confirm your secret spell"
                    placeholderTextColor={MagicalTheme.colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <MagicalButton
                  title={isLoading ? 'Casting Magic...' : 'Join the Adventure'}
                  onPress={handleRegister}
                  variant="outline"
                  size="large"
                  icon="sparkles"
                  disabled={isLoading}
                  fullWidth
                  style={styles.registerButton}
                />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <MagicalButton
                    title="Sign in here"
                    onPress={() => navigation.navigate('Login')}
                    variant="outline"
                    size="small"
                  />
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  
  keyboardContainer: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: MagicalTheme.spacing.lg,
  },
  
  header: {
    alignItems: 'center',
    marginBottom: MagicalTheme.spacing.xxl,
    paddingTop: MagicalTheme.spacing.xl,
  },
  
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: MagicalTheme.spacing.md,
  },
  
  sparkleIcon: {
    marginHorizontal: MagicalTheme.spacing.sm,
  },
  
  title: {
    fontSize: MagicalTheme.typography.hero,
    fontWeight: MagicalTheme.typography.weights.black,
    color: MagicalTheme.colors.cloudWhite,
    textAlign: 'center',
    textShadowColor: MagicalTheme.colors.shadowDark,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  
  subtitle: {
    fontSize: MagicalTheme.typography.heading,
    color: MagicalTheme.colors.disneyGold,
    textAlign: 'center',
    fontWeight: MagicalTheme.typography.weights.semibold,
    marginBottom: MagicalTheme.spacing.sm,
    textShadowColor: MagicalTheme.colors.shadowMedium,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  description: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.cloudWhite,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
    paddingHorizontal: MagicalTheme.spacing.lg,
  },
  
  formContainer: {
    paddingHorizontal: MagicalTheme.spacing.sm,
  },
  
  form: {
    borderRadius: MagicalTheme.borderRadius.xl,
    padding: MagicalTheme.spacing.xl,
    ...MagicalTheme.shadows.magical,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  inputContainer: {
    marginBottom: MagicalTheme.spacing.lg,
  },
  
  halfWidth: {
    width: '48%',
  },
  
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: MagicalTheme.spacing.sm,
  },
  
  label: {
    fontSize: MagicalTheme.typography.body,
    fontWeight: MagicalTheme.typography.weights.semibold,
    color: MagicalTheme.colors.magicBlue,
    marginLeft: MagicalTheme.spacing.sm,
  },
  
  input: {
    borderWidth: 2,
    borderColor: MagicalTheme.colors.border,
    borderRadius: MagicalTheme.borderRadius.lg,
    padding: MagicalTheme.spacing.md,
    fontSize: MagicalTheme.typography.body,
    backgroundColor: MagicalTheme.colors.surface,
    color: MagicalTheme.colors.textPrimary,
    ...MagicalTheme.shadows.subtle,
  },
  
  registerButton: {
    marginTop: MagicalTheme.spacing.lg,
    marginBottom: MagicalTheme.spacing.sm,
  },
  
  footer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: MagicalTheme.spacing.lg,
    paddingBottom: MagicalTheme.spacing.xl,
  },
  
  footerText: {
    fontSize: MagicalTheme.typography.body,
    color: MagicalTheme.colors.textSecondary,
    marginBottom: MagicalTheme.spacing.md,
    textAlign: 'center',
  },
});

export default RegisterScreen;