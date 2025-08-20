import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast, Toast } from '../context/ToastContext';

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { hideToast } = useToast();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideToast(toast.id);
    });
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'information-circle';
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return { bg: '#d4f8e8', border: '#28a745', text: '#155724', icon: '#28a745' };
      case 'error':
        return { bg: '#f8d7da', border: '#dc3545', text: '#721c24', icon: '#dc3545' };
      case 'warning':
        return { bg: '#fff3cd', border: '#ffc107', text: '#856404', icon: '#ffc107' };
      case 'info':
        return { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460', icon: '#17a2b8' };
      default:
        return { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460', icon: '#17a2b8' };
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name={getIcon()} size={24} color={colors.icon} style={styles.toastIcon} />
        <View style={styles.toastText}>
          <Text style={[styles.toastTitle, { color: colors.text }]}>{toast.title}</Text>
          {toast.message && (
            <Text style={[styles.toastMessage, { color: colors.text }]}>{toast.message}</Text>
          )}
        </View>
        <Pressable onPress={handleDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toastItem: {
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  toastIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 14,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});