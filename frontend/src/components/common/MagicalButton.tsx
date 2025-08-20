import React from 'react';
import { 
  Pressable, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MagicalTheme from '../../theme/magicalTheme';

interface MagicalButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'royal' | 'enchanted' | 'gold' | 'outline';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const MagicalButton: React.FC<MagicalButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const scaleValue = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: Platform.OS !== 'web',
      ...MagicalTheme.animations.spring,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      ...MagicalTheme.animations.spring,
    }).start();
  };

  const getGradientColors = () => {
    switch (variant) {
      case 'primary':
        return MagicalTheme.colors.primaryGradient;
      case 'royal':
        return MagicalTheme.colors.royalGradient;
      case 'enchanted':
        return MagicalTheme.colors.enchantedGradient;
      case 'gold':
        return MagicalTheme.colors.goldGradient;
      default:
        return MagicalTheme.colors.primaryGradient;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: MagicalTheme.spacing.sm,
          paddingHorizontal: MagicalTheme.spacing.md,
          minHeight: 36,
        };
      case 'large':
        return {
          paddingVertical: MagicalTheme.spacing.md + 4,
          paddingHorizontal: MagicalTheme.spacing.xl,
          minHeight: 56,
        };
      default: // medium
        return {
          paddingVertical: MagicalTheme.spacing.md,
          paddingHorizontal: MagicalTheme.spacing.lg,
          minHeight: 48,
        };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return MagicalTheme.typography.caption;
      case 'large':
        return MagicalTheme.typography.heading;
      default:
        return MagicalTheme.typography.body;
    }
  };

  if (variant === 'outline') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <Pressable
          style={[
            styles.button,
            styles.outlineButton,
            getSizeStyles(),
            fullWidth && styles.fullWidth,
            disabled && styles.disabled,
            style,
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
        >
          {icon && (
            <Ionicons 
              name={icon} 
              size={getTextSize()} 
              color={MagicalTheme.colors.magicBlue}
              style={styles.icon}
            />
          )}
          <Text style={[
            styles.outlineText,
            { fontSize: getTextSize() },
            textStyle,
          ]}>
            {title}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        style={[
          styles.button,
          getSizeStyles(),
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          style,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {icon && (
            <Ionicons 
              name={icon} 
              size={getTextSize()} 
              color={MagicalTheme.colors.textOnDark}
              style={styles.icon}
            />
          )}
          <Text style={[
            styles.text,
            { fontSize: getTextSize() },
            textStyle,
          ]}>
            {title}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: MagicalTheme.borderRadius.xl,
    overflow: 'hidden',
    ...MagicalTheme.shadows.magical,
  },
  
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  
  outlineButton: {
    borderWidth: 2,
    borderColor: MagicalTheme.colors.magicBlue,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MagicalTheme.borderRadius.xl,
  },
  
  text: {
    color: MagicalTheme.colors.textOnDark,
    fontWeight: MagicalTheme.typography.weights.bold,
    textAlign: 'center',
  },
  
  outlineText: {
    color: MagicalTheme.colors.magicBlue,
    fontWeight: MagicalTheme.typography.weights.bold,
    textAlign: 'center',
  },
  
  icon: {
    marginRight: MagicalTheme.spacing.sm,
  },
  
  fullWidth: {
    width: '100%',
  },
  
  disabled: {
    opacity: 0.6,
  },
});

export default MagicalButton;