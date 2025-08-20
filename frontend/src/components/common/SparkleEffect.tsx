import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MagicalTheme from '../../theme/magicalTheme';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotate: Animated.Value;
}

interface SparkleEffectProps {
  count?: number;
  duration?: number;
  colors?: string[];
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const SparkleEffect: React.FC<SparkleEffectProps> = ({
  count = 6,
  duration = 2000,
  colors = [MagicalTheme.colors.disneyGold, MagicalTheme.colors.pixiePink, MagicalTheme.colors.cloudWhite],
  size = 'medium',
  style,
}) => {
  const sparkles = useRef<Sparkle[]>([]);
  const { width, height } = Dimensions.get('window');

  const getSizeValue = () => {
    switch (size) {
      case 'small':
        return { min: 8, max: 16 };
      case 'large':
        return { min: 20, max: 32 };
      default:
        return { min: 12, max: 24 };
    }
  };

  const createSparkle = (id: number): Sparkle => {
    const sizeRange = getSizeValue();
    return {
      id,
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * (sizeRange.max - sizeRange.min) + sizeRange.min,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      rotate: new Animated.Value(0),
    };
  };

  const animateSparkle = (sparkle: Sparkle) => {
    const sequences = [
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(sparkle.opacity, {
          toValue: 1,
          duration: duration * 0.3,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(sparkle.scale, {
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
          ...MagicalTheme.animations.bouncy,
        }),
      ]),
      
      // Rotate and pulse
      Animated.parallel([
        Animated.timing(sparkle.rotate, {
          toValue: 360,
          duration: duration * 0.6,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.sequence([
          Animated.timing(sparkle.scale, {
            toValue: 1.2,
            duration: duration * 0.2,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(sparkle.scale, {
            toValue: 1,
            duration: duration * 0.2,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]),
      
      // Fade out
      Animated.timing(sparkle.opacity, {
        toValue: 0,
        duration: duration * 0.3,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ];

    Animated.sequence(sequences).start(() => {
      // Reset sparkle position and restart animation
      sparkle.x = Math.random() * width;
      sparkle.y = Math.random() * height;
      sparkle.opacity.setValue(0);
      sparkle.scale.setValue(0);
      sparkle.rotate.setValue(0);
      
      // Add random delay before next animation
      setTimeout(() => animateSparkle(sparkle), Math.random() * 2000);
    });
  };

  useEffect(() => {
    // Initialize sparkles
    sparkles.current = Array.from({ length: count }, (_, i) => createSparkle(i));
    
    // Start animations with staggered delays
    sparkles.current.forEach((sparkle, index) => {
      setTimeout(() => animateSparkle(sparkle), index * 300);
    });
  }, [count, duration]);

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {sparkles.current.map((sparkle, index) => (
        <Animated.View
          key={sparkle.id}
          style={[
            styles.sparkle,
            {
              left: sparkle.x,
              top: sparkle.y,
              opacity: sparkle.opacity,
              transform: [
                { scale: sparkle.scale },
                { 
                  rotate: sparkle.rotate.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  })
                },
              ],
            },
          ]}
        >
          <Ionicons
            name="star"
            size={sparkle.size}
            color={colors[index % colors.length]}
          />
        </Animated.View>
      ))}
    </View>
  );
};

// Floating Hearts Effect for special occasions
export const FloatingHeartsEffect: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const hearts = useRef<Animated.Value[]>([]);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    hearts.current = Array.from({ length: count }, () => new Animated.Value(height));
    
    const animateHearts = () => {
      hearts.current.forEach((heart, index) => {
        setTimeout(() => {
          heart.setValue(height);
          Animated.timing(heart, {
            toValue: -50,
            duration: 4000 + Math.random() * 2000,
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            // Restart animation
            setTimeout(animateHearts, Math.random() * 3000);
          });
        }, index * 800);
      });
    };

    animateHearts();
  }, [count]);

  return (
    <View style={styles.container} pointerEvents="none">
      {hearts.current.map((heart, index) => (
        <Animated.View
          key={index}
          style={[
            styles.floatingHeart,
            {
              left: Math.random() * width,
              transform: [
                { translateY: heart },
                { 
                  rotate: heart.interpolate({
                    inputRange: [height, -50],
                    outputRange: ['0deg', '360deg'],
                  })
                },
              ],
            },
          ]}
        >
          <Ionicons
            name="heart"
            size={20 + Math.random() * 10}
            color={MagicalTheme.colors.pixiePink}
          />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  
  sparkle: {
    position: 'absolute',
  },
  
  floatingHeart: {
    position: 'absolute',
  },
});

export default SparkleEffect;