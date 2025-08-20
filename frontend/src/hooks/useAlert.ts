import { useToast } from '../context/ToastContext';

export const useAlert = () => {
  const { showToast } = useToast();

  const showAlert = (title: string, message?: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    showToast({
      type,
      title,
      message,
    });
  };

  const showSuccess = (title: string, message?: string) => {
    showAlert(title, message, 'success');
  };

  const showError = (title: string, message?: string) => {
    showAlert(title, message, 'error');
  };

  const showWarning = (title: string, message?: string) => {
    showAlert(title, message, 'warning');
  };

  const showInfo = (title: string, message?: string) => {
    showAlert(title, message, 'info');
  };

  return {
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};