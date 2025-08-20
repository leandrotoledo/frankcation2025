import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../hooks/useAlert';
import MagicalButton from '../components/common/MagicalButton';
import SparkleEffect from '../components/common/SparkleEffect';
import MagicalTheme from '../theme/magicalTheme';

interface Props {
  navigation: any;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showError } = useAlert();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (error: any) {
      showError(error.message || 'An error occurred during login');
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
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            style={styles.scrollView}
          >
            {/* Magical Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Ionicons 
                  name="sparkles" 
                  size={32} 
                  color={MagicalTheme.colors.disneyGold} 
                  style={styles.sparkleIcon}
                />
                <Text style={styles.title}>The Frankcation 2025 Challenge</Text>
                <Ionicons 
                  name="sparkles" 
                  size={32} 
                  color={MagicalTheme.colors.disneyGold} 
                  style={styles.sparkleIcon}
                />
              </View>
              <Text style={styles.subtitle}>
                ✨ Where Magic Meets Adventure ✨
              </Text>
              <Text style={styles.description}>
                Begin your enchanted journey through the most magical place on earth!
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
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter your magical username"
                    placeholderTextColor={MagicalTheme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="key" size={20} color={MagicalTheme.colors.magicBlue} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your secret spell"
                    placeholderTextColor={MagicalTheme.colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <MagicalButton
                  title={isLoading ? 'Casting Magic...' : 'Begin Adventure'}
                  onPress={handleLogin}
                  variant="outline"
                  size="large"
                  icon="sparkles"
                  disabled={isLoading}
                  fullWidth
                  style={styles.loginButton}
                />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>New to the magic? </Text>
                  <MagicalButton
                    title="Join the Adventure"
                    onPress={() => navigation.navigate('Register')}
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
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    padding: MagicalTheme.spacing.lg,
    paddingBottom: MagicalTheme.spacing.xxl * 4, // Only add bottom space to make content scrollable
  },
  
  header: {
    alignItems: 'center',
    marginTop: MagicalTheme.spacing.xxl,
    marginBottom: MagicalTheme.spacing.xxl,
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
  
  inputContainer: {
    marginBottom: MagicalTheme.spacing.lg,
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
  
  loginButton: {
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

export default LoginScreen;