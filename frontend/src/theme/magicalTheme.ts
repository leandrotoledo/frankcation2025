// Disney-Inspired Magical Theme
export const MagicalTheme = {
  colors: {
    // Primary Disney Colors
    magicBlue: '#003875',      // Deep Magic Kingdom Blue
    disneyGold: '#FFD700',     // Classic Disney Gold
    enchantedPurple: '#6B46C1', // Magical Purple
    royalBlue: '#1E40AF',      // Royal Disney Blue
    pixiePink: '#FF69B4',      // Enchanted Pink
    castleGray: '#6B7280',     // Castle Stone Gray
    cloudWhite: '#FFFFFF',     // Pure Magic White
    
    // Magical Gradients
    primaryGradient: ['#003875', '#1E40AF'], // Magic Blue gradient
    royalGradient: ['#1E40AF', '#3B82F6'],   // Royal blue gradient
    enchantedGradient: ['#6B46C1', '#8B5CF6'], // Purple magic
    goldGradient: ['#FFD700', '#FFA726'],    // Disney gold
    pinkGradient: ['#FF69B4', '#FF8A95'],    // Pixie dust pink
    
    // Semantic Colors
    background: '#F8FAFF',     // Soft magical background
    surface: '#FFFFFF',        // Pure white surfaces
    surfaceSecondary: '#F1F5F9', // Light gray surfaces
    border: '#E2E8F0',         // Subtle borders
    
    // Text Colors
    textPrimary: '#1E293B',    // Dark text
    textSecondary: '#64748B',  // Medium text
    textMuted: '#94A3B8',      // Light text
    textOnDark: '#FFFFFF',     // White text for dark backgrounds
    
    // Status Colors
    success: '#10B981',        // Magical green
    warning: '#F59E0B',        // Golden warning
    error: '#EF4444',          // Magical red
    info: '#3B82F6',           // Magic blue
    
    // Shadow Colors
    shadowLight: 'rgba(0, 56, 117, 0.1)',  // Light blue shadow
    shadowMedium: 'rgba(0, 56, 117, 0.2)', // Medium blue shadow
    shadowDark: 'rgba(0, 56, 117, 0.3)',   // Dark blue shadow
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 50,
  },
  
  typography: {
    // Magical font sizes
    hero: 32,
    title: 24,
    heading: 20,
    body: 16,
    caption: 14,
    small: 12,
    tiny: 10,
    
    // Font weights
    weights: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      black: '900',
    },
  },
  
  shadows: {
    magical: {
      shadowColor: '#003875',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 12,
    },
    gentle: {
      shadowColor: '#003875',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    subtle: {
      shadowColor: '#003875',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
  },
  
  animations: {
    spring: {
      tension: 300,
      friction: 20,
    },
    gentle: {
      tension: 150,
      friction: 15,
    },
    bouncy: {
      tension: 200,
      friction: 10,
    },
  },
};

// Magical Gradient Creator
export const createMagicalGradient = (colors: string[]) => {
  return `linear-gradient(135deg, ${colors.join(', ')})`;
};

// Sparkle Animation Keyframes (for web)
export const sparkleKeyframes = `
  @keyframes sparkle {
    0%, 100% { 
      opacity: 0.3; 
      transform: scale(0.8) rotate(0deg);
    }
    50% { 
      opacity: 1; 
      transform: scale(1.2) rotate(180deg);
    }
  }
  
  @keyframes magicalPulse {
    0%, 100% { 
      opacity: 0.6; 
      transform: scale(1);
    }
    50% { 
      opacity: 1; 
      transform: scale(1.05);
    }
  }
  
  @keyframes floatUp {
    0% { 
      opacity: 1; 
      transform: translateY(0px);
    }
    100% { 
      opacity: 0; 
      transform: translateY(-20px);
    }
  }
`;

// Magical Button Variants
export const MagicalButtons = {
  primary: {
    background: createMagicalGradient(MagicalTheme.colors.primaryGradient),
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.magical,
  },
  
  royal: {
    background: createMagicalGradient(MagicalTheme.colors.royalGradient),
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.magical,
  },
  
  enchanted: {
    background: createMagicalGradient(MagicalTheme.colors.enchantedGradient),
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.magical,
  },
  
  gold: {
    background: createMagicalGradient(MagicalTheme.colors.goldGradient),
    borderRadius: MagicalTheme.borderRadius.lg,
    ...MagicalTheme.shadows.magical,
  },
};

export default MagicalTheme;