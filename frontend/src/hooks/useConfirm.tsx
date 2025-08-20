import React, { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    options: ConfirmOptions;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    options: { title: '', message: '' },
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        visible: true,
        options,
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, visible: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(prev => ({ ...prev, visible: false }));
          resolve(false);
        },
      });
    });
  }, []);

  const ConfirmComponent = useCallback(() => (
    <ConfirmDialog
      visible={confirmState.visible}
      title={confirmState.options.title}
      message={confirmState.options.message}
      confirmText={confirmState.options.confirmText}
      cancelText={confirmState.options.cancelText}
      confirmColor={confirmState.options.confirmColor}
      onConfirm={confirmState.onConfirm || (() => {})}
      onCancel={confirmState.onCancel || (() => {})}
    />
  ), [confirmState]);

  return { confirm, ConfirmComponent };
};